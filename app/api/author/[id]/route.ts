// Lunaris - Perfil de autor
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197
//
// GET /api/author/[id]?sort=downloads&tag=cyberpunk&offset=0&limit=60
// -> { profile: AuthorProfile, wallpapers: DbWallpaper[], hasMore: boolean }

import { NextRequest, NextResponse } from "next/server"
import { getAuthorProfile, getAuthorWallpapers, AuthorSortBy } from "@/lib/db"

const VALID_SORTS: AuthorSortBy[] = ["downloads", "recent"]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || id === "unknown") {
    return NextResponse.json({ error: "autor inválido" }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const offset = Number(searchParams.get("offset") ?? "0")
  const limit = Math.min(Number(searchParams.get("limit") ?? "60"), 100)
  const tag = searchParams.get("tag") ?? undefined

  const sortParam = searchParams.get("sort") ?? "downloads"
  const sortBy = (VALID_SORTS as string[]).includes(sortParam) ? (sortParam as AuthorSortBy) : "downloads"

  const profile = await getAuthorProfile(id)
  if (!profile) {
    return NextResponse.json({ error: "autor não encontrado" }, { status: 404 })
  }

  const { data, hasMore } = await getAuthorWallpapers(id, { sortBy, tag, limit, offset })

  return NextResponse.json({ profile, wallpapers: data, hasMore, offset, limit })
}