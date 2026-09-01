// 公開婚禮故事首頁的靜態內容型別（issue #158）。
// 此頁內容目前為單一婚禮的靜態資料，非後台可編輯的實體，故不走 app/types/api/ 的 API 合約慣例。

export interface StoryPhoto {
  src: string
  caption: string
  eager: boolean
}

export interface StorySection {
  key: string
  label: string
  photos: StoryPhoto[]
}

export interface StoryNote {
  text: string
}

export interface StoryHeroContent {
  namesZh: string
  namesEn: string
  date: string
  tagline: string
  ctaLabel: string
  heroImage: string
}

export interface StoryGuestMessage {
  body: string
  signature: string
}

export interface StoryVenue {
  dateTime: string
  venueName: string
  hallName: string
  address: string
  mapLink: string
  transportInfo: string
  dressCode: string
}

export interface StoryMusic {
  src: string
}

export interface StoryContent {
  hero: StoryHeroContent
  sections: StorySection[]
  notes: StoryNote[]
  guestMessage: StoryGuestMessage
  venue: StoryVenue
  music: StoryMusic
}
