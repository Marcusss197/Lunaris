import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://lunaris-marcusss.vercel.app";

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lunaris",
  description: "Buscador de Wallpapers com Filtros & Tags — Wallpaper Engine via Steam.",
  openGraph: {
    title: "Lunaris",
    description: "Buscador de Wallpapers com Filtros & Tags — Wallpaper Engine via Steam.",
    url: SITE_URL,
    siteName: "Lunaris",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Lunaris — Buscador de Wallpapers",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lunaris",
    description: "Buscador de Wallpapers com Filtros & Tags — Wallpaper Engine via Steam.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}