// app/api/discard/route.ts
// Verifica se wallpapers do banco ainda existem na Steam e deleta os que não existem.
// Uso: GET /api/discard?dry=true  → só lista o que seria deletado (sem deletar)
//      GET /api/discard            → verifica e deleta
//      GET /api/discard?id=123     → verifica/deleta um ID específico
//
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const STEAM_API_BASE = "https://api.steampowered.com"
const BATCH_SIZE = 100 // Steam aceita até 100 IDs por request

// Verifica quais IDs existem na Steam (IPublishedFileService/GetDetails)
async function checkSteamIds(ids: number[]): Promise<Set<number>> {
  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) return new Set(ids) // se não tem key, considera todos válidos

  const existing = new Set<number>()

  // Processa em batches de 100
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)

    const params = new URLSearchParams({ key: apiKey })
    batch.forEach((id, idx) => params.set(`publishedfileids[${idx}]`, String(id)))
    params.set("itemcount", String(batch.length))

    try {
      const res = await fetch(
        `${STEAM_API_BASE}/ISteamRemoteStorage/GetPublishedFileDetails/v1/`,
        { method: "POST", body: params }
      )
      if (!res.ok) continue

      const data = await res.json()
      const details = data?.response?.publishedfiledetails ?? []

      for (const item of details) {
        // result === 1 = existe | result === 9 = não existe mais
        if (item.result === 1 && item.publishedfileid) {
          existing.add(Number(item.publishedfileid))
        }
      }
    } catch (e) {
      console.error(`Erro ao verificar batch Steam:`, e)
    }

    // Delay entre batches pra não sobrecarregar a API
    if (i + BATCH_SIZE < ids.length) await new Promise(r => setTimeout(r, 500))
  }

  return existing
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dry    = searchParams.get("dry") === "true"
  const singleId = searchParams.get("id") ? Number(searchParams.get("id")) : null

  // Busca TODOS os IDs do banco paginando de 1000 em 1000 (Supabase limita a 1000 por query)
  let allData: { id: number; title: string }[] = []
  if (singleId) {
    const { data: sd, error: se } = await supabase.from("wallpapers").select("id, title").eq("id", singleId)
    if (se) return NextResponse.json({ error: se.message }, { status: 500 })
    allData = sd ?? []
  } else {
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data: pd, error: pe } = await supabase
        .from("wallpapers").select("id, title").range(from, from + PAGE - 1)
      if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })
      if (!pd || pd.length === 0) break
      allData = allData.concat(pd)
      if (pd.length < PAGE) break
      from += PAGE
    }
  }

  const dbIds = allData.map((w: { id: number }) => w.id)
  if (dbIds.length === 0) return NextResponse.json({ deleted: [], total: 0 })

  console.log(`🔍 Verificando ${dbIds.length} wallpapers na Steam...`)

  // Verifica quais ainda existem na Steam
  const existingOnSteam = await checkSteamIds(dbIds)

  const toDelete = dbIds.filter(id => !existingOnSteam.has(id))
  const toDeleteWithTitles = allData
    .filter((w: { id: number }) => toDelete.includes(w.id))
    .map((w: { id: number; title: string }) => ({ id: w.id, title: w.title }))

  console.log(`  ✓ ${existingOnSteam.size} existem | ❌ ${toDelete.length} não existem mais`)

  if (dry || toDelete.length === 0) {
    return NextResponse.json({
      dry,
      would_delete: toDeleteWithTitles,
      total: toDelete.length,
      checked: dbIds.length,
    })
  }

  // Deleta em batches
  const DELETE_BATCH = 500
  let deleted = 0
  for (let i = 0; i < toDelete.length; i += DELETE_BATCH) {
    const batch = toDelete.slice(i, i + DELETE_BATCH)
    const { error: delError } = await supabase
      .from("wallpapers")
      .delete()
      .in("id", batch)

    if (delError) {
      console.error("Erro ao deletar:", delError.message)
    } else {
      deleted += batch.length
      console.log(`  🗑️  Deletados ${deleted}/${toDelete.length}...`)
    }
  }

  return NextResponse.json({
    deleted: toDeleteWithTitles,
    total: deleted,
    checked: dbIds.length,
  })
}