// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { SteamWorkshopItem, Wallpaper } from "@/types/wallpaper"

const WALLPAPER_ENGINE_APP_ID = "431960"
const STEAM_API_BASE = "https://api.steampowered.com"

export type WallpaperType = "all" | "Scene" | "Application" | "Video"
export type SortMode = "recent" | "subscribed" | "popular_week" | "popular_month" | "popular_3months" | "popular_6months" | "popular_year" | "popular_alltime"

function getQueryType(sort: SortMode): string {
  if (sort === "recent") return "1"           // RankedByPublicationDate
  if (sort === "subscribed") return "9"       // RankedByTotalUniqueSubscriptions
  return "3"                                  // RankedByTrend para todos os populares
}

function getTrendDays(sort: SortMode): string | null {
  if (sort === "popular_week") return "7"
  if (sort === "popular_month") return "30"
  if (sort === "popular_3months") return "90"
  if (sort === "popular_6months") return "180"
  if (sort === "popular_year") return "365"
  if (sort === "popular_alltime") return "9999" // máximo — equivalente a "desde sempre"
  return null
}

export async function searchSteamWallpapers(
  query: string,
  sort: SortMode = "popular_alltime",
  cursor: string = "*",
  maxPages: number = 5
): Promise<{ items: SteamWorkshopItem[]; nextCursor: string | null }> {
  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) {
    console.warn("⚠️  STEAM_API_KEY não configurada no .env.local")
    return { items: [], nextCursor: null }
  }

  const allItems: SteamWorkshopItem[] = []
  let currentCursor = cursor
  let lastCursor: string | null = null

  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams({
      key: apiKey,
      appid: WALLPAPER_ENGINE_APP_ID,
      numperpage: "100",
      return_tags: "1",
      return_previews: "1",
      return_vote_data: "1",
      return_metadata: "1",
      query_type: getQueryType(sort),
      cursor: currentCursor,
      search_text: query,
    })

    const trendDays = getTrendDays(sort)
    if (trendDays) params.set("days", trendDays)

    const res = await fetch(`${STEAM_API_BASE}/IPublishedFileService/QueryFiles/v1/?${params}`)
    if (!res.ok) break

    const data = await res.json()
    const items: SteamWorkshopItem[] = data?.response?.publishedfiledetails ?? []
    const nextCursor: string = data?.response?.next_cursor ?? ""

    allItems.push(...items)

    if (!nextCursor || nextCursor === currentCursor || items.length === 0) {
      lastCursor = null
      break
    }

    lastCursor = nextCursor
    currentCursor = nextCursor
  }

  const seen = new Set<string>()
  const deduped = allItems.filter((item) => {
    if (seen.has(item.publishedfileid)) return false
    seen.add(item.publishedfileid)
    return true
  })

  return { items: deduped, nextCursor: lastCursor }
}

// Traduz título com Google Translate (só CJK)
export async function translateTitle(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) return text
  const hasCJK = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)
  if (!hasCJK) return text
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: "en", format: "text" }),
      }
    )
    const data = await res.json()
    return data?.data?.translations?.[0]?.translatedText ?? text
  } catch { return text }
}

// Detecta tags + nsfw + avisos de revisão via servidor local Qwen
// (lunaris-tagger/tagger_server.py)
export interface QwenTagResult {
  tags: string[]
  nsfw: boolean
  reviewFlags: string[]
}

export async function detectTagsWithQwen(previewUrl: string, title: string = ""): Promise<QwenTagResult> {
  const empty: QwenTagResult = { tags: [], nsfw: false, reviewFlags: [] }

  // Modo dev: desabilita o tagger sem logar erro
  if (process.env.TAGGER_ENABLED !== "true") return empty

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 300_000) // 5 minutos

    const res = await fetch("http://127.0.0.1:8000/tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: previewUrl, threshold: 0.15, title }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return empty

    const data: { tags?: string[]; nsfw?: boolean; review_flags?: string[]; error?: string } = await res.json()
    if (data.error) { console.warn("Tagger:", data.error); return empty }

    return {
      tags: data.tags ?? [],
      nsfw: data.nsfw ?? false,
      reviewFlags: data.review_flags ?? [],
    }
  } catch (e) {
    console.warn("Tagger indisponível:", e)
    return empty
  }
}

/** @deprecated use detectTagsWithQwen — mantido só pra não quebrar chamadas antigas */
export async function detectTagsWithWD14(previewUrl: string, title: string = ""): Promise<string[]> {
  const { tags } = await detectTagsWithQwen(previewUrl, title)
  return tags
}

// Detecta NSFW via servidor local
export async function detectNsfwWithWD14(previewUrl: string): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:8000/tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: previewUrl, threshold: 0.5 }),
    })
    if (!res.ok) return false
    const data: { tags?: string[]; nsfw?: boolean } = await res.json()
    return data.nsfw ?? false
  } catch { return false }
}

export function extractTagsFromItem(item: SteamWorkshopItem): string[] {
  const steamTags = item.tags?.map((t) => t.tag.toLowerCase()) ?? []

  const tagMap: Record<string, string[]> = {
    anime:    ["anime", "manga", "waifu", "2d"],
    cute:     ["cute", "kawaii", "chibi"],
    dark:     ["dark", "horror", "gothic"],
    nature:   ["nature", "landscape", "forest", "sky"],
    animated: ["animated", "live", "moving", "particle", "video"],
    custom:   ["customizable", "interactive", "scene"],
    purple:   ["purple", "violet"],
    blue:     ["blue", "cyan", "teal", "ocean"],
    pink:     ["pink", "rose", "sakura"],
  }

  const detected = new Set<string>()
  for (const [ourTag, keywords] of Object.entries(tagMap)) {
    if (keywords.some((kw) => steamTags.includes(kw))) detected.add(ourTag)
  }
  return Array.from(detected)
}

export function mapSteamItemToWallpaper(item: SteamWorkshopItem): Wallpaper {
  const steamTags = item.tags?.map((t) => t.tag) ?? []
  const steamTagsLower = steamTags.map((t) => t.toLowerCase())
  const tags = extractTagsFromItem(item)
  const isNsfw = item.maybe_inappropriate_sex === true || steamTagsLower.includes("mature")

  return {
    id: Number(item.publishedfileid),
    title: item.title,
    previewUrl: item.preview_url,
    tags,
    steamTags,
    userTags: [],
    downloads: item.subscriptions ?? 0,
    isAnimated: tags.includes("animated"),
    isNsfw,
    authorName: "", // preenchido depois via fetchAuthorInfo (precisa do creator)
    authorId: item.creator ?? "",
    authorAvatar: "", // preenchido depois via fetchAuthorInfo
    steamUrl: `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedfileid}`,
  }
}

// Busca nome de exibição (personaname) + foto de perfil (avatarfull) via SteamID64.
// A QueryFiles já retorna o "creator" (SteamID64) de cada item, mas não esses dados —
// isso exige uma chamada separada à ISteamUser/GetPlayerSummaries (até 100 IDs por vez).
export interface AuthorInfo {
  name: string
  avatar: string
}

export async function fetchAuthorInfo(steamIds: string[]): Promise<Map<string, AuthorInfo>> {
  const result = new Map<string, AuthorInfo>()

  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) return result

  const uniqueIds = Array.from(new Set(steamIds.filter(Boolean)))
  if (uniqueIds.length === 0) return result

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100)
    const params = new URLSearchParams({ key: apiKey, steamids: batch.join(",") })

    try {
      const res = await fetch(`${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?${params}`)
      if (!res.ok) continue

      const data = await res.json()
      const players: { steamid: string; personaname?: string; avatarfull?: string }[] = data?.response?.players ?? []
      for (const p of players) {
        result.set(p.steamid, { name: p.personaname ?? "", avatar: p.avatarfull ?? "" })
      }
    } catch (e) {
      console.warn("Erro ao buscar info de autores:", e)
    }
  }

  return result
}

/** @deprecated use fetchAuthorInfo — mantido só pra não quebrar chamadas antigas */
export async function fetchAuthorNames(steamIds: string[]): Promise<Map<string, string>> {
  const info = await fetchAuthorInfo(steamIds)
  const result = new Map<string, string>()
  for (const [id, { name }] of info) result.set(id, name)
  return result
}

export function formatDownloads(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}