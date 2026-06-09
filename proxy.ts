// proxy.ts — Lunaris
// Redireciona rotas inválidas e protege rotas de dev

import { NextRequest, NextResponse } from "next/server"

const HOME = "https://lunaris-marcusss.vercel.app"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /wallpaper/ sem ID → redireciona pro home
  if (pathname === "/wallpaper" || pathname === "/wallpaper/") {
    return NextResponse.redirect(HOME)
  }

  // Rotas de API protegidas por DEV_MODE
  const devOnlyRoutes = ["/api/migrate-titles"]
  if (devOnlyRoutes.some(route => pathname.startsWith(route))) {
    const devMode = process.env.DEV_MODE === "true"
    if (!devMode) {
      return NextResponse.redirect(HOME)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/wallpaper", "/wallpaper/", "/api/migrate-titles/:path*"],
}