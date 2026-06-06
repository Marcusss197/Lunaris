// app/api/rate/route.ts
// Avaliação por wallpaper — média agregada no banco, cookie só no cliente.
// Futuro: migrar pra sistema de contas checando user_id.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// GET /api/rate?id=123  → { avg, total }
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

  const { data, error } = await supabase
    .from("wallpaper_ratings")
    .select("avg_rating, total_votes")
    .eq("wallpaper_id", id)
    .single()

  if (error || !data) return NextResponse.json({ avg: 0, total: 0 })

  return NextResponse.json({ avg: data.avg_rating, total: data.total_votes })
}

// POST /api/rate  body: { id, rating (1-5) }
export async function POST(req: NextRequest) {
  const { id, rating } = await req.json()

  if (!id || !rating) return NextResponse.json({ error: "id e rating obrigatórios" }, { status: 400 })
  if (rating < 1 || rating > 5) return NextResponse.json({ error: "rating deve ser 1-5" }, { status: 400 })

  // Busca registro atual
  const { data: existing } = await supabase
    .from("wallpaper_ratings")
    .select("avg_rating, total_votes")
    .eq("wallpaper_id", id)
    .single()

  let newTotal: number
  let newAvg: number

  if (existing) {
    // Recalcula média incremental
    newTotal = existing.total_votes + 1
    newAvg = (existing.avg_rating * existing.total_votes + rating) / newTotal
  } else {
    newTotal = 1
    newAvg = rating
  }

  newAvg = Math.round(newAvg * 100) / 100

  const { error } = await supabase
    .from("wallpaper_ratings")
    .upsert(
      { wallpaper_id: id, avg_rating: newAvg, total_votes: newTotal },
      { onConflict: "wallpaper_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, avg: newAvg, total: newTotal })
}
