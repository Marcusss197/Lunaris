// Lunaris - adiciona tag manual a um wallpaper específico
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })

  const { id, tag, type } = await req.json()
  if (!id || !tag) return NextResponse.json({ error: "id e tag obrigatórios" }, { status: 400 })

  const clean = tag.trim().toLowerCase()
  if (!clean || clean.length < 2) return NextResponse.json({ error: "tag inválida" }, { status: 400 })

  // type: "user" → salva em user_tags, qualquer outro → ai_tags (comportamento legado)
  const field = type === "user" ? "user_tags" : "ai_tags"

  const { data, error } = await supabase
    .from("wallpapers")
    .select("ai_tags, user_tags")
    .eq("id", id)
    .single()

  if (error || !data) return NextResponse.json({ error: "wallpaper não encontrado" }, { status: 404 })

  const currentAi:   string[] = data.ai_tags   ?? []
  const currentUser: string[] = data.user_tags  ?? []

  // Não deixa duplicar em nenhuma das duas listas
  if (currentAi.includes(clean) || currentUser.includes(clean))
    return NextResponse.json({ ok: true, ai_tags: currentAi, user_tags: currentUser })

  const newTags = field === "user_tags"
    ? [...currentUser, clean]
    : [...currentAi, clean]

  await supabase.from("wallpapers").update({ [field]: newTags }).eq("id", id)

  return NextResponse.json({
    ok: true,
    ai_tags:   field === "ai_tags"   ? newTags : currentAi,
    user_tags: field === "user_tags" ? newTags : currentUser,
  })
}
