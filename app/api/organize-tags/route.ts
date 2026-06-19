// Lunaris - Organização manual de tags
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197
//
// GET  /api/organize-tags?q=cyberpunk&offset=0&limit=60&flagged=1&nsfw=1&withTags=1&pending=1&exclude=anime,furry&sort=downloads
//      -> lista wallpapers pra revisão/edição manual
//         sem "q": ordena por "sort" (tagged_at | downloads | indexed_at), padrão tagged_at
//         com "q": busca em title/ai_tags/user_tags/steam_tags, também respeita "sort"
//         flagged=1: só wallpapers com review_flags pendente
//         nsfw=1: só wallpapers com is_nsfw=true
//         withTags=1: só wallpapers que já têm alguma tag (ai_tags ou user_tags)
//         pending=1: só wallpapers com tags sugeridas por visitantes aguardando aprovação
//         exclude=a,b: exclui wallpapers que já tenham a tag "a" OU "b"
//
// PATCH /api/organize-tags
//       body: { ids: number[], addTags?: string[], removeTags?: string[], isNsfw?: boolean }
//       -> aplica tags (em ai_tags) / flag NSFW em massa nos IDs informados
//
//       body: { action: "approve" | "reject", wallpaperId: number, tag: string }
//       -> aprova (move pending_tags → user_tags) ou rejeita (remove de
//          pending_tags) uma sugestão de tag específica de um wallpaper

import { NextRequest, NextResponse } from "next/server"
import { searchWallpapersForOrganize, bulkUpdateWallpapers, approvePendingTag, rejectPendingTag, OrganizeSortBy } from "@/lib/db"

const VALID_SORTS: OrganizeSortBy[] = ["tagged_at", "downloads", "indexed_at"]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const offset = Number(searchParams.get("offset") ?? "0")
  const limit = Math.min(Number(searchParams.get("limit") ?? "60"), 100)
  const flagged = searchParams.get("flagged") === "1"
  const nsfw = searchParams.get("nsfw") === "1"
  const withTags = searchParams.get("withTags") === "1"
  const pending = searchParams.get("pending") === "1"
  const excludeParam = searchParams.get("exclude") ?? ""
  const excludeTags = excludeParam.split(",").map(t => t.trim()).filter(Boolean)

  const sortParam = searchParams.get("sort") ?? "tagged_at"
  const sortBy = (VALID_SORTS as string[]).includes(sortParam) ? (sortParam as OrganizeSortBy) : "tagged_at"

  const { data, hasMore } = await searchWallpapersForOrganize(q, limit, offset, {
    onlyFlagged: flagged,
    nsfwOnly: nsfw,
    withTagsOnly: withTags,
    pendingOnly: pending,
    excludeTags,
    sortBy,
  })

  return NextResponse.json({
    wallpapers: data,
    hasMore,
    offset,
    limit,
  })
}

export async function PATCH(req: NextRequest) {
  let body: {
    ids?: number[]
    addTags?: string[]
    removeTags?: string[]
    isNsfw?: boolean
    action?: "approve" | "reject"
    wallpaperId?: number
    tag?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  // Ação de moderação de tag pendente (aprovar/rejeitar uma sugestão específica)
  if (body.action === "approve" || body.action === "reject") {
    if (!body.wallpaperId || !body.tag) {
      return NextResponse.json({ error: "wallpaperId e tag obrigatórios" }, { status: 400 })
    }

    const result = body.action === "approve"
      ? await approvePendingTag(body.wallpaperId, body.tag)
      : await rejectPendingTag(body.wallpaperId, body.tag)

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "erro desconhecido" }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Edição em massa (comportamento legado)
  const ids = body.ids ?? []
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids obrigatório" }, { status: 400 })
  }
  if (!body.addTags?.length && !body.removeTags?.length && body.isNsfw === undefined) {
    return NextResponse.json({ error: "nada pra atualizar (addTags, removeTags ou isNsfw)" }, { status: 400 })
  }

  const result = await bulkUpdateWallpapers(ids, {
    addTags: body.addTags,
    removeTags: body.removeTags,
    isNsfw: body.isNsfw,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: result.updated })
}