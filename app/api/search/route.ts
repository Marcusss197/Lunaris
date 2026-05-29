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
import { getWallpapersByIds, upsertWallpapers, toDbWallpaper, fromDbWallpaper } from "@/lib/db"
import { isDbAvailable } from "@/lib/supabase"
import { Wallpaper } from "@/types/wallpaper"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") ?? ""
  const sort = (searchParams.get("sort") ?? "popular_alltime") as SortMode
  const cursor = searchParams.get("cursor") ?? "*"
  const pages = Math.min(Number(searchParams.get("pages") ?? "5"), 15)

  try {
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

    const allIds = steamWallpapers.map((w) => w.wallpaper.id)
    const dbCache = isDbAvailable() ? await getWallpapersByIds(allIds) : new Map()

    const toIndex: { wallpaper: Wallpaper; titleOriginal: string }[] = []
    const toRetag: { wallpaper: Wallpaper; titleOriginal: string }[] = []
    const finalWallpapers: Wallpaper[] = []

    for (const { wallpaper, titleOriginal } of steamWallpapers) {
      const cached = dbCache.get(wallpaper.id)
      if (cached) {
        finalWallpapers.push(fromDbWallpaper(cached))
        // Já no banco mas sem ai_tags → agenda pra WD14
        if (cached.ai_tags.length === 0) toRetag.push({ wallpaper, titleOriginal })
      } else {
        finalWallpapers.push(wallpaper)
        toIndex.push({ wallpaper, titleOriginal })
      }
    }

    const filtered = finalWallpapers.filter((w) => w.downloads >= 150)

    if (toIndex.length > 0 && isDbAvailable()) indexInBackground(toIndex)
    if (toRetag.length > 0 && isDbAvailable()) retagWithWD14(toRetag)

    return NextResponse.json({ wallpapers: filtered, nextCursor, total: filtered.length })
  } catch (err) {
    console.error("Erro na busca:", err)
    return NextResponse.json({ error: "Erro ao buscar wallpapers" }, { status: 500 })
  }
}

// Salva wallpapers novos no banco — WD14 vai preencher ai_tags depois
async function indexInBackground(items: { wallpaper: Wallpaper; titleOriginal: string }[]) {
  try {
    const dbItems = items
      .filter(({ wallpaper }) => wallpaper.title && wallpaper.previewUrl)
      .map(({ wallpaper, titleOriginal }) => toDbWallpaper(wallpaper, [], titleOriginal))

    await upsertWallpapers(dbItems)
    console.log(`✓ Indexados ${dbItems.length} wallpapers`)
  } catch (err) {
    console.error("Erro ao indexar:", err)
  }
}

// Processa tags via WD14 para wallpapers sem ai_tags (máx 5 por batch com delay)
async function retagWithWD14(items: { wallpaper: Wallpaper; titleOriginal: string }[]) {
  const batch = items.slice(0, 5)
  console.log(`🏷️  WD14 tagueando ${batch.length} wallpapers...`)

  for (const { wallpaper, titleOriginal } of batch) {
    try {
      // Delay de 500ms entre cada request pro servidor local não sobrecarregar
      await new Promise((r) => setTimeout(r, 500))
      const aiTags = await detectTagsWithWD14(wallpaper.previewUrl, wallpaper.title)
      if (aiTags.length > 0) {
        await upsertWallpapers([toDbWallpaper(wallpaper, aiTags, titleOriginal)])
        console.log(`  ✓ [${wallpaper.id}] ${aiTags.slice(0, 5).join(", ")}...`)
      }
    } catch {
      
    }
  }
}