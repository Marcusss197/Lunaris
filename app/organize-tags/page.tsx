// Lunaris - Organização manual de tags
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { DbWallpaper, OrganizeSortBy } from "@/lib/db-types"

const PAGE_SIZE = 60

const SORT_OPTIONS: { value: OrganizeSortBy; label: string }[] = [
  { value: "tagged_at", label: "Recém-taggeados" },
  { value: "downloads", label: "Mais inscritos" },
  { value: "indexed_at", label: "Recém-indexados" },
]

export default function OrganizeTagsPage() {
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [excludeQuery, setExcludeQuery] = useState("")
  const [excludeApplied, setExcludeApplied] = useState("")
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [nsfwOnly, setNsfwOnly] = useState(false)
  const [withTagsOnly, setWithTagsOnly] = useState(false)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [sortBy, setSortBy] = useState<OrganizeSortBy>("tagged_at")
  const [wallpapers, setWallpapers] = useState<DbWallpaper[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [selectedDetails, setSelectedDetails] = useState<Map<number, { id: number; title: string; preview_url: string }>>(new Map())
  const [showSelectedPanel, setShowSelectedPanel] = useState(false)

  const [addTagsInput, setAddTagsInput] = useState("")
  const [removeTagsInput, setRemoveTagsInput] = useState("")
  const [nsfwAction, setNsfwAction] = useState<"none" | "nsfw" | "sfw">("none")
  const [applying, setApplying] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let ignore = false

    ;(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          q: search,
          offset: String(offset),
          limit: String(PAGE_SIZE),
          sort: sortBy,
        })
        if (onlyFlagged) params.set("flagged", "1")
        if (nsfwOnly) params.set("nsfw", "1")
        if (withTagsOnly) params.set("withTags", "1")
        if (pendingOnly) params.set("pending", "1")
        if (excludeApplied.trim()) params.set("exclude", excludeApplied.trim())

        const res = await fetch(`/api/organize-tags?${params}`)
        const data = await res.json()
        if (ignore) return
        setWallpapers(data.wallpapers ?? [])
        setHasMore(data.hasMore ?? false)
      } catch {
        if (!ignore) {
          setWallpapers([])
          setHasMore(false)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    })()

    return () => { ignore = true }
  }, [search, excludeApplied, offset, onlyFlagged, nsfwOnly, withTagsOnly, pendingOnly, sortBy, refreshKey])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
    setSelected(new Set())
    setSearch(query.trim())
    setExcludeApplied(excludeQuery.trim())
  }

  function toggleSelect(w: DbWallpaper) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(w.id)) next.delete(w.id)
      else next.add(w.id)
      return next
    })
    setSelectedDetails(prev => {
      const next = new Map(prev)
      if (next.has(w.id)) next.delete(w.id)
      else next.set(w.id, { id: w.id, title: w.title, preview_url: w.preview_url })
      return next
    })
  }

  function removeFromSelection(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setSelectedDetails(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelected(prev => {
      const next = new Set(prev)
      for (const w of wallpapers) next.add(w.id)
      return next
    })
    setSelectedDetails(prev => {
      const next = new Map(prev)
      for (const w of wallpapers) next.set(w.id, { id: w.id, title: w.title, preview_url: w.preview_url })
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
    setSelectedDetails(new Map())
    setShowSelectedPanel(false)
  }

  async function applyChanges() {
    const addTags = addTagsInput.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
    const removeTags = removeTagsInput.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)

    if (selected.size === 0) {
      setFeedback("Selecione ao menos um wallpaper.")
      return
    }
    if (addTags.length === 0 && removeTags.length === 0 && nsfwAction === "none") {
      setFeedback("Informe tags pra adicionar/remover ou escolha NSFW/SFW.")
      return
    }

    setApplying(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/organize-tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          addTags,
          removeTags,
          isNsfw: nsfwAction === "none" ? undefined : nsfwAction === "nsfw",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback(`Erro: ${data.error ?? "desconhecido"}`)
      } else {
        setFeedback(`✓ ${data.updated} wallpaper(s) atualizado(s).`)
        setAddTagsInput("")
        setRemoveTagsInput("")
        setNsfwAction("none")
        setSelected(new Set())
        setSelectedDetails(new Map())
        setShowSelectedPanel(false)
        setRefreshKey(k => k + 1)
      }
    } catch {
      setFeedback("Erro de rede ao salvar.")
    } finally {
      setApplying(false)
    }
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  async function handlePendingTag(action: "approve" | "reject", wallpaperId: number, tag: string) {
    try {
      const res = await fetch("/api/organize-tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, wallpaperId, tag }),
      })
      if (res.ok) {
        setWallpapers(prev => prev.map(w => {
          if (w.id !== wallpaperId) return w
          return { ...w, pending_tags: (w.pending_tags ?? []).filter(t => t !== tag) }
        }))
        setFeedback(action === "approve" ? `✓ Tag "${tag}" aprovada.` : `✗ Tag "${tag}" rejeitada.`)
      } else {
        setFeedback("Erro ao processar a tag.")
      }
    } catch {
      setFeedback("Erro de rede.")
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-6xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">
              <span className="lunaris-logo">Lunaris</span>
              <span className="text-zinc-400"> — Organizar Tags</span>
            </h1>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por título ou tag (ex: cyberpunk)"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="text"
              value={excludeQuery}
              onChange={e => setExcludeQuery(e.target.value)}
              placeholder="Excluir quem já tem (ex: anime, furry)"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium hover:bg-purple-500 transition-colors"
            >
              Buscar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400 whitespace-nowrap">
              <input
                type="checkbox"
                checked={onlyFlagged}
                onChange={e => { setOnlyFlagged(e.target.checked); setOffset(0); setSelected(new Set()) }}
                className="accent-purple-500"
              />
              só com avisos de revisão
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-400 whitespace-nowrap">
              <input
                type="checkbox"
                checked={nsfwOnly}
                onChange={e => { setNsfwOnly(e.target.checked); setOffset(0); setSelected(new Set()) }}
                className="accent-purple-500"
              />
              somente +18
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-400 whitespace-nowrap">
              <input
                type="checkbox"
                checked={withTagsOnly}
                onChange={e => { setWithTagsOnly(e.target.checked); setOffset(0); setSelected(new Set()) }}
                className="accent-purple-500"
              />
              somente com tags
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-400 whitespace-nowrap">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={e => { setPendingOnly(e.target.checked); setOffset(0); setSelected(new Set()) }}
                className="accent-amber-500"
              />
              <span className="text-amber-400">🕐 tags pendentes</span>
            </label>
          </div>
        </div>

        <div className="mx-auto max-w-6xl mt-2 flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSortBy(opt.value); setOffset(0); setSelected(new Set()) }}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                sortBy === opt.value
                  ? "border-purple-500 bg-purple-600/30 text-purple-200"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* Toolbar de seleção */}
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span>
          {loading ? "Carregando..." : `${wallpapers.length} wallpaper${wallpapers.length === 1 ? "" : "s"}${hasMore ? "+" : ""}`}
          {search && <> para &ldquo;<span className="text-zinc-200">{search}</span>&rdquo;</>}
          {excludeApplied && <> sem <span className="text-amber-400">{excludeApplied}</span></>}
        </span>
        <button onClick={selectAllVisible} className="text-purple-400 hover:text-purple-300">
          Selecionar visíveis ({wallpapers.length})
        </button>
        {selected.size > 0 && (
          <button onClick={clearSelection} className="text-zinc-400 hover:text-zinc-200">
            Limpar seleção ({selected.size})
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {wallpapers.map(w => {
          const isSelected = selected.has(w.id)
          const allTags = Array.from(new Set([...(w.ai_tags ?? []), ...(w.user_tags ?? [])]))
          return (
            <div
              key={w.id}
              className={`group relative flex flex-col overflow-hidden rounded-lg border transition-all ${
                isSelected
                  ? "border-purple-500 ring-2 ring-purple-500/60"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              {/* Checkbox de seleção — fica por cima do link, não navega */}
              <button
                onClick={() => toggleSelect(w)}
                aria-label="Selecionar"
                className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border border-white/40 bg-black/60 hover:border-purple-400"
              >
                {isSelected && <span className="text-purple-400 text-xs">✓</span>}
              </button>

              {w.is_nsfw && (
                <span className="absolute left-2 top-2 z-10 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-semibold">
                  18+
                </span>
              )}

              {/* Abre o wallpaper em nova aba (devmode: precisa inspecionar facilmente) */}
              <Link href={`/wallpaper/${w.id}`} target="_blank" rel="noopener noreferrer" className="block">
                <div className="relative aspect-video bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={w.preview_url}
                    alt={w.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1 p-2">
                  <p className="line-clamp-2 text-xs font-medium text-zinc-200">{w.title}</p>
                  <p className="text-[10px] text-zinc-500">
                    #{w.id} · {w.author_name || "autor desconhecido"}
                  </p>

                  {w.review_flags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {w.review_flags.map(flag => (
                        <span key={flag} className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                          ⚠ {flag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {allTags.slice(0, 6).map(tag => (
                      <span key={tag} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {tag}
                      </span>
                    ))}
                    {allTags.length > 6 && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        +{allTags.length - 6}
                      </span>
                    )}
                    {allTags.length === 0 && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 italic">
                        sem tags
                      </span>
                    )}
                  </div>

                  {pendingOnly && (w.pending_tags ?? []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <p className="text-[10px] font-medium text-amber-400 mb-1.5">🕐 Sugestões pendentes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(w.pending_tags ?? []).map(tag => (
                          <div key={tag} className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1">
                            <span className="text-[11px] font-medium text-amber-300">{tag}</span>
                            <button
                              onClick={e => { e.preventDefault(); e.stopPropagation(); handlePendingTag("approve", w.id, tag) }}
                              title="Aprovar"
                              className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-green-300 transition-colors text-[12px] font-bold"
                            >✓</button>
                            <button
                              onClick={e => { e.preventDefault(); e.stopPropagation(); handlePendingTag("reject", w.id, tag) }}
                              title="Rejeitar"
                              className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors text-[12px] font-bold"
                            >✗</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {!loading && wallpapers.length === 0 && (
        <p className="mx-auto max-w-6xl px-4 py-12 text-center text-zinc-500">
          Nenhum wallpaper encontrado.
        </p>
      )}

      {/* Paginação */}
      {(offset > 0 || hasMore) && (
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-center gap-3 text-sm text-zinc-400">
          <button
            onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded border border-zinc-700 px-3 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span>Página {currentPage}</span>
          <button
            onClick={() => setOffset(o => o + PAGE_SIZE)}
            disabled={!hasMore}
            className="rounded border border-zinc-700 px-3 py-1 disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Painel de edição em massa */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between pb-2">
              <button
                onClick={() => setShowSelectedPanel(s => !s)}
                className="text-xs font-medium text-purple-400 hover:text-purple-300"
              >
                {showSelectedPanel ? "▼" : "▶"} {selected.size} wallpaper{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}
              </button>
              <button onClick={clearSelection} className="text-xs text-zinc-400 hover:text-zinc-200">
                Limpar tudo
              </button>
            </div>

            {showSelectedPanel && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {Array.from(selectedDetails.values()).map(w => (
                  <div key={w.id} className="group relative w-20 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.preview_url} alt={w.title} className="h-12 w-20 rounded object-cover" />
                    <button
                      onClick={() => removeFromSelection(w.id)}
                      aria-label="Remover da seleção"
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 hover:bg-red-600"
                    >
                      ×
                    </button>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">#{w.id}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">Adicionar tags em ai_tags (vírgula)</label>
                <input
                  type="text"
                  value={addTagsInput}
                  onChange={e => setAddTagsInput(e.target.value)}
                  placeholder="cyberpunk, neon, city"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">Remover de ai_tags (vírgula)</label>
                <input
                  type="text"
                  value={removeTagsInput}
                  onChange={e => setRemoveTagsInput(e.target.value)}
                  placeholder="generic_tag"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-1">
                {(["none", "sfw", "nsfw"] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setNsfwAction(opt)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      nsfwAction === opt
                        ? "border-purple-500 bg-purple-600/30 text-purple-200"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {opt === "none" ? "Não alterar" : opt === "sfw" ? "Marcar SFW" : "Marcar 18+"}
                  </button>
                ))}
              </div>

              <button
                onClick={applyChanges}
                disabled={applying}
                className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-semibold hover:bg-purple-500 transition-colors disabled:opacity-50"
              >
                {applying ? "Aplicando..." : `Aplicar a ${selected.size}`}
              </button>
            </div>
            {feedback && <p className="mt-2 text-xs text-zinc-400">{feedback}</p>}
          </div>
        </div>
      )}
    </div>
  )
}