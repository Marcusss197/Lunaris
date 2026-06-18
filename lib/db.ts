// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197
//
// ⚠️ Este arquivo importa "@/lib/supabase" e por isso NÃO deve ser importado
// em componentes "use client" — só dentro de API routes (app/api/.../route.ts).
// Tipos e funções puras (sem dependência do supabase) ficam em
// "@/lib/db-types" e são seguros pra importar no client.

import { supabase } from "@/lib/supabase"
import {
  DbWallpaper,
  AuthorSortBy,
  AuthorProfile,
  toDbWallpaper,
  fromDbWallpaper,
} from "@/lib/db-types"

// Reexportados por compatibilidade — quem já importava esses nomes de
// "@/lib/db" continua funcionando sem precisar trocar nada (exceto
// componentes client, que devem importar de "@/lib/db-types" diretamente).
export type { DbWallpaper, AuthorSortBy, AuthorProfile }
export { toDbWallpaper, fromDbWallpaper }

// Busca wallpapers já indexados por lista de IDs
export async function getWallpapersByIds(ids: number[]): Promise<Map<number, DbWallpaper>> {
  if (!supabase || ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from("wallpapers")
    .select("*")
    .in("id", ids)

  if (error || !data) return new Map()

  return new Map(data.map((w: DbWallpaper) => [w.id, w]))
}

const SEARCH_STOPWORDS = new Set([
  "the","a","an","of","and","or","in","on","at","to","for","with","from",
  "is","as","this","that","by","de","da","do","das","dos","com","para","em"
])

// Busca wallpapers no banco por texto — título, ai_tags e user_tags
// Query única combinando todas as palavras
export async function searchWallpapersInDb(
  query: string,
  limit: number = 100
): Promise<DbWallpaper[]> {
  if (!supabase || !query.trim()) return []

  const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2 && !SEARCH_STOPWORDS.has(w))
  if (words.length === 0) return []

  const orFilter = words
    .map(w => `title.ilike.%${w}%,ai_tags.cs.{${w}},user_tags.cs.{${w}},steam_tags.cs.{${w}}`)
    .join(",")

  const { data, error } = await supabase
    .from("wallpapers")
    .select("*")
    .or(orFilter)
    .gte("downloads", 150)
    .order("downloads", { ascending: false })
    .limit(500)

  if (error) {
    console.error("Erro na busca no banco:", error.message)
    return []
  }

  const results = (data ?? []) as DbWallpaper[]

  const scored = results.map(w => {
    const titleLower = w.title.toLowerCase()
    const allTags = [...(w.ai_tags ?? []), ...(w.user_tags ?? []), ...(w.steam_tags ?? [])]
      .map(t => t.toLowerCase())

    let score = 0
    for (const word of words) {
      if (titleLower.includes(word)) score += 100
      if (allTags.some(t => t.includes(word))) score += 1
    }

    return { wallpaper: w, score }
  })

  return scored
    .sort((a, b) => b.score - a.score || b.wallpaper.downloads - a.wallpaper.downloads)
    .slice(0, limit)
    .map(s => s.wallpaper)
}

// Salva wallpapers novos — ignora se já existir (preserva título traduzido e tags)
export async function insertNewWallpapers(wallpapers: DbWallpaper[]): Promise<void> {
  if (!supabase || wallpapers.length === 0) return

  const { error } = await supabase
    .from("wallpapers")
    .upsert(wallpapers, { onConflict: "id", ignoreDuplicates: true })

  if (error) console.error("Erro ao inserir novos:", error.message)
}

// Salva ou atualiza wallpapers no banco (upsert completo — usa só pro tagger)
export async function upsertWallpapers(wallpapers: DbWallpaper[]): Promise<void> {
  if (!supabase || wallpapers.length === 0) return

  const { error } = await supabase
    .from("wallpapers")
    .upsert(wallpapers, { onConflict: "id", ignoreDuplicates: false })

  if (error) console.error("Erro ao salvar no banco:", error.message, error.details, error.hint)
}

// ─── /api/organize-tags ─────────────────────────────────────────────────────

export type OrganizeSortBy = "tagged_at" | "downloads" | "indexed_at"

export async function searchWallpapersForOrganize(
  query: string,
  limit: number = 60,
  offset: number = 0,
  opts: {
    onlyFlagged?: boolean
    nsfwOnly?: boolean
    withTagsOnly?: boolean
    excludeTags?: string[]
    sortBy?: OrganizeSortBy
  } = {}
): Promise<{ data: DbWallpaper[]; hasMore: boolean }> {
  if (!supabase) return { data: [], hasMore: false }

  const { onlyFlagged = false, nsfwOnly = false, withTagsOnly = false, excludeTags = [], sortBy = "tagged_at" } = opts

  const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2 && !SEARCH_STOPWORDS.has(w))

  let q = supabase.from("wallpapers").select("*")

  if (words.length > 0) {
    const orFilter = words
      .map(w => `title.ilike.%${w}%,ai_tags.cs.{${w}},user_tags.cs.{${w}},steam_tags.cs.{${w}}`)
      .join(",")
    q = q.or(orFilter)
  }

  if (onlyFlagged) {
    q = q.not("review_flags", "eq", "{}")
  }

  if (nsfwOnly) {
    q = q.eq("is_nsfw", true)
  }

  if (withTagsOnly) {
    q = q.or("ai_tags.neq.{},user_tags.neq.{}")
  }

  for (const raw of excludeTags) {
    const tag = raw.toLowerCase().trim()
    if (!tag) continue
    q = q.not("ai_tags", "cs", `{${tag}}`)
    q = q.not("user_tags", "cs", `{${tag}}`)
  }

  q = q.order(sortBy, { ascending: false, nullsFirst: false })

  const { data, error } = await q.range(offset, offset + limit)

  if (error) {
    console.error("Erro em searchWallpapersForOrganize:", error.message)
    return { data: [], hasMore: false }
  }

  const rows = (data ?? []) as DbWallpaper[]
  const hasMore = rows.length > limit
  return { data: rows.slice(0, limit), hasMore }
}

// Edição em massa: adiciona/remove tags de ai_tags e/ou ajusta is_nsfw
export async function bulkUpdateWallpapers(
  ids: number[],
  opts: { addTags?: string[]; removeTags?: string[]; isNsfw?: boolean }
): Promise<{ updated: number; error?: string }> {
  if (!supabase || ids.length === 0) return { updated: 0 }

  const { addTags = [], removeTags = [] } = opts
  const addSet = new Set(addTags.map(t => t.toLowerCase().trim()).filter(Boolean))
  const removeSet = new Set(removeTags.map(t => t.toLowerCase().trim()).filter(Boolean))

  const { data, error } = await supabase
    .from("wallpapers")
    .select("id, ai_tags")
    .in("id", ids)

  if (error || !data) return { updated: 0, error: error?.message }

  let updated = 0
  for (const row of data as { id: number; ai_tags: string[] | null }[]) {
    const current = new Set((row.ai_tags ?? []).map(t => t.toLowerCase().trim()))
    for (const t of addSet) current.add(t)
    for (const t of removeSet) current.delete(t)

    const payload: Record<string, unknown> = { ai_tags: Array.from(current) }
    if (opts.isNsfw !== undefined) payload.is_nsfw = opts.isNsfw

    const { error: updErr } = await supabase.from("wallpapers").update(payload).eq("id", row.id)
    if (updErr) {
      console.error(`Erro ao atualizar wallpaper ${row.id}:`, updErr.message)
      continue
    }
    updated++
  }

  return { updated }
}

// ─── /api/refresh-author ────────────────────────────────────────────────────

export async function refreshAuthorInfo(authorId: string, name: string, avatar: string): Promise<{ updated: number; error?: string }> {
  if (!supabase || !authorId || authorId === "unknown") return { updated: 0 }

  const { data, error } = await supabase
    .from("wallpapers")
    .update({
      author_name: name,
      author_avatar: avatar,
      author_updated_at: new Date().toISOString(),
    })
    .eq("author_id", authorId)
    .select("id")

  if (error) return { updated: 0, error: error.message }
  return { updated: data?.length ?? 0 }
}

// ─── /u/[id] ─────────────────────────────────────────────────────────────────

export async function getAuthorProfile(authorId: string): Promise<AuthorProfile | null> {
  if (!supabase || !authorId) return null

  const { data, error } = await supabase
    .from("wallpapers")
    .select("author_name, author_avatar, ai_tags, user_tags")
    .eq("author_id", authorId)

  if (error || !data || data.length === 0) return null

  const rows = data as { author_name: string; author_avatar: string; ai_tags: string[] | null; user_tags: string[] | null }[]

  const tagCounts = new Map<string, number>()
  for (const row of rows) {
    for (const t of [...(row.ai_tags ?? []), ...(row.user_tags ?? [])]) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }

  const topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const withName = rows.find(r => r.author_name)
  const withAvatar = rows.find(r => r.author_avatar)

  return {
    authorId,
    authorName: withName?.author_name ?? "",
    authorAvatar: withAvatar?.author_avatar ?? "",
    wallpaperCount: rows.length,
    topTags,
  }
}

export async function getAuthorWallpapers(
  authorId: string,
  opts: { sortBy?: AuthorSortBy; tag?: string; limit?: number; offset?: number } = {}
): Promise<{ data: DbWallpaper[]; hasMore: boolean }> {
  if (!supabase || !authorId) return { data: [], hasMore: false }

  const { sortBy = "downloads", tag, limit = 60, offset = 0 } = opts

  let q = supabase.from("wallpapers").select("*").eq("author_id", authorId)

  if (tag) {
    q = q.or(`ai_tags.cs.{${tag}},user_tags.cs.{${tag}},steam_tags.cs.{${tag}}`)
  }

  const orderColumn = sortBy === "downloads" ? "downloads" : "id"
  q = q.order(orderColumn, { ascending: false, nullsFirst: false })

  const { data, error } = await q.range(offset, offset + limit)

  if (error) {
    console.error("Erro em getAuthorWallpapers:", error.message)
    return { data: [], hasMore: false }
  }

  const rows = (data ?? []) as DbWallpaper[]
  const hasMore = rows.length > limit
  return { data: rows.slice(0, limit), hasMore }
}