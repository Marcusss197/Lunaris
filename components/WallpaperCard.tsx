// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Wallpaper } from "@/types/wallpaper"
import { formatDownloads } from "@/lib/steam"

interface WallpaperCardProps {
  wallpaper: Wallpaper
}

// 33/33/33 — se um tipo tiver menos, distribui o resto pros outros
function buildTagDisplay(aiTags: string[], userTags: string[], steamTags: string[]) {
  const TOTAL = 12
  const BASE  = Math.floor(TOTAL / 3) // 4 cada

  const seen = new Set<string>()
  const pick = (tags: string[], max: number) => {
    const result: string[] = []
    for (const t of tags) {
      if (result.length >= max) break
      if (!seen.has(t)) { seen.add(t); result.push(t) }
    }
    return result
  }

  // Primeira passada — pega até BASE de cada
  const ai    = pick(aiTags,    BASE)
  const user  = pick(userTags,  BASE)
  const steam = pick(steamTags, BASE)

  // Calcula sobra de cada tipo
  const aiLeft    = Math.max(0, BASE - ai.length)
  const userLeft  = Math.max(0, BASE - user.length)
  const steamLeft = Math.max(0, BASE - steam.length)
  const totalLeft = aiLeft + userLeft + steamLeft

  if (totalLeft === 0) return { ai, user, steam }

  // Distribui slots vagos pros outros tipos
  const extraAi    = pick(aiTags,    userLeft + steamLeft)
  const extraUser  = pick(userTags,  aiLeft   + steamLeft)
  const extraSteam = pick(steamTags, aiLeft   + userLeft)

  return {
    ai:    [...ai,    ...extraAi],
    user:  [...user,  ...extraUser],
    steam: [...steam, ...extraSteam],
  }
}

export default function WallpaperCard({ wallpaper }: WallpaperCardProps) {
  const router = useRouter()
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput]         = useState("")
  const [localAiTags, setLocalAiTags]   = useState<string[]>(wallpaper.tags ?? [])
  const [localUserTags, setLocalUserTags] = useState<string[]>(wallpaper.userTags ?? [])
  const [saving, setSaving]             = useState(false)

  function goToDetail(e: React.MouseEvent) {
    e.preventDefault()
    router.push(`/wallpaper/${wallpaper.id}`)
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault()
    const clean = tagInput.trim().toLowerCase()
    const allTags = [...localAiTags, ...localUserTags]
    if (!clean || allTags.includes(clean)) { setTagInput(""); setShowTagInput(false); return }

    setSaving(true)
    try {
      const res = await fetch("/api/add-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wallpaper.id, tag: clean, type: "user" }),
      })
      const data = await res.json()
      if (data.ok) setLocalUserTags(data.user_tags ?? [...localUserTags, clean])
    } catch { /* ignora */ }

    setTagInput(""); setShowTagInput(false); setSaving(false)
  }

  const { ai, user, steam } = buildTagDisplay(localAiTags, localUserTags, wallpaper.steamTags ?? [])

  return (
    <div
      className="group block rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-hover)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Imagem */}
      <a href={`/wallpaper/${wallpaper.id}`} onClick={goToDetail}>
        <div className="relative aspect-video cursor-pointer" style={{ background: "var(--bg-surface)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wallpaper.previewUrl}
            alt={wallpaper.title}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
          />
          {wallpaper.isAnimated && (
            <span className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-black/60 text-white">▶ animado</span>
          )}
          {wallpaper.isNsfw && (
            <span className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-red-500/80 text-white">+18</span>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200 flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-xs font-medium px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
              Ver detalhes
            </span>
          </div>
        </div>
      </a>

      {/* Info */}
      <div className="p-3" style={{ background: "var(--bg-card)" }}>
        <a href={`/wallpaper/${wallpaper.id}`} onClick={goToDetail}>
          <p className="text-sm font-medium truncate mb-2 hover:underline" style={{ color: "var(--text-main)" }}>
            {wallpaper.title}
          </p>
        </a>

        {/* Tags 4/4/4 */}
        <div className="flex flex-wrap gap-1 mb-2">
          {/* IA — roxo */}
          {ai.map((tag, i) => (
            <span key={`ai-${i}-${tag}`}
              className="tag-ai text-[11px] px-2 py-0.5 rounded-full border">
              {tag}
            </span>
          ))}
          {/* Usuário — ciano */}
          {user.map((tag, i) => (
            <span key={`user-${i}-${tag}`}
              className="tag-user text-[11px] px-2 py-0.5 rounded-full border">
              {tag}
            </span>
          ))}
          {/* Steam — azul claro */}
          {steam.map((tag, i) => (
            <span key={`steam-${i}-${tag}`}
              className="tag-steam text-[11px] px-2 py-0.5 rounded-full border">
              {tag}
            </span>
          ))}

          {/* Botão + */}
          {!showTagInput && (
            <button
              onClick={e => { e.stopPropagation(); setShowTagInput(true) }}
              className="tag-add text-[11px] px-2 py-0.5 rounded-full border transition-all hover:opacity-80"
              title="Adicionar tag"
            >+</button>
          )}
        </div>

        {/* Input de tag */}
        {showTagInput && (
          <form onSubmit={handleAddTag} className="flex gap-1 mb-2">
            <input
              autoFocus type="text" value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setShowTagInput(false); setTagInput("") } }}
              placeholder="nova tag..." disabled={saving}
              className="flex-1 text-[11px] px-2 py-0.5 rounded-full outline-none"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-main)" }}
            />
            <button type="submit" disabled={saving}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(139,92,246,0.25)", color: "#c4b5fd" }}>
              {saving ? "..." : "✓"}
            </button>
            <button type="button" onClick={() => { setShowTagInput(false); setTagInput("") }}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-surface)", color: "var(--text-dim)" }}>×</button>
          </form>
        )}

        {/* Downloads */}
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-dim)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {formatDownloads(wallpaper.downloads)}
        </div>
      </div>
    </div>
  )
}
