// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { SteamWorkshopItem, Wallpaper } from "@/types/wallpaper"

const WALLPAPER_ENGINE_APP_ID = "431960"
const STEAM_API_BASE = "https://api.steampowered.com"

export type WallpaperType = "all" | "Scene" | "Application" | "Video"
export type SortMode = "recent" | "subscribed" | "popular_week" | "popular_month" | "popular_3months" | "popular_year" | "popular_alltime"

function getQueryType(sort: SortMode): string {
  if (sort === "recent") return "1"
  if (sort === "subscribed") return "0"
  return "12"
}

function getTrendDays(sort: SortMode): string | null {
  if (sort === "popular_week") return "7"
  if (sort === "popular_month") return "30"
  if (sort === "popular_3months") return "90"
  if (sort === "popular_year") return "365"
  if (sort === "popular_alltime") return "9999"
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

// Traduz título com DeepL (só CJK)
export async function translateTitle(text: string, targetLang: string = "PT-BR"): Promise<string> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return text
  const hasCJK = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)
  if (!hasCJK) return text
  try {
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text], target_lang: targetLang }),
    })
    const data = await res.json()
    return data?.translations?.[0]?.text ?? text
  } catch { return text }
}

// Detecta tags via Gemini Flash analisando a preview do wallpaper
export async function detectTagsWithGemini(previewUrl: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  try {
    const imageData = await fetchImageAsBase64(previewUrl)
    if (!imageData) return []

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: "image/jpeg", data: imageData } },
              {
                text: `You are a content tagging system for an adult wallpaper platform similar to Rule34 or Danbooru.
Your job is to tag wallpaper images ACCURATELY and COMPLETELY, including explicit content.
Do NOT skip, censor, or omit NSFW tags. Explicit and fetish content MUST be tagged correctly.

Return ONLY a raw JSON array of strings. No explanation, no markdown, no backticks.

Tag categories to consider:

STYLE: anime, realistic, pixel-art, watercolor, 3d-render, minimalist, abstract, sketch, painted, digital-art, retro, vaporwave, lofi, dark-fantasy, cyberpunk

COLOR: purple, blue, pink, red, green, orange, yellow, black, white, pastel, colorful, monochrome, gradient

SUBJECT - General: nature, landscape, space, ocean, forest, city, architecture, food, animals
SUBJECT - Character: female, male, non-binary, multiple-characters, solo
SUBJECT - Body (tag if visible): big-breasts, small-breasts, ass, thighs, midriff, abs, tall, petite, muscular
SUBJECT - Clothing: nude, topless, lingerie, swimsuit, uniform, kimono, maid, catgirl, bunnysuit, latex, armor, school-uniform, bikini, thigh-highs, pantyhose, no-panties
SUBJECT - Species/type: human, elf, demon, angel, monster-girl, furry, kemonomimi, android, vampire

MOOD/THEME: cute, sexy, romantic, dark, mysterious, epic, cozy, energetic, horror, gore

NSFW/EXPLICIT (tag honestly if present):
- ecchi, nsfw, explicit, nudity
- sex, oral, anal, vaginal, gangbang, threesome, yuri, yaoi, futanari
- fetish tags: bdsm, bondage, tentacles, vore, giantess, feet, femboy, trap, inflation, lactation, ahegao, mind-control, rape, netorare, incest, loli (if clearly underage-styled), shota (if clearly underage-styled)

Return max 12 tags, most relevant first.
Example for explicit content: ["anime","female","nude","big-breasts","nsfw","explicit","bdsm","bondage","lingerie","pink","solo","ecchi"]
Example for safe content: ["anime","female","cute","blue","kimono","solo","pastel","watercolor"]`
              }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 150 },
          safetySettings: [
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ]
        })
      }
    )

    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]"
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed.map((t: unknown) => String(t).toLowerCase()) : []
  } catch { return [] }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  return Buffer.from(buffer).toString("base64")
}

// Detecta tags via WD SwinV2 Tagger V3 (Hugging Face)
// Modelo especializado em anime/ilustração — muito mais consistente que LLMs pra tagging
export async function detectTagsWithWD14(previewUrl: string): Promise<string[]> {
  const apiKey = process.env.HF_API_KEY
  if (!apiKey) return []

  try {
    const imageRes = await fetch(previewUrl)
    if (!imageRes.ok) return []
    const imageBlob = await imageRes.blob()

    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/SmilingWolf/wd-swinv2-tagger-v3",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/octet-stream",
        },
        body: imageBlob,
      }
    )

    if (!res.ok) {
      console.warn("WD14 não respondeu:", res.status)
      return []
    }

    const data: Record<string, number> = await res.json()

    return Object.entries(data)
      .filter(([tag, score]) => score > 0.35 && !tag.startsWith("rating/"))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([tag]) => tag.replace(/_/g, " "))
  } catch (err) {
    console.error("Erro no WD14:", err)
    return []
  }
}

// Detecta rating NSFW via WD SwinV2 Tagger V3
export async function detectNsfwWithWD14(previewUrl: string): Promise<boolean> {
  const apiKey = process.env.HF_API_KEY
  if (!apiKey) return false

  try {
    const imageRes = await fetch(previewUrl)
    if (!imageRes.ok) return false
    const imageBlob = await imageRes.blob()

    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/SmilingWolf/wd-swinv2-tagger-v3",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/octet-stream",
        },
        body: imageBlob,
      }
    )

    if (!res.ok) return false

    const data: Record<string, number> = await res.json()
    const explicit = data["rating/explicit"] ?? 0
    const questionable = data["rating/questionable"] ?? 0

    return explicit > 0.5 || questionable > 0.7
  } catch {
    return false
  }
}
export function extractTagsFromItem(item: SteamWorkshopItem): string[] {
  const steamTags = item.tags?.map((t) => t.tag.toLowerCase()) ?? []

  const tagMap: Record<string, string[]> = {
    anime: ["anime", "manga", "waifu", "2d"],
    cute: ["cute", "kawaii", "chibi"],
    dark: ["dark", "horror", "gothic"],
    nature: ["nature", "landscape", "forest", "sky"],
    animated: ["animated", "live", "moving", "particle", "video"],
    custom: ["customizable", "interactive", "scene"],
    purple: ["purple", "violet"],
    blue: ["blue", "cyan", "teal", "ocean"],
    pink: ["pink", "rose", "sakura"],
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
    downloads: item.subscriptions ?? 0,
    isAnimated: tags.includes("animated"),
    isNsfw,
    authorName: "",
    steamUrl: `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedfileid}`,
  }
}

export function formatDownloads(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
