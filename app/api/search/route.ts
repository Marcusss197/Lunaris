// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextRequest, NextResponse } from "next/server"
import {
  searchSteamWallpapers,
  translateTitle,
  mapSteamItemToWallpaper,
  detectTagsWithWD14,
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

    // ── 2. Busca no banco pelos IDs da Steam ──────────────────────────────────
    const steamIds = steamWallpapers.map((w) => w.wallpaper.id)
    const dbCache  = isDbAvailable() ? await getWallpapersByIds(steamIds) : new Map()

    // ── 3. Busca no banco por texto (título + tags) ───────────────────────────
    // Roda em paralelo com o merge da Steam
    const dbTextResults = isDbAvailable() && query.trim()
      ? await searchWallpapersInDb(query, 100)
      : []

    // ── 4. Merge Steam com dados do banco ─────────────────────────────────────
    const toIndex: { wallpaper: Wallpaper; titleOriginal: string }[] = []
    const toRetag: { wallpaper: Wallpaper; titleOriginal: string }[] = []

    // Map final: id → Wallpaper (sem duplicatas)
    const merged = new Map<number, Wallpaper>()

    for (const { wallpaper, titleOriginal } of steamWallpapers) {
      const cached = dbCache.get(wallpaper.id)
      if (cached) {
        // Usa dados do banco (título traduzido, tags IA/user)
        // Preview: prefere o da Steam se for mais recente (Steam tem URL fresco)
        const merged_w = fromDbWallpaper(cached)
        merged_w.previewUrl = wallpaper.previewUrl // sempre URL fresca da Steam
        merged_w.downloads  = wallpaper.downloads  // downloads sempre da Steam
        merged.set(wallpaper.id, merged_w)

        if (cached.ai_tags.length === 0) toRetag.push({ wallpaper, titleOriginal })
      } else {
        merged.set(wallpaper.id, wallpaper)
        toIndex.push({ wallpaper, titleOriginal })
      }
    }

    // ── 5. Adiciona resultados do banco que não vieram da Steam ───────────────
    for (const dbItem of dbTextResults) {
      if (!merged.has(dbItem.id) && dbItem.downloads >= 150) {
        merged.set(dbItem.id, fromDbWallpaper(dbItem))
      }
    }

    // ── 6. Filtra e ordena ────────────────────────────────────────────────────
    const allMerged = Array.from(merged.values()).filter(w => w.previewUrl && w.downloads >= 150)
    const finalWallpapers = sort === "recent"
      ? allMerged
      : allMerged.sort((a, b) => b.downloads - a.downloads)

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
async function indexInBackground(items: { wallpaper: Wallpaper; titleOriginal: string }[]) {
  try {
    const dbItems = items
      .filter(({ wallpaper }) => wallpaper.title && wallpaper.previewUrl)
      .map(({ wallpaper, titleOriginal }) => toDbWallpaper(wallpaper, [], titleOriginal))

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
  priority: 1 | 2
}

const _tagQueue: TagJob[] = []
const _taggingInProgress = new Set<number>()
let _workerRunning = false
let _highPriorityCount = 0  // quantos jobs 🔥 ainda estão pendentes ou em processo

function enqueueTagJob(items: { wallpaper: Wallpaper; titleOriginal: string }[], priority: 1 | 2) {
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
      const aiTags = await detectTagsWithWD14(job.wallpaper.previewUrl, job.wallpaper.title)
      if (aiTags.length > 0) {
        const dbCache = await getWallpapersByIds([job.wallpaper.id])
        const existing = dbCache.get(job.wallpaper.id)
        const base = existing ?? toDbWallpaper(job.wallpaper, [], job.titleOriginal)
        await upsertWallpapers([{ ...base, ai_tags: aiTags }])
        const pLabel = job.priority === 1 ? "🔥" : "💤"
        const remaining = job.priority === 1 ? ` (${_highPriorityCount - 1} 🔥 restantes)` : ""
        console.log(`  ${pLabel} [${job.wallpaper.id}] "${job.wallpaper.title.slice(0, 35)}" → ${aiTags.slice(0, 5).join(", ")}...${remaining}`)
      }
    } catch { /* ignora */ } finally {
      _taggingInProgress.delete(job.wallpaper.id)
      if (job.priority === 1) _highPriorityCount = Math.max(0, _highPriorityCount - 1)
    }

    if (_tagQueue.length > 0) await new Promise(r => setTimeout(r, 300))
  }

  _workerRunning = false
}