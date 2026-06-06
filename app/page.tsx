// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Wallpaper } from "@/types/wallpaper"
import { WallpaperType, SortMode } from "@/lib/steam"
import WallpaperCard from "@/components/WallpaperCard"

const SUGGESTED_TAGS = [
  "anime","cute","dark","nature","sci-fi","fantasy","horror","minimalist",
  "purple","blue","pink","green","red","orange","yellow","white","black","pastel",
  "animated","custom","interactive","static","particle","rain","snow","fire",
  "4k","lofi","cyberpunk","retro","pixel","watercolor","3d","vaporwave",
  "waifu","mecha","landscape","space","ocean","city","forest","abstract",
]

const TYPE_OPTIONS: { label: string; value: WallpaperType }[] = [
  { label: "Todos", value: "all" },
  { label: "Scene", value: "Scene" },
  { label: "Vídeo", value: "Video" },
  { label: "Aplicativo", value: "Application" },
]

const RESOLUTION_OPTIONS = [
  { label: "Todas", value: "all" },
  { label: "720p", value: "1280 x 720" },
  { label: "1080p", value: "1920 x 1080" },
  { label: "2K", value: "2560 x 1440" },
  { label: "4K", value: "3840 x 2160" },
  { label: "Ultrawide", value: "3440 x 1440" },
]

const COLOR_OPTIONS = [
  { label: "Todas as cores", value: "all", emoji: "🎨" },
  { label: "Vermelho", value: "red", emoji: "🔴" },
  { label: "Laranja", value: "orange", emoji: "🟠" },
  { label: "Amarelo", value: "yellow", emoji: "🟡" },
  { label: "Verde", value: "green", emoji: "🟢" },
  { label: "Azul", value: "blue", emoji: "🔵" },
  { label: "Roxo", value: "purple", emoji: "🟣" },
  { label: "Rosa", value: "pink", emoji: "🩷" },
  { label: "Ciano", value: "cyan", emoji: "🩵" },
  { label: "Preto", value: "black", emoji: "⚫" },
  { label: "Branco", value: "white", emoji: "⚪" },
  { label: "Cinza", value: "gray", emoji: "🩶" },
]

// Categorias principais de ordenação
type SortCategory = "popular" | "recent" | "subscribed"

const POPULAR_PERIODS: { label: string; value: SortMode }[] = [
  { label: "Esta semana", value: "popular_week" },
  { label: "Este mês", value: "popular_month" },
  { label: "3 meses", value: "popular_3months" },
  { label: "6 meses", value: "popular_6months" },
  { label: "Este ano", value: "popular_year" },
  { label: "Desde o início", value: "popular_alltime" },
]

const TYPE_TAG_MAP: Record<WallpaperType, string | null> = {
  all: null, Scene: "scene", Video: "video", Application: "application",
}

const PER_PAGE = 30

export default function Home() {
  const [inputValue, setInputValue] = useState("")
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [allWallpapers, setAllWallpapers] = useState<Wallpaper[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)

  // Sort: categoria + período
  const [sortCategory, setSortCategory] = useState<SortCategory>("popular")
  const [popularPeriod, setPopularPeriod] = useState<SortMode>("popular_month")

  const [wallType, setWallType] = useState<WallpaperType>("all")
  const [resolution, setResolution] = useState("all")
  const [colorFilter, setColorFilter] = useState("all")
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [showTagsPanel, setShowTagsPanel] = useState(false)

  // Settings
  const [nsfwEnabled, setNsfwEnabled] = useState(false)
  const [nsfwOnly, setNsfwOnly] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [lightMode, setLightMode] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showNsfwPopup, setShowNsfwPopup] = useState(false)
  const [nsfwPopupCountdown, setNsfwPopupCountdown] = useState(5)

  const nextCursorRef = useRef<string | null>(null)
  const loadingMoreRef = useRef(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const popupCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const colorMenuRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<number>(0)
  const seenIdsRef = useRef<Set<number>>(new Set())

  // Sort mode efetivo
  const sortMode: SortMode = sortCategory === "recent" ? "recent" : sortCategory === "subscribed" ? "subscribed" : popularPeriod

  function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null
    return document.cookie.split("; ").find(r => r.startsWith(name + "="))?.split("=")[1] ?? null
  }
  function setCookie(name: string, value: string, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${value}; expires=${expires}; path=/`
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!getCookie("lunaris_visited")) setShowWelcome(true)
    if (getCookie("lunaris_nsfw") === "1") setNsfwEnabled(true)
    if (getCookie("lunaris_light") === "1") setLightMode(true)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark")
    setCookie("lunaris_light", lightMode ? "1" : "0")
  }, [lightMode])

  const filtered = allWallpapers.filter(w => {
    if (!nsfwEnabled && w.isNsfw) return false
    if (nsfwEnabled && nsfwOnly && !w.isNsfw) return false
    const typeTag = TYPE_TAG_MAP[wallType]
    if (typeTag && !w.steamTags.map(t => t.toLowerCase()).includes(typeTag)) return false
    if (resolution !== "all" && !w.steamTags.includes(resolution)) return false
    if (colorFilter !== "all" && !w.tags.includes(colorFilter)) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const currentPage = Math.min(page, Math.max(0, totalPages - 1))
  const visible = filtered.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE)
  const pageTagSet = Array.from(new Set(visible.flatMap(w => [...w.tags, ...w.steamTags]))).sort()

  const startFetch = useCallback(async (query: string, sort: SortMode, nsfw: boolean = false) => {
    const session = Date.now()
    sessionRef.current = session
    seenIdsRef.current = new Set()
    nextCursorRef.current = null
    setLoading(true); setLoadingMore(false); setAllWallpapers([]); setPage(0)

    try {
      let cursor = "*"
      const collected: Wallpaper[] = []

      // Carrega até 200 wallpapers — se nsfwOnly, precisa de 200 nsfw
      do {
        const res = await fetch(`/api/search?${new URLSearchParams({ q: query, sort, cursor, pages: "2" })}`)
        if (!res.ok || sessionRef.current !== session) { setLoading(false); return }

        const data = await res.json()
        const results: Wallpaper[] = data.wallpapers ?? []
        results.forEach((w: Wallpaper) => {
          if (!seenIdsRef.current.has(w.id)) {
            seenIdsRef.current.add(w.id)
            collected.push(w)
          }
        })
        cursor = data.nextCursor ?? ""
        nextCursorRef.current = cursor || null

        if (!cursor) break

        if (nsfw) {
          // nsfwOnly: continua até ter 200 nsfw
          const nsfwCount = collected.filter(w => w.isNsfw).length
          if (nsfwCount >= 200) break
        } else {
          // Normal: para quando tiver 200 wallpapers no total
          if (collected.length >= 200) break
        }
      } while (cursor && sessionRef.current === session)

      setAllWallpapers(collected)
      setLoading(false)
    } catch (err) {
      console.error("Erro:", err)
      if (sessionRef.current === Date.now()) { setLoading(false); setLoadingMore(false) }
    }
  }, [])

  // Carrega mais wallpapers ao navegar nas páginas
  const loadMore = useCallback(async (query: string, sort: SortMode) => {
    if (loadingMoreRef.current || !nextCursorRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const res = await fetch(`/api/search?${new URLSearchParams({ q: query, sort, cursor: nextCursorRef.current, pages: "2" })}`)
      if (!res.ok) { setLoadingMore(false); loadingMoreRef.current = false; return }

      const data = await res.json()
      const batch: Wallpaper[] = (data.wallpapers ?? []).filter((w: Wallpaper) => {
        if (seenIdsRef.current.has(w.id)) return false
        seenIdsRef.current.add(w.id); return true
      })
      if (batch.length > 0) setAllWallpapers(prev => [...prev, ...batch])
      nextCursorRef.current = data.nextCursor ?? null
    } catch (err) {
      console.error("Erro ao carregar mais:", err)
    }

    setLoadingMore(false)
    loadingMoreRef.current = false
  }, [])

  useEffect(() => {
    const fullQuery = [inputValue, ...activeTags].filter(Boolean).join(" ")
    const timer = setTimeout(() => startFetch(fullQuery, sortMode, nsfwOnly), 400)
    return () => clearTimeout(timer)
  }, [inputValue, activeTags, sortMode, nsfwEnabled, nsfwOnly, startFetch])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0)
    const fullQuery = [inputValue, ...activeTags, colorFilter !== "all" ? colorFilter : ""].filter(Boolean).join(" ")
    if (colorFilter !== "all") startFetch(fullQuery, sortMode, nsfwOnly)
  }, [wallType, resolution, colorFilter, sortMode, startFetch, inputValue, activeTags, nsfwOnly])

  // Scroll infinito — carrega mais quando chega no fim da página

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) setShowColorMenu(false)
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleInputChange(value: string) {
    setInputValue(value)
    if (!value.trim()) { setSuggestions([]); return }
    const lower = value.toLowerCase()
    setSuggestions(SUGGESTED_TAGS.filter(t => t.includes(lower) && !activeTags.includes(t)).slice(0, 8))
  }

  function addTag(tag: string) {
    const clean = tag.trim().toLowerCase()
    if (!clean || activeTags.includes(clean)) { setInputValue(""); setSuggestions([]); return }
    setActiveTags(prev => [...prev, clean])
    setInputValue(""); setSuggestions([])
    tagInputRef.current?.focus()
  }

  function removeTag(tag: string) { setActiveTags(prev => prev.filter(t => t !== tag)) }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && inputValue.trim()) { e.preventDefault(); addTag(inputValue) }
    if (e.key === "Backspace" && !inputValue && activeTags.length > 0) removeTag(activeTags[activeTags.length - 1])
  }

  function handleNsfwToggle() {
    if (nsfwEnabled) { setNsfwEnabled(false); setNsfwOnly(false); setCookie("lunaris_nsfw", "0"); return }
    setShowNsfwPopup(true)
    setNsfwPopupCountdown(5)
    popupCountdownRef.current = setInterval(() => {
      setNsfwPopupCountdown(prev => {
        if (prev <= 1) { if (popupCountdownRef.current) clearInterval(popupCountdownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function confirmNsfw() {
    if (popupCountdownRef.current) clearInterval(popupCountdownRef.current)
    setShowNsfwPopup(false); setNsfwEnabled(true); setCookie("lunaris_nsfw", "1")
  }

  function cancelNsfw() {
    if (popupCountdownRef.current) clearInterval(popupCountdownRef.current)
    setShowNsfwPopup(false)
  }

  function goToPage(p: number) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
    // Carrega mais quando estiver a 2 páginas do fim
    const fullQuery = [inputValue, ...activeTags].filter(Boolean).join(" ")
    if (p >= totalPages - 2 && nextCursorRef.current) {
      loadMore(fullQuery, sortMode)
    }
  }

  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i)
    const pages: (number | "...")[] = [0]
    if (currentPage > 2) pages.push("...")
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages - 2, currentPage + 1); i++) pages.push(i)
    if (currentPage < totalPages - 3) pages.push("...")
    pages.push(totalPages - 1)
    return pages
  }

  const currentColor = COLOR_OPTIONS.find(c => c.value === colorFilter)

  // Pill button style helper
  function pillStyle(active: boolean) {
    return active
      ? { background: "rgba(139,92,246,0.2)", color: "var(--accent)", border: "1px solid rgba(139,92,246,0.4)" }
      : { background: "var(--bg-surface)", color: "var(--text-dim)", border: "1px solid var(--border)" }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)", color: "var(--text-main)" }}>

      {/* Popup boas-vindas */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
          <div className="rounded-2xl p-8 max-w-md w-full text-center space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-3xl font-bold" style={{ color: "var(--accent)", textShadow: "0 0 20px rgba(139,92,246,0.5)" }}>Lunaris 🌙</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Buscador avançado de wallpapers do <strong style={{ color: "var(--text-main)" }}>Wallpaper Engine</strong> via Steam.
            </p>
            <ul className="text-sm text-left space-y-2 pl-1" style={{ color: "var(--text-dim)" }}>
              <li>🔍 Busca por nome, personagem ou tag</li>
              <li>🏷️ Tags automáticas via IA (Qwen2)</li>
              <li>🎨 Filtros por tipo, resolução e cor dominante</li>
              <li>🔞 Modo +18 disponível nas configurações</li>
            </ul>
            <div className="flex gap-3 pt-2">
              <a href="https://github.com/Marcusss197" target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
                GitHub
              </a>
              <button onClick={() => { setCookie("lunaris_visited", "1"); setShowWelcome(false) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgba(139,92,246,0.4)" }}>
                Explorar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup +18 */}
      {showNsfwPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full text-center space-y-4" style={{ background: "var(--bg-card)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-3xl">🔞</p>
            <h3 className="font-bold text-lg" style={{ color: "var(--text-main)" }}>Conteúdo adulto</h3>
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Ao continuar, você confirma que possui <strong style={{ color: "var(--text-main)" }}>18 anos ou mais</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={cancelNsfw} className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
                Cancelar
              </button>
              <button onClick={confirmNsfw} disabled={nsfwPopupCountdown > 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.85)", color: "#fff" }}>
                {nsfwPopupCountdown > 0 ? `Tenho 18+ anos (${nsfwPopupCountdown}s)` : "Tenho 18+ anos ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">

        {/* Header / Busca */}
        <div className="flex items-center gap-3 mb-5">
          <h1 className="text-2xl font-bold whitespace-nowrap tracking-tight" style={{ color: "var(--accent)", textShadow: "0 0 18px rgba(139,92,246,0.6)" }}>Lunaris</h1>
          <div className="relative flex-1">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-2 cursor-text min-h-11"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
              onClick={() => tagInputRef.current?.focus()}>
              <span className="text-sm" style={{ color: "var(--text-dim)" }}>🔍</span>
              {activeTags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(139,92,246,0.2)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                  {tag}
                  <button onClick={e => { e.stopPropagation(); removeTag(tag) }} className="leading-none hover:opacity-70">×</button>
                </span>
              ))}
              <input ref={tagInputRef} type="text" value={inputValue}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={activeTags.length === 0 ? "buscar wallpapers..." : "adicionar tag..."}
                className="flex-1 min-w-30 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-main)" }} />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {suggestions.map(s => (
                  <button key={s} onMouseDown={e => { e.preventDefault(); addTag(s) }}
                    className="w-full text-left px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: "var(--text-dim)" }}>{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Filtros linha 1: Tipo + Resolução ── */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            {TYPE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setWallType(opt.value)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={wallType === opt.value ? { background: "rgba(139,92,246,0.2)", color: "var(--accent)", border: "1px solid rgba(139,92,246,0.4)" } : { color: "var(--text-dim)", border: "1px solid transparent" }}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="w-px h-5" style={{ background: "var(--border)" }} />
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            {RESOLUTION_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setResolution(opt.value)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={resolution === opt.value ? { background: "rgba(139,92,246,0.2)", color: "var(--accent)", border: "1px solid rgba(139,92,246,0.4)" } : { color: "var(--text-dim)", border: "1px solid transparent" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filtros linha 2: Sort + Cor + Contagem ── */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {/* Sort: 3 categorias principais */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <button onClick={() => setSortCategory("popular")}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={sortCategory === "popular" ? { background: "rgba(139,92,246,0.2)", color: "var(--accent)", border: "1px solid rgba(139,92,246,0.4)" } : { color: "var(--text-dim)", border: "1px solid transparent" }}>
              🔥 Popular
            </button>
            <button onClick={() => setSortCategory("recent")}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={sortCategory === "recent" ? { background: "rgba(139,92,246,0.2)", color: "var(--accent)", border: "1px solid rgba(139,92,246,0.4)" } : { color: "var(--text-dim)", border: "1px solid transparent" }}>
              🕐 Recentes
            </button>
            <button onClick={() => setSortCategory("subscribed")}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={sortCategory === "subscribed" ? { background: "rgba(139,92,246,0.2)", color: "var(--accent)", border: "1px solid rgba(139,92,246,0.4)" } : { color: "var(--text-dim)", border: "1px solid transparent" }}>
              ⬇️ Mais inscritos
            </button>
          </div>

          <div className="w-px h-5" style={{ background: "var(--border)" }} />

          {/* Cor como dropdown */}
          <div className="relative" ref={colorMenuRef}>
            <button onClick={() => setShowColorMenu(v => !v)}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-all"
              style={colorFilter !== "all" ? pillStyle(true) : { background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
              {currentColor?.emoji} {currentColor?.label}
              <span className="text-[10px]">{showColorMenu ? "▲" : "▼"}</span>
            </button>
            {showColorMenu && (
              <div className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-20 min-w-40"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {COLOR_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setColorFilter(opt.value); setShowColorMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                    style={colorFilter === opt.value ? { color: "var(--accent)", background: "var(--accent-glow)" } : { color: "var(--text-dim)" }}>
                    <span>{opt.emoji}</span> {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
            {loadingMore && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            )}
            {filtered.length > 0 && <span>{filtered.length} wallpapers</span>}
          </div>
        </div>

        {/* ── Período do Popular (só aparece quando Popular está ativo) ── */}
        {sortCategory === "popular" && (
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {POPULAR_PERIODS.map(opt => (
              <button key={opt.value} onClick={() => setPopularPeriod(opt.value)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={popularPeriod === opt.value ? pillStyle(true) : { background: "var(--bg-surface)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: "var(--text-dim)" }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--tag-ai-text)", opacity: 0.7 }}/>tags do site</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--tag-steam-text)", opacity: 0.7 }}/>tags originais Steam</span>
        </div>

        {/* Tags da página */}
        {visible.length > 0 && (
          <div className="mb-4">
            <button onClick={() => setShowTagsPanel(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
              {showTagsPanel ? "▲" : "▼"} Tags nesta página ({pageTagSet.length})
            </button>
            {showTagsPanel && (
              <div className="mt-2 p-3 rounded-xl flex flex-wrap gap-1.5"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                {pageTagSet.map(tag => (
                  <button key={tag} onClick={() => addTag(tag)}
                    className="tag-panel text-xs px-2 py-0.5 rounded-full border hover:opacity-80">
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20" style={{ color: "var(--text-dim)" }}>Buscando...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--text-dim)" }}>Nenhum wallpaper encontrado &gt;&lt;</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visible.map(w => <WallpaperCard key={w.id} wallpaper={w} />)}
          </div>
        )}

        {/* Paginação */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-8">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0}
              className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}>←</button>
            {getPageNumbers().map((p, i) =>
              p === "..." ? <span key={`d${i}`} className="w-8 text-center text-sm" style={{ color: "var(--text-dim)" }}>···</span> : (
                <button key={p} onClick={() => goToPage(p as number)} className="w-8 h-8 rounded-lg text-sm"
                  style={p === currentPage ? { background: "rgba(139,92,246,0.3)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" } : { color: "var(--text-dim)", border: "1px solid transparent" }}>
                  {(p as number) + 1}
                </button>
              )
            )}
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}>→</button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight" style={{ color: "var(--accent)", textShadow: "0 0 14px rgba(139,92,246,0.5)" }}>Lunaris</span>
            <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>
              Desenvolvido por{" "}
              <a href="https://github.com/Marcusss197" target="_blank" rel="noopener noreferrer"
                className="hover:opacity-80" style={{ color: "#c4b5fd" }}>Marcusss</a>
            </span>
          </div>
          <div className="relative" ref={settingsRef}>
            <button onClick={() => setShowSettings(v => !v)} className="p-2 rounded-lg hover:opacity-70"
              style={{ color: "var(--text-dim)" }} aria-label="Configurações">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 rounded-xl p-4 w-72 space-y-4 z-20"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Configurações</p>
                <div className="flex items-center gap-3">
                  <button onClick={handleNsfwToggle}
                    className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                    style={{ background: nsfwEnabled ? "var(--accent)" : "rgba(255,255,255,0.15)" }}>
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                      style={{ transform: nsfwEnabled ? "translateX(20px)" : "translateX(0)" }} />
                  </button>
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>Conteúdo +18</span>
                  {nsfwEnabled && <span className="text-xs" style={{ color: "#c4b5fd" }}>✓ habilitado</span>}
                </div>
                {nsfwEnabled && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNsfwOnly(v => !v)}
                      className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                      style={{ background: nsfwOnly ? "rgba(239,68,68,0.8)" : "rgba(255,255,255,0.15)" }}>
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                        style={{ transform: nsfwOnly ? "translateX(20px)" : "translateX(0)" }} />
                    </button>
                    <span className="text-sm" style={{ color: "var(--text-dim)" }}>Somente +18</span>
                    {nsfwOnly && <span className="text-xs" style={{ color: "rgba(239,68,68,0.8)" }}>filtrando</span>}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={() => setLightMode(v => !v)}
                    className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                    style={{ background: lightMode ? "rgba(124,58,237,0.8)" : "rgba(255,255,255,0.15)" }}>
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                      style={{ transform: lightMode ? "translateX(20px)" : "translateX(0)" }} />
                  </button>
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>Light mode {lightMode ? "☀️" : "🌙"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
