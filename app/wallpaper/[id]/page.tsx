// app/wallpaper/[id]/page.tsx
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const HOME = "https://lunaris-marcusss.vercel.app"

interface WallpaperDetail {
  id: number
  title: string
  title_original: string
  preview_url: string
  steam_url: string
  author_name: string
  author_id: string
  steam_tags: string[]
  ai_tags: string[]
  user_tags: string[]
  downloads: number
  is_nsfw: boolean
  is_animated: boolean
  steam_created_at: number | null
  indexed_at: string
}

interface RatingData { avg: number; total: number }

function getRatingCookie(id: string): number | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(^| )lunaris_rating_${id}=([^;]+)`))
  return m ? Number(m[2]) : null
}
function setRatingCookie(id: string, rating: number) {
  const exp = new Date(); exp.setFullYear(exp.getFullYear() + 1)
  document.cookie = `lunaris_rating_${id}=${rating}; expires=${exp.toUTCString()}; path=/`
}
function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}
function formatDate(ts: number | null, iso?: string) {
  const d = ts ? new Date(ts * 1000) : iso ? new Date(iso) : null
  if (!d) return "—"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

const TYPES       = ["Scene","Video","Application","Web"]
const AGE_RATINGS = ["Everyone","Mature 17+"]
const RES_RE      = /^\d{3,4}\s?[xX×]\s?\d{3,4}$/
const GENRES      = ["Anime","Game","CGI","Live Action","Nature","Abstract"]
const FEATURES    = ["Audio responsive","Media Integration","Customizable"]

function parseSteamTags(tags: string[]) {
  const type       = tags.find(t => TYPES.includes(t)) ?? null
  const ageRating  = tags.find(t => AGE_RATINGS.includes(t)) ?? null
  const resolution = tags.find(t => RES_RE.test(t)) ?? null
  const genre      = tags.find(t => GENRES.includes(t)) ?? null
  const category   = tags.find(t => t === "Wallpaper" || t === "Wallpaper Engine") ?? null
  const misc       = tags.find(t => t === "Approved" || t === "Unrated") ?? null
  const features   = tags.filter(t => FEATURES.includes(t))
  const extras     = tags.filter(t =>
    t !== type && t !== ageRating && t !== resolution &&
    t !== genre && t !== category && t !== misc && !FEATURES.includes(t)
  )
  return { type, ageRating, resolution, genre, category, misc, features, extras }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="w-28 shrink-0 text-[13px]" style={{ color: "var(--text-dim)" }}>{label}</span>
      <span className="text-[13px]" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  )
}

function StarRow({ value, max = 5, interactive = false, hovered = 0, onHover, onClick, size = 20, color = "#facc15", dimColor = "var(--border)" }:
  { value: number; max?: number; interactive?: boolean; hovered?: number; onHover?: (n: number) => void; onClick?: (n: number) => void; size?: number; color?: string; dimColor?: string }) {
  const display = hovered || value
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map(star => (
        <svg key={star} width={size} height={size} viewBox="0 0 24 24"
          fill={star <= display ? color : "none"} stroke={star <= display ? color : dimColor}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={interactive ? "cursor-pointer transition-transform hover:scale-110" : ""}
          onMouseEnter={() => interactive && onHover?.(star)}
          onMouseLeave={() => interactive && onHover?.(0)}
          onClick={() => interactive && onClick?.(star)}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function TagSection({ title, tags, color }: {
  title: string
  tags: string[]
  color: "ai" | "user" | "steam"
}) {
  if (tags.length === 0) return null
  return (
    <div className="mb-3">
      <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--text-dim)" }}>{title}</p>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, i) => (
          <span key={`${color}-${i}-${tag}`}
            className={`tag-${color} text-[12px] px-2.5 py-0.5 rounded-full border`}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// Botão Voltar: usa router.back() se tiver histórico, senão vai pro home
function BackButton() {
  const router = useRouter()

  function handleBack() {
    // Se a página foi aberta em nova aba, window.history.length será 1 ou 2 (sem histórico real do site)
    if (typeof window !== "undefined" && window.history.length <= 2) {
      window.location.href = HOME
    } else {
      router.back()
    }
  }

  return (
    <button onClick={handleBack}
      className="flex items-center gap-2 text-sm mb-5 hover:opacity-80 transition-opacity"
      style={{ color: "var(--text-dim)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      Voltar
    </button>
  )
}

export default function WallpaperDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [wallpaper, setWallpaper]       = useState<WallpaperDetail | null>(null)
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)
  const [rating, setRating]             = useState<RatingData>({ avg: 0, total: 0 })
  const [myVote, setMyVote]             = useState<number | null>(null)
  const [hoveredStar, setHoveredStar]   = useState(0)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput]         = useState("")
  const [localAiTags, setLocalAiTags]   = useState<string[]>([])
  const [localUserTags, setLocalUserTags] = useState<string[]>([])
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from("wallpapers").select("*").eq("id", id).single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setWallpaper(data as WallpaperDetail)
        setLocalAiTags(data.ai_tags ?? [])
        setLocalUserTags(data.user_tags ?? [])
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`/api/rate?id=${id}`)
      .then(res => res.json())
      .then(data => {
        setRating({ avg: data.avg ?? 0, total: data.total ?? 0 })
        setMyVote(getRatingCookie(id))
      })
  }, [id])

  async function handleVote(star: number) {
    if (myVote !== null) return
    const res = await fetch("/api/rate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(id), rating: star }),
    })
    const data = await res.json()
    if (data.ok) { setRating({ avg: data.avg, total: data.total }); setMyVote(star); setRatingCookie(id, star) }
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault()
    const clean = tagInput.trim().toLowerCase()
    const all = [...localAiTags, ...localUserTags]
    if (!clean || all.includes(clean)) { setTagInput(""); setShowTagInput(false); return }
    setSaving(true)
    try {
      const res = await fetch("/api/add-tag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(id), tag: clean, type: "user" }),
      })
      const data = await res.json()
      if (data.ok) setLocalUserTags(data.user_tags ?? [...localUserTags, clean])
    } catch { /* ignora */ }
    setTagInput(""); setShowTagInput(false); setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-main)" }}>
      <div className="text-sm animate-pulse" style={{ color: "var(--text-dim)" }}>Carregando...</div>
    </div>
  )

  if (notFound || !wallpaper) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg-main)" }}>
      <p className="text-lg" style={{ color: "var(--text-main)" }}>Wallpaper não encontrado TwT</p>
      <BackButton />
    </div>
  )

  const meta = parseSteamTags(wallpaper.steam_tags ?? [])
  const aiTagsUnique   = localAiTags.filter((t, i) => localAiTags.indexOf(t) === i)
  const userTagsUnique = localUserTags.filter((t, i) => localUserTags.indexOf(t) === i)
  const totalTags = aiTagsUnique.length + userTagsUnique.length

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)", color: "var(--text-main)" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        <BackButton />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* ── Coluna esquerda ── */}
          <div className="flex flex-col gap-0">

            {/* Preview 16:9 */}
            <div className="relative w-full rounded-t-xl overflow-hidden"
              style={{ aspectRatio: "16/9", background: "var(--bg-surface)", border: "1px solid var(--border)", borderBottom: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wallpaper.preview_url} alt={wallpaper.title} className="w-full h-full object-cover" />
              {wallpaper.is_animated && (
                <span className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full bg-black/60 text-white">▶ animado</span>
              )}
              {wallpaper.is_nsfw && (
                <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full bg-red-500/80 text-white">+18</span>
              )}
            </div>

            {/* Barra separadora */}
            <div className="w-full h-0.75"
              style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.7) 0%, rgba(99,102,241,0.4) 60%, transparent 100%)" }} />

            {/* Título + meta */}
            <div className="rounded-b-xl px-4 py-3 mb-5"
              style={{ border: "1px solid var(--border)", borderTop: "none", background: "var(--bg-card)" }}>
              <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-main)" }}>
                {wallpaper.title}
              </h1>
              {wallpaper.title_original && wallpaper.title_original !== wallpaper.title && (
                <p className="text-sm mb-2" style={{ color: "var(--text-dim)" }}>{wallpaper.title_original}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm mt-2" style={{ color: "var(--text-dim)" }}>
                {wallpaper.author_name && (
                  <a href={`https://steamcommunity.com/profiles/${wallpaper.author_id}`}
                    target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                    👤 {wallpaper.author_name}
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <DownloadIcon /> {formatNumber(wallpaper.downloads)} downloads
                </span>
                {wallpaper.steam_created_at && (
                  <span>📅 {formatDate(wallpaper.steam_created_at)}</span>
                )}
              </div>
            </div>

            {/* Tags */}
            {totalTags > 0 && (
              <div className="rounded-xl p-4 mb-5" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Tags</h2>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>{totalTags} tags</span>
                </div>

                <TagSection title="Tags IA" tags={aiTagsUnique} color="ai" />
                <TagSection title="Tags de usuários" tags={userTagsUnique} color="user" />

                <div className="flex gap-4 mt-1 mb-3 text-[11px]" style={{ color: "var(--text-dim)" }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--tag-ai-text)", opacity: 0.7 }} /> Tag IA
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--tag-user-text)", opacity: 0.7 }} /> Tag usuário
                  </span>
                </div>

                {/* Adicionar tag */}
                {!showTagInput ? (
                  <button onClick={() => setShowTagInput(true)}
                    className="text-xs py-1.5 px-3 rounded-lg transition-all hover:opacity-80"
                    style={{ background: "var(--bg-surface)", color: "var(--text-dim)", border: "1px dashed var(--border)" }}>
                    + Adicionar tag
                  </button>
                ) : (
                  <form onSubmit={handleAddTag} className="flex gap-1">
                    <input autoFocus type="text" value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Escape") { setShowTagInput(false); setTagInput("") } }}
                      placeholder="nova tag (vai como tag de usuário)..." disabled={saving}
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg outline-none"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-main)" }} />
                    <button type="submit" disabled={saving} className="tag-add text-xs px-3 py-1.5 rounded-lg border">
                      {saving ? "..." : "✓"}
                    </button>
                    <button type="button" onClick={() => { setShowTagInput(false); setTagInput("") }}
                      className="text-xs px-2 py-1.5 rounded-lg"
                      style={{ background: "var(--bg-surface)", color: "var(--text-dim)" }}>×</button>
                  </form>
                )}
              </div>
            )}

            {/* Avaliação */}
            <div className="rounded-xl p-4 mb-5" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-main)" }}>Avaliação</h2>
              {rating.total > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <StarRow value={Math.round(rating.avg)} size={16} color="#facc15" />
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {rating.avg.toFixed(1)} · {rating.total} {rating.total === 1 ? "voto" : "votos"}
                  </span>
                </div>
              )}
              {myVote !== null ? (
                <div className="flex items-center gap-2">
                  <StarRow value={myVote} size={15} color="#facc15" />
                  <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>Seu voto</span>
                </div>
              ) : (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>
                    {rating.total === 0 ? "Seja o primeiro a avaliar!" : "Avaliar:"}
                  </p>
                  <StarRow value={0} interactive hovered={hoveredStar}
                    onHover={setHoveredStar} onClick={handleVote} size={24} color="#facc15" />
                </div>
              )}
            </div>

            {/* Comentários placeholder */}
            <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-main)" }}>Comentários</h2>
              <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-lg"
                style={{ background: "var(--bg-surface)", border: "1px dashed var(--border)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-dim)", opacity: 0.4 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-xs" style={{ color: "var(--text-dim)", opacity: 0.6 }}>Comentários em breve :3</p>
              </div>
            </div>

          </div>

          {/* ── Coluna direita ── */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <a href={wallpaper.steam_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-all hover:opacity-90 mb-4 w-full tag-add border"
                style={{ textDecoration: "none" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Ver na Steam
              </a>

              {meta.misc       && <InfoRow label="Miscellaneous" value={meta.misc} />}
              {meta.type       && <InfoRow label="Type"          value={meta.type} />}
              {meta.ageRating  && <InfoRow label="Age Rating"    value={meta.ageRating} />}
              {meta.genre      && <InfoRow label="Genre"         value={meta.genre} />}
              {meta.resolution && <InfoRow label="Resolution"    value={meta.resolution} />}
              {meta.category   && <InfoRow label="Category"      value={meta.category} />}
              {meta.features.length > 0 && <InfoRow label="Features" value={meta.features.join(", ")} />}
              <InfoRow label="Downloads" value={formatNumber(wallpaper.downloads)} />
              {wallpaper.steam_created_at && <InfoRow label="Publicado" value={formatDate(wallpaper.steam_created_at)} />}

              {meta.extras.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {meta.extras.map((tag, i) => (
                    <span key={`steam-extra-${i}-${tag}`}
                      className="tag-steam text-[11px] px-2 py-0.5 rounded-full border">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {wallpaper.author_name && (
              <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                <p className="text-xs mb-2 font-medium" style={{ color: "var(--text-dim)" }}>Criado por</p>
                <a href={`https://steamcommunity.com/profiles/${wallpaper.author_id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tag-add border">
                    {wallpaper.author_name[0].toUpperCase()}
                  </div>
                  <span className="text-sm" style={{ color: "var(--text-main)" }}>{wallpaper.author_name}</span>
                </a>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}