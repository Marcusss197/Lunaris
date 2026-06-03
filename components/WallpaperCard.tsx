// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { useState } from "react"
import { Wallpaper } from "@/types/wallpaper"
import { formatDownloads } from "@/lib/steam"

interface WallpaperCardProps {
  wallpaper: Wallpaper
}

export default function WallpaperCard({ wallpaper }: WallpaperCardProps) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [localTags, setLocalTags] = useState<string[]>(wallpaper.tags)
  const [saving, setSaving] = useState(false)

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault()
    const clean = tagInput.trim().toLowerCase()
    if (!clean || localTags.includes(clean)) { setTagInput(""); setShowTagInput(false); return }

    setSaving(true)
    try {
      const res = await fetch("/api/add-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wallpaper.id, tag: clean }),
      })
      const data = await res.json()
      if (data.ok) setLocalTags(data.tags)
    } catch { /* ignora */ }

    setTagInput("")
    setShowTagInput(false)
    setSaving(false)
  }

  return (
    <div
      className="group block rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-hover)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Imagem */}
      <a href={wallpaper.steamUrl} target="_blank" rel="noopener noreferrer">
        <div className="relative aspect-video" style={{ background: "var(--bg-surface)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wallpaper.previewUrl}
            alt={wallpaper.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {wallpaper.isAnimated && (
            <span className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-black/60 text-white">▶ animado</span>
          )}
          {wallpaper.isNsfw && (
            <span className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-red-500/80 text-white">+18</span>
          )}
        </div>
      </a>

      {/* Info */}
      <div className="p-3" style={{ background: "var(--bg-card)" }}>
        <a href={wallpaper.steamUrl} target="_blank" rel="noopener noreferrer">
          <p className="text-sm font-medium truncate mb-2" style={{ color: "var(--text-main)" }}>
            {wallpaper.title}
          </p>
        </a>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {localTags.slice(0, 6).map(tag => (
            <span key={`site-${tag}`} className="tag-pill-site text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/20">
              {tag}
            </span>
          ))}
          {wallpaper.steamTags.slice(0, 2).map(tag => (
            <span key={`steam-${tag}`} className="tag-pill-steam text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400/70 border border-sky-500/20">
              {tag}
            </span>
          ))}
          {/* Botão + pra adicionar tag no card */}
          {!showTagInput && (
            <button
              onClick={() => setShowTagInput(true)}
              className="text-[11px] px-2 py-0.5 rounded-full transition-all hover:opacity-80"
              style={{ background: "var(--accent-glow)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.2)" }}
              aria-label="Adicionar tag"
              title="Adicionar tag"
            >+</button>
          )}
        </div>

        {/* Input de tag inline */}
        {showTagInput && (
          <form onSubmit={handleAddTag} className="flex gap-1 mb-2">
            <input
              autoFocus
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setShowTagInput(false); setTagInput("") } }}
              placeholder="nova tag..."
              disabled={saving}
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
