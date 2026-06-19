// Lunaris - Tipos e funções puras compartilhadas entre client e server.
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197
//
// IMPORTANTE: este arquivo NÃO pode importar "@/lib/supabase" nem nada que
// dependa dele. Ele existe justamente para ser seguro de importar em
// componentes "use client" (como app/u/[id]/page.tsx) sem arrastar o
// cliente do Supabase (e suas env vars de servidor) pro bundle do navegador.
// Funções que tocam o banco (supabase.from(...)) ficam em lib/db.ts, que só
// deve ser importado dentro de API routes (app/api/.../route.ts).

import { Wallpaper } from "@/types/wallpaper"

export interface DbWallpaper {
  id: number
  title: string
  title_original: string
  preview_url: string
  author_id: string
  author_name: string
  author_avatar: string
  steam_tags: string[]
  ai_tags: string[]
  user_tags: string[]
  pending_tags: string[]
  downloads: number
  is_nsfw: boolean
  is_animated: boolean
  steam_url: string
  steam_created_at: number | null
  indexed_at: string
  tagged_at: string | null
  review_flags: string[]
  author_updated_at: string | null
}

export type AuthorSortBy = "downloads" | "recent"
export type OrganizeSortBy = "tagged_at" | "downloads" | "indexed_at"

export interface AuthorProfile {
  authorId: string
  authorName: string
  authorAvatar: string
  wallpaperCount: number
  topTags: { tag: string; count: number }[]
}

// Converte Wallpaper do frontend para formato do banco
export function toDbWallpaper(w: Wallpaper, aiTags: string[], titleOriginal: string, authorAvatar: string = ""): DbWallpaper {
  return {
    id: w.id,
    title: w.title,
    title_original: titleOriginal,
    preview_url: w.previewUrl,
    author_id: w.authorId ?? "",
    author_name: w.authorName,
    author_avatar: authorAvatar,
    steam_tags: w.steamTags,
    ai_tags: aiTags,
    user_tags: w.userTags ?? [],
    pending_tags: [],
    downloads: w.downloads,
    is_nsfw: w.isNsfw,
    is_animated: w.isAnimated,
    steam_url: w.steamUrl,
    steam_created_at: null,
    indexed_at: new Date().toISOString(),
    tagged_at: null,
    review_flags: [],
    author_updated_at: null,
  }
}

export function fromDbWallpaper(w: DbWallpaper): Wallpaper {
  return {
    id: w.id,
    title: w.title,
    previewUrl: w.preview_url,
    tags: w.ai_tags ?? [],
    steamTags: w.steam_tags ?? [],
    userTags: w.user_tags ?? [],
    downloads: w.downloads,
    isAnimated: w.is_animated,
    isNsfw: w.is_nsfw,
    authorName: w.author_name,
    authorId: w.author_id,
    authorAvatar: w.author_avatar,
    steamUrl: w.steam_url,
  }
}