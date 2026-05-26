-- Cria a tabela principal de wallpapers indexados
create table if not exists wallpapers (
  id            bigint primary key,         -- ID do Steam Workshop
  title         text not null,              -- título traduzido
  title_original text not null default '',  -- título original (japonês/chinês/etc)
  preview_url   text not null,
  author_id     text not null default '',
  author_name   text not null default '',
  steam_tags    text[] not null default '{}',  -- tags originais da Steam
  ai_tags       text[] not null default '{}',  -- tags detectadas pelo Gemini
  downloads     integer not null default 0,
  is_nsfw       boolean not null default false,
  is_animated   boolean not null default false,
  steam_url     text not null default '',
  steam_created_at bigint,                  -- timestamp unix da criação no Steam
  indexed_at    timestamptz not null default now()
);

-- Índices para buscas rápidas
create index if not exists idx_wallpapers_downloads on wallpapers(downloads desc);
create index if not exists idx_wallpapers_is_nsfw on wallpapers(is_nsfw);
create index if not exists idx_wallpapers_indexed_at on wallpapers(indexed_at desc);
create index if not exists idx_wallpapers_ai_tags on wallpapers using gin(ai_tags);
create index if not exists idx_wallpapers_steam_tags on wallpapers using gin(steam_tags);
