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

  const isDevMode = process.env.DEV_MODE === "true"

  const { data, error } = await supabase
    .from("wallpapers")
    .select("ai_tags, user_tags, pending_tags")
    .eq("id", id)
    .single()

  if (error || !data) return NextResponse.json({ error: "wallpaper não encontrado" }, { status: 404 })

  const currentAi:      string[] = data.ai_tags      ?? []
  const currentUser:    string[] = data.user_tags    ?? []
  const currentPending: string[] = data.pending_tags ?? []

  // type !== "user" → comportamento legado, salva direto em ai_tags
  if (type !== "user") {
    if (currentAi.includes(clean) || currentUser.includes(clean)) {
      return NextResponse.json({ ok: true, ai_tags: currentAi, user_tags: currentUser, pending: false })
    }
    const newAiTags = [...currentAi, clean]
    await supabase.from("wallpapers").update({ ai_tags: newAiTags }).eq("id", id)
    return NextResponse.json({ ok: true, ai_tags: newAiTags, user_tags: currentUser, pending: false })
  }

  if (currentAi.includes(clean) || currentUser.includes(clean)) {
    return NextResponse.json({ ok: true, ai_tags: currentAi, user_tags: currentUser, pending: false, already_exists: true })
  }
  if (currentPending.includes(clean)) {
    return NextResponse.json({ ok: true, ai_tags: currentAi, user_tags: currentUser, pending: true, already_exists: true })
  }

  if (isDevMode) {
    // DEV_MODE: aprova instantaneamente, vai direto pra user_tags
    const newUserTags = [...currentUser, clean]
    await supabase.from("wallpapers").update({ user_tags: newUserTags }).eq("id", id)
    return NextResponse.json({ ok: true, ai_tags: currentAi, user_tags: newUserTags, pending: false })
  }

  // Produção: entra na fila de moderação
  const newPendingTags = [...currentPending, clean]
  await supabase.from("wallpapers").update({ pending_tags: newPendingTags }).eq("id", id)
  return NextResponse.json({ ok: true, ai_tags: currentAi, user_tags: currentUser, pending: true })
}