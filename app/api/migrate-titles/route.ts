// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const BATCH_SIZE = 50
const DELAY_MS = 300

function hasCJK(text: string): boolean {
  return /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function deepLTranslate(text: string): Promise<string> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return text
  try {
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text], target_lang: "EN-US" }),
    })
    const data = await res.json()
    const translated: string = data?.translations?.[0]?.text ?? text
    // Só retorna se a tradução tem conteúdo útil
    if (!translated || translated.trim().length < 2) return text
    return translated
  } catch {
    return text
  }
}

export async function GET() {
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
  if (!process.env.DEEPL_API_KEY) return NextResponse.json({ error: "DEEPL_API_KEY não configurada" }, { status: 500 })

  let offset = 0
  let totalTranslated = 0
  let totalSkipped = 0

  console.log("🌐 Iniciando migração de títulos CJK...")

  while (true) {
    const { data, error } = await supabase
      .from("wallpapers")
      .select("id, title, title_original")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("id")

    if (error) { console.error("Erro:", error.message); break }
    if (!data || data.length === 0) break

    // Só traduz wallpapers onde title == title_original (ainda não traduzido) E tem CJK
    const toTranslate = data.filter((w) => 
  w.title === w.title_original && hasCJK(w.title))

    if (toTranslate.length > 0) {
      console.log(`  Traduzindo ${toTranslate.length} títulos (offset ${offset})...`)

      for (const w of toTranslate) {
        // Traduz o título original completo — sem cortar nada
        const translated = await deepLTranslate(w.title_original)

        // Aceita a tradução se mudou algo, mesmo com CJK residual
        // Tradução parcial é melhor que manter tudo em kanji
        if (translated && translated !== w.title) {
          await supabase.from("wallpapers").update({ title: translated }).eq("id", w.id)
          totalTranslated++
          const hasCJKLeft = hasCJK(translated)
          console.log(`  ${hasCJKLeft ? "⚡" : "✓"} [${w.id}] ${w.title_original.slice(0, 35)} → ${translated.slice(0, 40)}`)
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
  return NextResponse.json({ ok: true, translated: totalTranslated, skipped: totalSkipped })
}