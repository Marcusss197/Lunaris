// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { supabase } from "@/lib/supabase"
import { Wallpaper } from "@/types/wallpaper"

export interface DbWallpaper {
  id: number
  title: string
  title_original: string
  preview_url: string
  author_id: string
  author_name: string
  steam_tags: string[]
  ai_tags: string[]
  downloads: number
  is_nsfw: boolean
  is_animated: boolean
  steam_url: string
  steam_created_at: number | null
  indexed_at: string
}

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

// Salva ou atualiza wallpapers no banco (upsert)
export async function upsertWallpapers(wallpapers: DbWallpaper[]): Promise<void> {
  if (!supabase || wallpapers.length === 0) return

  const { error } = await supabase
    .from("wallpapers")
    .upsert(wallpapers, { onConflict: "id", ignoreDuplicates: false })

  if (error) console.error("Erro ao salvar no banco:", error.message, error.details, error.hint)
}

// Converte Wallpaper do frontend para formato do banco
export function toDbWallpaper(w: Wallpaper, aiTags: string[], titleOriginal: string): DbWallpaper {
  return {
    id: w.id,
    title: w.title,
    title_original: titleOriginal,
    preview_url: w.previewUrl,
    author_id: "",
    author_name: w.authorName,
    steam_tags: w.steamTags,
    ai_tags: aiTags,
    downloads: w.downloads,
    is_nsfw: w.isNsfw,
    is_animated: w.isAnimated,
    steam_url: w.steamUrl,
    steam_created_at: null,
    indexed_at: new Date().toISOString(),
  }
}

// Converte DbWallpaper para formato do frontend
export function fromDbWallpaper(w: DbWallpaper): Wallpaper {
  return {
    id: w.id,
    title: w.title,
    previewUrl: w.preview_url,
    tags: w.ai_tags.length > 0 ? w.ai_tags : [],
    steamTags: w.steam_tags,
    downloads: w.downloads,
    isAnimated: w.is_animated,
    isNsfw: w.is_nsfw,
    authorName: w.author_name,
    steamUrl: w.steam_url,
  }
}
