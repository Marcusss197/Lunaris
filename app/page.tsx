// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Wallpaper } from "@/types/wallpaper"
import { WallpaperType, SortMode } from "@/lib/steam"
import WallpaperCard from "@/components/WallpaperCard"

// Tags sugeridas no autocomplete da busca
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

// "Popular" abre submenu com período; os outros são diretos
const SORT_DIRECT: { label: string; value: SortMode }[] = [
  { label: "Recentes", value: "recent" },
  { label: "Mais inscritos", value: "subscribed" },
]

const SORT_POPULAR_SUB: { label: string; value: SortMode }[] = [
  { label: "Esta semana", value: "popular_week" },
  { label: "Este mês", value: "popular_month" },
  { label: "3 meses", value: "popular_3months" },
  { label: "Este ano", value: "popular_year" },
  { label: "Desde o início", value: "popular_alltime" },
]

// Mapeia tipo de filtro para tag da Steam
const TYPE_TAG_MAP: Record<WallpaperType, string | null> = {
  all: null,
  Scene: "scene",
  Video: "video",
  Application: "application",
}

const PER_PAGE = 30

function getSortLabel(sort: SortMode): string {
  if (sort === "recent") return "Recentes"
  if (sort === "subscribed") return "Mais inscritos"
  const sub = SORT_POPULAR_SUB.find((s) => s.value === sort)
  return sub ? `Popular · ${sub.label}` : "Popular"
}

export default function Home() {
  const [inputValue, setInputValue] = useState("")
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [allWallpapers, setAllWallpapers] = useState<Wallpaper[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nsfwEnabled, setNsfwEnabled] = useState(false)
  const [nsfwOnly, setNsfwOnly] = useState(false)
  const [nsfwCountdown, setNsfwCountdown] = useState<number | null>(null)
  const [nsfwPending, setNsfwPending] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [page, setPage] = useState(0)
  const [sortMode, setSortMode] = useState<SortMode>("popular_alltime")
  const [wallType, setWallType] = useState<WallpaperType>("all")
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showPopularSub, setShowPopularSub] = useState(false)

  const tagInputRef = useRef<HTMLInputElement>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<number>(0)
  const seenIdsRef = useRef<Set<number>>(new Set())

  // Filtra localmente por tipo e nsfw sem precisar de nova requisição
  const filtered = allWallpapers.filter((w) => {
    if (!nsfwEnabled && w.isNsfw) return false
    if (nsfwEnabled && nsfwOnly && !w.isNsfw) return false
    const typeTag = TYPE_TAG_MAP[wallType]
    if (typeTag && !w.steamTags.map((t) => t.toLowerCase()).includes(typeTag)) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  // Garante que a página atual não ultrapassa o total
  const currentPage = Math.min(page, Math.max(0, totalPages - 1))
  const visible = filtered.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE)

  // Busca principal — carrega primeiro batch e continua em background
  const startFetch = useCallback(async (query: string, sort: SortMode) => {
    const session = Date.now()
    sessionRef.current = session
    seenIdsRef.current = new Set()

    setLoading(true)
    setLoadingMore(false)
    setAllWallpapers([])
    setPage(0)

    try {
      // Primeiro batch: 10 páginas da Steam (aparece rápido)
      const res = await fetch(`/api/search?${new URLSearchParams({ q: query, sort, cursor: "*", pages: "10" })}`)
      if (!res.ok || sessionRef.current !== session) { setLoading(false); return }
      const data = await res.json()

      const batch: Wallpaper[] = (data.wallpapers ?? []).filter((w: Wallpaper) => {
        if (seenIdsRef.current.has(w.id)) return false
        seenIdsRef.current.add(w.id)
        return true
      })

      setAllWallpapers(batch)
      setLoading(false)

      // Continua carregando em background enquanto o usuário navega
      let nextCursor: string | null = data.nextCursor
      if (!nextCursor) return
      setLoadingMore(true)

      while (nextCursor && sessionRef.current === session) {
        const moreRes: Response = await fetch(
          `/api/search?${new URLSearchParams({ q: query, sort, cursor: nextCursor, pages: "5" })}`
        )
        if (!moreRes.ok || sessionRef.current !== session) break
        const moreData: { wallpapers?: Wallpaper[]; nextCursor?: string } = await moreRes.json()

        const moreBatch: Wallpaper[] = (moreData.wallpapers ?? []).filter((w: Wallpaper) => {
          if (seenIdsRef.current.has(w.id)) return false
          seenIdsRef.current.add(w.id)
          return true
        })

        if (moreBatch.length > 0) setAllWallpapers((prev) => [...prev, ...moreBatch])
        nextCursor = moreData.nextCursor ?? null
        if (!nextCursor) break
      }

      if (sessionRef.current === session) setLoadingMore(false)
    } catch (err) {
      console.error("Erro ao buscar wallpapers:", err)
      if (sessionRef.current === session) { setLoading(false); setLoadingMore(false) }
    }
  }, [])

  // Dispara nova busca quando query, tags, ordenação ou nsfw mudam
  useEffect(() => {
    const fullQuery = [inputValue, ...activeTags].filter(Boolean).join(" ")
    const timer = setTimeout(() => startFetch(fullQuery, sortMode), 400)
    return () => clearTimeout(timer)
  }, [inputValue, activeTags, sortMode, nsfwEnabled, startFetch])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
        setShowPopularSub(false)
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleInputChange(value: string) {
    setInputValue(value)
    if (!value.trim()) { setSuggestions([]); return }
    const lower = value.toLowerCase()
    setSuggestions(
      SUGGESTED_TAGS.filter((t) => t.includes(lower) && !activeTags.includes(t)).slice(0, 8)
    )
  }

  function addTag(tag: string) {
    const clean = tag.trim().toLowerCase()
    if (!clean || activeTags.includes(clean)) { setInputValue(""); setSuggestions([]); return }
    setActiveTags((prev) => [...prev, clean])
    setInputValue("")
    setSuggestions([])
    tagInputRef.current?.focus()
  }

  function removeTag(tag: string) {
    setActiveTags((prev) => prev.filter((t) => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && inputValue.trim()) { e.preventDefault(); addTag(inputValue) }
    if (e.key === "Backspace" && !inputValue && activeTags.length > 0) {
      removeTag(activeTags[activeTags.length - 1])
    }
  }

  function handleNsfwToggle() {
    if (nsfwEnabled) {
      setNsfwEnabled(false)
      setNsfwOnly(false)
      setNsfwPending(false)
      setNsfwCountdown(null)
      if (countdownRef.current) clearInterval(countdownRef.current)
      return
    }
    if (nsfwPending) return
    setNsfwPending(true)
    let count = 5
    setNsfwCountdown(count)
    countdownRef.current = setInterval(() => {
      count--
      setNsfwCountdown(count)
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setNsfwCountdown(null)
        setNsfwPending(false)
        setNsfwEnabled(true)
      }
    }, 1000)
  }

  function goToPage(p: number) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Paginação com reticências para muitas páginas
  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i)
    const pages: (number | "...")[] = [0]
    if (currentPage > 2) pages.push("...")
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages - 2, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 3) pages.push("...")
    pages.push(totalPages - 1)
    return pages
  }

  const isPopularSort = SORT_POPULAR_SUB.some((s) => s.value === sortMode)

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: "var(--bg-base)" }}>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">

        {/* Cabeçalho com busca */}
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold whitespace-nowrap tracking-tight">
            <span style={{ color: "var(--accent)", textShadow: "0 0 18px rgba(139,92,246,0.6)" }}>
              Lunaris
            </span>
          </h1>

          <div className="relative flex-1">
            {/* Campo de busca com chips de tags */}
            <div
              className="flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-2 cursor-text min-h-11 transition-all"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
              onFocus={() => {}}
              onClick={() => tagInputRef.current?.focus()}
            >
              <span className="text-white/30 text-sm">🔍</span>

              {activeTags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/30">
                  {tag}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                    className="text-purple-400 hover:text-purple-200 leading-none"
                    aria-label={`Remover tag ${tag}`}
                  >×</button>
                </span>
              ))}

              <input
                ref={tagInputRef}
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={activeTags.length === 0 ? "buscar wallpapers..." : "adicionar tag..."}
                className="flex-1 min-w-30 bg-transparent text-sm text-white placeholder-white/25 outline-none"
              />
            </div>

            {/* Dropdown de autocomplete */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{ color: "var(--text-dim)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-glow)"; e.currentTarget.style.color = "#fff" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filtros: tipo + ordenação */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">

          {/* Filtro por tipo */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWallType(opt.value)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={wallType === opt.value ? {
                  background: "rgba(139,92,246,0.2)",
                  color: "#c4b5fd",
                  border: "1px solid rgba(139,92,246,0.4)",
                  boxShadow: "0 0 8px rgba(139,92,246,0.2)",
                } : {
                  color: "var(--text-dim)",
                  border: "1px solid transparent",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Ordenação com submenu para "Popular" */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => { setShowSortMenu((v) => !v); setShowPopularSub(false) }}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-all"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
            >
              Ordenar: <span style={{ color: "#c4b5fd" }}>{getSortLabel(sortMode)}</span>
              <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{showSortMenu ? "▲" : "▼"}</span>
            </button>

            {showSortMenu && (
              <div className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-20 min-w-45" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {/* Popular abre submenu lateral */}
                <div className="relative">
                  <button
                    onClick={() => setShowPopularSub((v) => !v)}
                    className="w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors"
                    style={isPopularSort ? { color: "#c4b5fd", background: "var(--accent-glow)" } : { color: "var(--text-dim)" }}
                  >
                    Popular
                    <span className="text-[10px]">▶</span>
                  </button>

                  {showPopularSub && (
                    <div className="absolute left-full top-0 ml-1 rounded-xl overflow-hidden min-w-37.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      {SORT_POPULAR_SUB.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortMode(opt.value); setShowSortMenu(false); setShowPopularSub(false) }}
                          className="w-full text-left px-4 py-2 text-sm transition-colors"
                          style={sortMode === opt.value ? { color: "#c4b5fd", background: "var(--accent-glow)" } : { color: "var(--text-dim)" }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {SORT_DIRECT.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortMode(opt.value); setShowSortMenu(false); setShowPopularSub(false) }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={sortMode === opt.value ? { color: "#c4b5fd", background: "var(--accent-glow)" } : { color: "var(--text-dim)" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contagem + spinner de carregamento em background */}
          <div className="ml-auto flex items-center gap-2 text-xs text-white/25">
            {loadingMore && (
              <svg className="animate-spin text-purple-400/60" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            )}
            {filtered.length > 0 && <span>{filtered.length} wallpapers</span>}
          </div>
        </div>

        {/* Legenda das tags */}
        <div className="flex items-center gap-3 mb-4 text-xs text-white/25">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400/60 inline-block" />
            tags do site
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400/40 inline-block" />
            tags originais Steam
          </span>
        </div>

        {/* Grid de wallpapers */}
        {loading ? (
          <div className="text-center py-20 text-white/30">Buscando...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 text-white/30">Nenhum wallpaper encontrado &gt;&lt;</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visible.map((w) => <WallpaperCard key={w.id} wallpaper={w} />)}
          </div>
        )}

        {/* Paginação */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-8">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >←</button>

            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="w-8 text-center text-white/25 text-sm">···</span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p as number)}
                  className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                    p === currentPage
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                      : "text-white/40 hover:text-white hover:bg-white/10 border border-transparent"
                  }`}
                >
                  {(p as number) + 1}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >→</button>
          </div>
        )}
      </main>

      {/* Footer com configurações */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight" style={{ color: "var(--accent)", textShadow: "0 0 14px rgba(139,92,246,0.5)" }}>
              Lunaris
            </span>
            <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>
              Desenvolvido por{" "}
              <a
                href="https://github.com/Marcusss197"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors"
                style={{ color: "#c4b5fd" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#c4b5fd"}
              >
                Marcusss
              </a>
            </span>
          </div>

          {/* Engrenagem — abre popup de configurações */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
              aria-label="Configurações"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 rounded-xl p-4 w-72 space-y-4 z-20" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wide">Configurações</p>

                {/* Toggle conteúdo +18 com countdown de confirmação */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleNsfwToggle}
                    disabled={nsfwPending}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${nsfwEnabled ? "bg-purple-500" : "bg-white/20"} disabled:opacity-60`}
                    aria-label="Ativar conteúdo +18"
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${nsfwEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className="text-sm text-white/70">Conteúdo +18</span>
                  {nsfwPending && nsfwCountdown !== null && (
                    <span className="text-xs text-yellow-400">⚠️ ativando em {nsfwCountdown}s</span>
                  )}
                  {nsfwEnabled && !nsfwPending && (
                    <span className="text-xs text-purple-400">✓ habilitado</span>
                  )}
                </div>

                {/* Opção "só +18" — aparece quando adulto está ativo */}
                {nsfwEnabled && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNsfwOnly((v) => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${nsfwOnly ? "bg-red-500" : "bg-white/20"}`}
                      aria-label="Mostrar somente conteúdo +18"
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${nsfwOnly ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                    <span className="text-sm text-white/70">Somente +18</span>
                    {nsfwOnly && <span className="text-xs text-red-400">filtrando</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
