// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextRequest, NextResponse } from "next/server"
import {
  searchSteamWallpapers,
  translateTitle,
  mapSteamItemToWallpaper,
  detectTagsWithQwen,
  fetchAuthorInfo,
  SortMode,
} from "@/lib/steam"
import {
  getWallpapersByIds,
  searchWallpapersInDb,
  upsertWallpapers,
  insertNewWallpapers,
  toDbWallpaper,
  fromDbWallpaper,
} from "@/lib/db"
import { isDbAvailable } from "@/lib/supabase"
import { Wallpaper } from "@/types/wallpaper"

const SEARCH_STOPWORDS = new Set([
  "the","a","an","of","and","or","in","on","at","to","for","with","from",
  "is","as","this","that","by","de","da","do","das","dos","com","para","em"
])

function relevanceScore(w: Wallpaper, words: string[]): number {
  const titleLower = w.title.toLowerCase()
  const allTags = [...(w.tags ?? []), ...(w.userTags ?? []), ...(w.steamTags ?? [])]
    .map(t => t.toLowerCase())

  let score = 0
  for (const word of words) {
    if (titleLower.includes(word)) score += 100
    if (allTags.some(t => t.includes(word))) score += 1
  }
  return score
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query  = searchParams.get("q") ?? ""
  const sort   = (searchParams.get("sort") ?? "popular_alltime") as SortMode
  const cursor = searchParams.get("cursor") ?? "*"
  const pages  = Math.min(Number(searchParams.get("pages") ?? "5"), 15)

  try {
    // ── 1. Busca na Steam ─────────────────────────────────────────────────────
    const { items, nextCursor } = await searchSteamWallpapers(query, sort, cursor, pages)

    const steamWallpapers = await Promise.all(
      items.map(async (item) => {
        const translated = await translateTitle(item.title)
        return {
          wallpaper: mapSteamItemToWallpaper({ ...item, title: translated }),
          titleOriginal: item.title,
        }
      })
    )

    // Preenche nome de exibição + avatar do autor a partir do SteamID64 (item.creator)
    const authorIds = steamWallpapers.map(({ wallpaper }) => wallpaper.authorId).filter(Boolean)
    const authorAvatarById = new Map<number, string>()
    if (authorIds.length > 0) {
      const authorInfo = await fetchAuthorInfo(authorIds)
      for (const { wallpaper } of steamWallpapers) {
        if (wallpaper.authorId) {
          const info = authorInfo.get(wallpaper.authorId)
          if (info) {
            wallpaper.authorName = info.name || wallpaper.authorName
            wallpaper.authorAvatar = info.avatar || wallpaper.authorAvatar
            authorAvatarById.set(wallpaper.id, info.avatar)
          }
        }
      }
    }

    // ── 2. Busca no banco pelos IDs da Steam ──────────────────────────────────
    const steamIds = steamWallpapers.map((w) => w.wallpaper.id)
    const dbCache  = isDbAvailable() ? await getWallpapersByIds(steamIds) : new Map()

    // ── 3. Busca no banco por texto (título + tags) ───────────────────────────
    // Roda em paralelo com o merge da Steam
    const dbTextResults = isDbAvailable() && query.trim()
      ? await searchWallpapersInDb(query, 100)
      : []

    // ── 4. Merge Steam com dados do banco ─────────────────────────────────────
    const toIndex: { wallpaper: Wallpaper; titleOriginal: string; authorAvatar: string }[] = []
    const toRetag: { wallpaper: Wallpaper; titleOriginal: string; authorAvatar: string }[] = []

    // Map final: id → Wallpaper (sem duplicatas)
    const merged = new Map<number, Wallpaper>()

    for (const { wallpaper, titleOriginal } of steamWallpapers) {
      const cached = dbCache.get(wallpaper.id)
      const authorAvatar = authorAvatarById.get(wallpaper.id) ?? ""
      if (cached) {
        // Usa dados do banco (título traduzido, tags IA/user)
        // Preview: prefere o da Steam se for mais recente (Steam tem URL fresco)
        const merged_w = fromDbWallpaper(cached)
        merged_w.previewUrl = wallpaper.previewUrl // sempre URL fresca da Steam
        merged_w.downloads  = wallpaper.downloads  // downloads sempre da Steam
        merged.set(wallpaper.id, merged_w)

        if (cached.ai_tags.length === 0) toRetag.push({ wallpaper, titleOriginal, authorAvatar })
      } else {
        merged.set(wallpaper.id, wallpaper)
        toIndex.push({ wallpaper, titleOriginal, authorAvatar })
      }
    }

    // ── 5. Adiciona resultados do banco que não vieram da Steam ───────────────
    // Pula em sorts "popular_*" (período) — wallpapers do banco não têm info de
    // trend/período e podem ser muito antigos, quebrando o filtro "Esta Semana" etc.
    // Recentes/Mais Inscritos não dependem de período, então o banco pode contribuir.
    const isPeriodSort = sort.startsWith("popular_")
    if (!isPeriodSort) {
      for (const dbItem of dbTextResults) {
        if (!merged.has(dbItem.id) && dbItem.downloads >= 150) {
          merged.set(dbItem.id, fromDbWallpaper(dbItem))
        }
      }
    }

    // ── 6. Filtra e ordena ────────────────────────────────────────────────────
    const allMerged = Array.from(merged.values()).filter(w => w.previewUrl && w.downloads >= 150)

    const searchWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2 && !SEARCH_STOPWORDS.has(w))

    let finalWallpapers: Wallpaper[]
    if (searchWords.length > 0) {
      // Com busca: relevância (match no título pesa muito mais que tags) primeiro.
      // Desempate mantém a ORDEM ORIGINAL (que já reflete o sort/período escolhido:
      // Recentes, Esta Semana, Mais Inscritos etc) — em vez de downloads totais.
      finalWallpapers = allMerged
        .map((w, i) => ({ w, i }))
        .sort((a, b) => {
          const scoreDiff = relevanceScore(b.w, searchWords) - relevanceScore(a.w, searchWords)
          if (scoreDiff !== 0) return scoreDiff
          return a.i - b.i
        })
        .map(x => x.w)
    } else {
      finalWallpapers = sort === "recent"
        ? allMerged
        : allMerged.sort((a, b) => b.downloads - a.downloads)
    }

    // ── 7. Background jobs ────────────────────────────────────────────────────
    if (toIndex.length > 0 && isDbAvailable()) indexInBackground(toIndex)

    if (toRetag.length > 0 && isDbAvailable()) {
      // 🔥 se: primeira carga (cursor *) OU ainda tem jobs 🔥 pendentes na fila
      // 💤 se: já passou das 5 primeiras páginas E fila 🔥 zerou
      const isFirstLoad = cursor === "*"
      const stillHighPriority = _highPriorityCount > 0
      const priority: 1 | 2 = (isFirstLoad || stillHighPriority) ? 1 : 2
      enqueueTagJob(toRetag, priority)
    }

    return NextResponse.json({
      wallpapers: finalWallpapers,
      nextCursor,
      total: finalWallpapers.length,
    })
  } catch (err) {
    console.error("Erro na busca:", err)
    return NextResponse.json({ error: "Erro ao buscar wallpapers" }, { status: 500 })
  }
}

// Salva wallpapers NOVOS no banco — usa ignoreDuplicates pra não sobrescrever
// título traduzido ou ai_tags que já existem
async function indexInBackground(items: { wallpaper: Wallpaper; titleOriginal: string; authorAvatar: string }[]) {
  try {
    const dbItems = items
      .filter(({ wallpaper }) => wallpaper.title && wallpaper.previewUrl)
      .map(({ wallpaper, titleOriginal, authorAvatar }) => toDbWallpaper(wallpaper, [], titleOriginal, authorAvatar))

    await insertNewWallpapers(dbItems)
    console.log(`✓ Indexados ${dbItems.length} wallpapers novos`)
  } catch (err) {
    console.error("Erro ao indexar:", err)
  }
}

// ─── Fila de tagging com prioridade ──────────────────────────────────────────

interface TagJob {
  wallpaper: Wallpaper
  titleOriginal: string
  authorAvatar: string
  priority: 1 | 2
}

const _tagQueue: TagJob[] = []
const _taggingInProgress = new Set<number>()
let _workerRunning = false
let _highPriorityCount = 0  // quantos jobs 🔥 ainda estão pendentes ou em processo

function enqueueTagJob(items: { wallpaper: Wallpaper; titleOriginal: string; authorAvatar: string }[], priority: 1 | 2) {
  for (const item of items) {
    const id = item.wallpaper.id
    if (_taggingInProgress.has(id)) continue
    const existing = _tagQueue.findIndex(j => j.wallpaper.id === id)
    if (existing >= 0) {
      // Promove pra alta se necessário
      if (priority < _tagQueue[existing].priority) {
        if (_tagQueue[existing].priority === 2 && priority === 1) _highPriorityCount++
        _tagQueue[existing].priority = priority
      }
      continue
    }
    _tagQueue.push({ ...item, priority })
    if (priority === 1) _highPriorityCount++
  }
  // Prioridade 1 sempre na frente
  _tagQueue.sort((a, b) => a.priority - b.priority)
  startWorker()
}

async function startWorker() {
  if (_workerRunning) return
  _workerRunning = true

  while (_tagQueue.length > 0) {
    const job = _tagQueue.shift()!
    if (_taggingInProgress.has(job.wallpaper.id)) {
      if (job.priority === 1) _highPriorityCount = Math.max(0, _highPriorityCount - 1)
      continue
    }

    _taggingInProgress.add(job.wallpaper.id)
    try {
      const { tags: aiTags, nsfw, reviewFlags } = await detectTagsWithQwen(job.wallpaper.previewUrl, job.wallpaper.title)
      if (aiTags.length > 0) {
        const dbCache = await getWallpapersByIds([job.wallpaper.id])
        const existing = dbCache.get(job.wallpaper.id)
        const base = existing ?? toDbWallpaper(job.wallpaper, [], job.titleOriginal, job.authorAvatar)
        await upsertWallpapers([{
          ...base,
          ai_tags: aiTags,
          is_nsfw: base.is_nsfw || nsfw, // nunca "rebaixa" um NSFW já marcado pela Steam
          tagged_at: new Date().toISOString(),
          review_flags: reviewFlags,
          // backfill: se o banco não tinha autor salvo mas a Steam retornou agora, preenche
          author_id: base.author_id || job.wallpaper.authorId,
          author_name: base.author_name || job.wallpaper.authorName,
          author_avatar: base.author_avatar || job.authorAvatar,
        }])
        const pLabel = job.priority === 1 ? "🔥" : "💤"
        const remaining = job.priority === 1 ? ` (${_highPriorityCount - 1} 🔥 restantes)` : ""
        const flagNote = reviewFlags.length > 0 ? ` ⚠ revisar: ${reviewFlags.join(", ")}` : ""
        console.log(`  ${pLabel} [${job.wallpaper.id}] "${job.wallpaper.title.slice(0, 35)}" → ${aiTags.slice(0, 5).join(", ")}...${remaining}${flagNote}`)
      }
    } catch { /* ignora */ } finally {
      _taggingInProgress.delete(job.wallpaper.id)
      if (job.priority === 1) _highPriorityCount = Math.max(0, _highPriorityCount - 1)
    }

    if (_tagQueue.length > 0) await new Promise(r => setTimeout(r, 300))
  }

  _workerRunning = false
}