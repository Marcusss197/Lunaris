// Lunaris - busca wallpapers no banco por tags ai_tags ou título
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { Wallpaper } from "@/types/wallpaper"

export async function GET(req: NextRequest) {
  if (!supabase) return NextResponse.json({ wallpapers: [] })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")?.toLowerCase().trim() ?? ""

  if (!query) return NextResponse.json({ wallpapers: [] })

  try {
    // Busca por ai_tags que contenham o termo OU título que contenha o termo
    const { data, error } = await supabase
      .from("wallpapers")
      .select("*")
      .or(`title.ilike.%${query}%,ai_tags.cs.{${query}}`)
      .gte("downloads", 150)
      .order("downloads", { ascending: false })
      .limit(200)

    if (error || !data) return NextResponse.json({ wallpapers: [] })

    const wallpapers: Wallpaper[] = data.map((w) => ({
      id: w.id,
      title: w.title,
      previewUrl: w.preview_url,
      tags: w.ai_tags ?? [],
      steamTags: w.steam_tags ?? [],
      downloads: w.downloads,
      isAnimated: w.is_animated,
      isNsfw: w.is_nsfw,
      authorName: w.author_name ?? "",
      steamUrl: w.steam_url,
    }))

    return NextResponse.json({ wallpapers, total: wallpapers.length })
  } catch (err) {
    console.error("Erro na busca DB:", err)
    return NextResponse.json({ wallpapers: [] })
  }
}
