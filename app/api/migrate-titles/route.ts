// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { translateTitle } from "@/lib/steam"

const BATCH_SIZE = 50
const DELAY_MS = 500 

function hasCJK(text: string): boolean {
  return /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
  }

  if (!process.env.DEEPL_API_KEY) {
    return NextResponse.json({ error: "DEEPL_API_KEY não configurada" }, { status: 500 })
  }

  let offset = 0
  let totalTranslated = 0
  let totalSkipped = 0

  console.log("🌐 Iniciando migração de títulos CJK...")

  while (true) {
    // Busca wallpapers onde title = title_original (ainda não traduzido)
    const { data, error } = await supabase
      .from("wallpapers")
      .select("id, title, title_original")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("id")

    if (error) {
      console.error("Erro ao buscar:", error.message)
      break
    }

    if (!data || data.length === 0) break

    const toTranslate = data.filter(
      (w: { id: number; title: string; title_original: string }) =>
        hasCJK(w.title)
    )

    if (toTranslate.length > 0) {
      console.log(`  Traduzindo ${toTranslate.length} títulos (offset ${offset})...`)

      for (const w of toTranslate) {
        const translated = await translateTitle(w.title_original)
        if (translated !== w.title_original) {
          await supabase
            .from("wallpapers")
            .update({ title: translated })
            .eq("id", w.id)
          totalTranslated++
          console.log(`  ✓ [${w.id}] ${w.title_original.slice(0, 30)} → ${translated.slice(0, 40)}`)
        }
      }

      await sleep(DELAY_MS)
    } else {
      totalSkipped += data.length
    }

    offset += BATCH_SIZE
    if (data.length < BATCH_SIZE) break
  }

  console.log(`✓ Migração concluída — ${totalTranslated} traduzidos, ${totalSkipped} sem CJK`)

  return NextResponse.json({
    ok: true,
    translated: totalTranslated,
    skipped: totalSkipped,
  })
}