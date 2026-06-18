// app/u/[id]/page.tsx
// Lunaris - Perfil de autor
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import WallpaperCard from "@/components/WallpaperCard"
import { fromDbWallpaper, DbWallpaper, AuthorProfile } from "@/lib/db-types"
import { Wallpaper } from "@/types/wallpaper"

const PAGE_SIZE = 60

type SortBy = "downloads" | "recent"

export default function AuthorProfilePage() {
  const params = useParams()
  const id = params.id as string

  const [profile, setProfile] = useState<AuthorProfile | null>(null)
  const [wallpapers, setWallpapers] = useState<DbWallpaper[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>("downloads")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    let ignore = false

    ;(async () => {
      // Guarda de sanidade: SteamID64 sempre tem 17 dígitos. Se o id que
      // chegou aqui não bate com esse formato, é um publishedfileid (de
      // wallpaper) vazado por engano durante uma transição de rota — não
      // dispara o fetch.
      if (!/^\d{17}$/.test(id) && id !== "unknown") {
        console.warn(`[/u/${id}] id não parece um SteamID64 válido — ignorando fetch`)
        if (!ignore) {
          setNotFound(true)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const qs = new URLSearchParams({
          sort: sortBy,
          offset: String(offset),
          limit: String(PAGE_SIZE),
        })
        if (activeTag) qs.set("tag", activeTag)

        const res = await fetch(`/api/author/${id}?${qs}`)
        if (ignore) return

        if (!res.ok) {
          setNotFound(true)
          setLoading(false)
          return
        }

        const data = await res.json()
        setProfile(data.profile)
        setWallpapers(data.wallpapers ?? [])
        setHasMore(data.hasMore ?? false)
        if (data.profile?.authorName) {
          document.title = `${data.profile.authorName} — Lunaris`
        }
      } catch {
        if (!ignore) setNotFound(true)
      } finally {
        if (!ignore) setLoading(false)
      }
    })()

    return () => { ignore = true }
  }, [id, sortBy, activeTag, offset])

  function handleTagClick(tag: string) {
    setActiveTag(prev => (prev === tag ? null : tag))
    setOffset(0)
  }

  function handleSortChange(s: SortBy) {
    if (s === sortBy) return
    setSortBy(s)
    setOffset(0)
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg-main)", color: "var(--text-main)" }}>
        <p className="text-lg">Esse autor ainda não foi encontrado.</p>
        <Link href="/" className="text-sm hover:underline" style={{ color: "var(--text-dim)" }}>← Voltar pro início</Link>
      </div>
    )
  }

  const wallpapersAsCards: Wallpaper[] = wallpapers.map(fromDbWallpaper)

  // "Tags nesta página": todas as tags únicas dos wallpapers ATUALMENTE
  // exibidos (não é ranking de popularidade do autor — isso é uma feature
  // futura separada, que vai morar no card da sidebar quando existir).
  const pageTagsSet = new Set<string>()
  for (const w of wallpapers) {
    for (const t of [...(w.ai_tags ?? []), ...(w.user_tags ?? []), ...(w.steam_tags ?? [])]) {
      pageTagsSet.add(t)
    }
  }
  const pageTags = Array.from(pageTagsSet).sort()

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)", color: "var(--text-main)" }}>
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm mb-12 hover:underline" style={{ color: "var(--text-dim)" }}>
          ← Voltar
        </Link>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
          {/* ── Sidebar: card do autor ───────────────────────────────────── */}
          <aside style={{ width: "280px", flexShrink: 0, alignSelf: "flex-start" }}>
            <div
              className="rounded-xl p-6 flex flex-col"
              style={{ border: "1px solid var(--border)", background: "var(--bg-card)", position: "sticky", top: "24px", minHeight: "560px" }}
            >
              {profile ? (
                <>
                  <div className="flex flex-col items-center text-center">
                    {profile.authorAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.authorAvatar}
                        alt={profile.authorName}
                        className="rounded-full mb-3"
                        style={{ width: 112, height: 112 }}
                      />
                    ) : (
                      <div
                        className="rounded-full flex items-center justify-center text-3xl font-bold tag-add border mb-3"
                        style={{ width: 112, height: 112 }}
                      >
                        {(profile.authorName || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <h1 className="text-xl font-semibold" style={{ color: "#c4b5fd" }}>
                      {profile.authorName || "Autor desconhecido"}
                    </h1>
                    <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                      {profile.wallpaperCount} wallpaper{profile.wallpaperCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  {/* Espaço reservado pra "especialidade do autor" — feature
                      futura que vai analisar as tags de todos os wallpapers
                      do autor (não só os exibidos na página atual, isso é o
                      "Tags nesta página" abaixo) e mostrar as mais frequentes
                      aqui, tipo um perfil de gêneros. Placeholder visual por
                      enquanto pra dar uma ideia de como vai ficar. */}
                  <div className="mt-4 pt-4 border-t flex-1" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[11px] font-medium mb-2.5" style={{ color: "var(--text-dim)" }}>
                      Especialidade
                    </p>
                    <div className="flex flex-wrap gap-1.5 opacity-40">
                      <span className="text-[11px] px-2.5 py-1 rounded-full border tag-ai">Em breve :3</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-center" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
                      Mais informações em breve :3
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 animate-pulse">
                  <div className="rounded-full" style={{ width: 112, height: 112, background: "var(--bg-surface)" }} />
                  <div className="h-4 w-24 rounded" style={{ background: "var(--bg-surface)" }} />
                </div>
              )}
            </div>
          </aside>

          {/* ── Conteúdo principal: tags + filtros + galeria ─────────────── */}
          <main style={{ flex: "1 1 600px", minWidth: 0 }}>
            {/* Tags nesta página: todas as tags únicas dos wallpapers exibidos
                no momento, recolhível pra não virar parede de tags.
                (A "especialidade do autor" é uma feature futura separada,
                que vai morar no card da sidebar — não é isto aqui.) */}
            {pageTags.length > 0 && (
              <div className="rounded-xl p-4 mb-5" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                <button
                  onClick={() => setTagsExpanded(v => !v)}
                  className="flex items-center gap-2 text-xs font-medium w-full"
                  style={{ color: "var(--text-dim)" }}
                >
                  <span style={{ display: "inline-block", transform: tagsExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                    ▸
                  </span>
                  Tags nesta página ({pageTags.length})
                </button>

                {tagsExpanded && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {pageTags.map(tag => {
                      const isActive = activeTag === tag
                      const displayTag = tag.length > 28 ? `${tag.slice(0, 26)}…` : tag
                      return (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          title={tag}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition-all max-w-55 truncate ${isActive ? "" : "tag-ai"}`}
                          style={isActive ? { background: "rgba(139,92,246,0.35)", borderColor: "#8b5cf6", color: "#e9d5ff" } : undefined}
                        >
                          {displayTag}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Filtros de ordenação + tag ativa */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex gap-1 p-1 rounded-full" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <button
                  onClick={() => handleSortChange("downloads")}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                  style={sortBy === "downloads" ? { background: "rgba(139,92,246,0.35)", color: "#e9d5ff" } : { color: "var(--text-dim)" }}
                >
                  Mais inscritos
                </button>
                <button
                  onClick={() => handleSortChange("recent")}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                  style={sortBy === "recent" ? { background: "rgba(139,92,246,0.35)", color: "#e9d5ff" } : { color: "var(--text-dim)" }}
                >
                  Recentes
                </button>
              </div>

              {activeTag && (
                <span
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd" }}
                >
                  {activeTag}
                  <button onClick={() => setActiveTag(null)} className="hover:opacity-70 font-bold">×</button>
                </span>
              )}
            </div>

            {/* Grid de wallpapers */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl aspect-video animate-pulse"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  />
                ))}
              </div>
            ) : wallpapersAsCards.length === 0 ? (
              <p className="text-center py-16 text-sm" style={{ color: "var(--text-dim)" }}>
                Nenhum wallpaper encontrado.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
                {wallpapersAsCards.map(w => <WallpaperCard key={w.id} wallpaper={w} />)}
              </div>
            )}

            {/* Paginação */}
            {(offset > 0 || hasMore) && (
              <div className="flex items-center justify-center gap-3 py-6 text-sm">
                <button
                  onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 rounded-full border disabled:opacity-40 transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setOffset(o => o + PAGE_SIZE)}
                  disabled={!hasMore}
                  className="px-3 py-1.5 rounded-full border disabled:opacity-40 transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                >
                  Próxima →
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}