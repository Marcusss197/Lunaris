export interface Wallpaper {
  id: number
  title: string
  previewUrl: string
  tags: string[]        // ai_tags — detectadas pelo Qwen
  steamTags: string[]   // tags originais da Steam
  userTags: string[]    // tags adicionadas por usuários
  downloads: number
  isAnimated: boolean
  isNsfw: boolean
  authorName: string
  authorId: string
  steamUrl: string
}

export interface SearchFilters {
  query: string
  tags: string[]
  nsfw: boolean
}

export interface SteamWorkshopItem {
  publishedfileid: string
  title: string
  preview_url: string
  tags: { tag: string }[]
  subscriptions: number
  creator_appid: number
  maybe_inappropriate_sex: boolean
  maybe_inappropriate_violence: boolean
}
