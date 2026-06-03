// Lunaris - adiciona tag manual a um wallpaper específico
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })

  const { id, tag } = await req.json()
  if (!id || !tag) return NextResponse.json({ error: "id e tag obrigatórios" }, { status: 400 })

  const clean = tag.trim().toLowerCase()
  if (!clean || clean.length < 2) return NextResponse.json({ error: "tag inválida" }, { status: 400 })

  const { data, error } = await supabase.from("wallpapers").select("ai_tags").eq("id", id).single()
  if (error || !data) return NextResponse.json({ error: "wallpaper não encontrado" }, { status: 404 })

  const currentTags: string[] = data.ai_tags ?? []
  if (currentTags.includes(clean)) return NextResponse.json({ ok: true, tags: currentTags })

  const newTags = [...currentTags, clean]
  await supabase.from("wallpapers").update({ ai_tags: newTags }).eq("id", id)

  return NextResponse.json({ ok: true, tags: newTags })
}
