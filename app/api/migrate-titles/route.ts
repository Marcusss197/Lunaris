// Lunaris - Migração de títulos CJK para EN via Google Translate
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197
//
// Uso: GET /api/migrate-titles
// Traduz TODOS os wallpapers que ainda têm CJK no título

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const BATCH_SIZE = 50
const DELAY_MS   = 200

function hasCJK(text: string): boolean {
  return /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function googleTranslate(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) return text
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: "en", format: "text" }),
      }
    )
    const data = await res.json()
    const translated: string = data?.data?.translations?.[0]?.translatedText ?? text
    if (!translated || translated.trim().length < 2) return text
    return translated
  } catch {
    return text
  }
}

export async function GET() {
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
  if (!process.env.GOOGLE_TRANSLATE_API_KEY)
    return NextResponse.json({ error: "GOOGLE_TRANSLATE_API_KEY não configurada" }, { status: 500 })

  let offset = 0
  let totalTranslated = 0
  let totalSkipped    = 0

  console.log("🌐 Iniciando migração de títulos CJK via Google Translate...")

  while (true) {
    // Filtra direto no Postgres usando regex — só busca quem ainda tem CJK
    const { data, error } = await supabase
      .from("wallpapers")
      .select("id, title, title_original")
      .filter("title", "match", "[\\u3040-\\u30FF\\u4E00-\\u9FFF\\uAC00-\\uD7AF]")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("id")

    if (error) { console.error("Erro:", error.message); break }
    if (!data || data.length === 0) break

    console.log(`  Traduzindo ${data.length} títulos (offset ${offset})...`)

    for (const w of data) {
      const source = w.title_original || w.title
      const translated = await googleTranslate(source)

      if (translated && translated !== w.title && !hasCJK(translated)) {
        await supabase.from("wallpapers").update({ title: translated }).eq("id", w.id)
        totalTranslated++
        console.log(`  ✓ [${w.id}] ${source.slice(0, 35)} → ${translated.slice(0, 40)}`)
      } else if (translated && translated !== w.title) {
        // Tradução parcial — ainda tem CJK mas é melhor que nada
        await supabase.from("wallpapers").update({ title: translated }).eq("id", w.id)
        totalTranslated++
        console.log(`  ⚡ [${w.id}] ${source.slice(0, 35)} → ${translated.slice(0, 40)}`)
      } else {
        totalSkipped++
      }
    }

    await sleep(DELAY_MS)
    offset += BATCH_SIZE
    if (data.length < BATCH_SIZE) break
  }

  console.log(`✓ Migração concluída — ${totalTranslated} traduzidos, ${totalSkipped} sem mudança`)
  return NextResponse.json({ ok: true, translated: totalTranslated, skipped: totalSkipped })
}