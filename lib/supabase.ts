import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL?.replace(/\/$/, "") // remove barra final se tiver
const key = process.env.SUPABASE_SERVICE_KEY

export const supabase = url && key ? createClient(url, key) : null

if (!url || !key) {
  console.warn("⚠️ Supabase não configurado")
} else {
  console.log("✓ Supabase URL:", url)
}

export function isDbAvailable(): boolean {
  return supabase !== null
}
