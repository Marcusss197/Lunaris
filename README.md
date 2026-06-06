# Lunaris 🌙

Buscador de wallpapers do Wallpaper Engine com filtros avançados, tradução automática de títulos e detecção de tags por IA.

## Objetivo Principal

A Steam não tem filtros decentes. Títulos com kanji dificultam ao buscar por wallpapers especificos (Ex: Lucy Cyberpunk, irá aparecer wallpapers com TITULOS "Lucy" "Cyberpunk", e pode até aparecer wallpaper que tem a tag "Cyberpunk", mas se tiver um wallpaper da Lucy, mas que não esteja no titulo, não aparece). Não tem filtro por cor dominante, estilo visual ou tipo de wallpaper, as tags são simples, onde o usuario precisa manualmente olhar wallpaper por wallpaper até ver um de seu agrado.

## Funcionalidades

- 🔍 Busca por Titulo ou Tag
- 🏷️ Filtros diversos (Scene, Vídeo, Aplicativo, Resoluções, Cores, etc)
- 🤖 Tradução automática de títulos via DeepL
- 🎨 Tags automáticas via Qwen2 (Ollama)
- 🔞 Modo +18 com confirmação de idade
- 💾 Banco de dados via Supabase
- ⭐ Avaliação nos wallpapers do proprio site

## Stack

- **Frontend/Backend**: Next.js 14 + React + TypeScript + Tailwind CSS
- **Banco de dados**: Supabase (PostgreSQL)
- **APIs**: Steam Workshop API, DeepL
- **IA**: Qwen2 (Ollama)

