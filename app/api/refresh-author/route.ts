// Lunaris - Atualiza nome + avatar de um autor (cache refresh)
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197
//
// GET /api/refresh-author?id={steamId64}
// -> busca dados frescos na Steam (GetPlayerSummaries) e atualiza TODOS os
//    wallpapers com esse author_id de uma vez (author_name, author_avatar,
//    author_updated_at). Chamado em background pela página de detalhe quando
//    o cache está velho — não bloqueia o carregamento atual.

import { NextRequest, NextResponse } from "next/server"
import { fetchAuthorInfo } from "@/lib/steam"
import { refreshAuthorInfo } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const authorId = searchParams.get("id") ?? ""

  if (!authorId || authorId === "unknown") {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })
  }

  try {
    console.log(`[refresh-author] buscando Steam info pra ${authorId}`)
    const info = await fetchAuthorInfo([authorId])
    const data = info.get(authorId)
    console.log(`[refresh-author] Steam respondeu:`, data)

    if (!data || !data.name) {
      return NextResponse.json({ ok: false, error: "autor não encontrado na Steam" }, { status: 404 })
    }

    const { updated, error } = await refreshAuthorInfo(authorId, data.name, data.avatar)
    if (error) {
      console.error(`[refresh-author] Supabase error:`, error)
      return NextResponse.json({ ok: false, error }, { status: 500 })
    }

    console.log(`[refresh-author] ok — ${updated} wallpapers atualizados`)
    return NextResponse.json({ ok: true, updated, name: data.name, avatar: data.avatar })
  } catch (e) {
    console.error(`[refresh-author] exceção:`, e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}