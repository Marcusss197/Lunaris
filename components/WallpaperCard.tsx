// Lunaris - Buscador de Wallpapers com Filtros & Tags (Wallpaper Engine via Steam).
// Desenvolvido por Marcusss197 | https://github.com/Marcusss197

"use client"

import { Wallpaper } from "@/types/wallpaper"
import { formatDownloads } from "@/lib/steam"

interface WallpaperCardProps {
  wallpaper: Wallpaper
}

export default function WallpaperCard({ wallpaper }: WallpaperCardProps) {
  return (
    <a
      href={wallpaper.steamUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/25 hover:bg-white/10 transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="relative aspect-video bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wallpaper.previewUrl}
          alt={wallpaper.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {wallpaper.isAnimated && (
          <span className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-black/60 text-white">
            ▶ animado
          </span>
        )}
        {wallpaper.isNsfw && (
          <span className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-red-500/80 text-white">
            +18
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-white/90 truncate mb-2">
          {wallpaper.title}
        </p>

        <div className="flex flex-wrap gap-1 mb-2">
          {/* Tags do site (roxo) */}
          {wallpaper.tags.slice(0, 3).map((tag) => (
            <span
              key={`site-${tag}`}
              className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/20"
            >
              {tag}
            </span>
          ))}
          {/* Tags originais da Steam (cinza azulado) */}
          {wallpaper.steamTags.slice(0, 2).map((tag) => (
            <span
              key={`steam-${tag}`}
              className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400/70 border border-sky-500/20"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs text-white/40">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {formatDownloads(wallpaper.downloads)}
        </div>
      </div>
    </a>
  )
}
