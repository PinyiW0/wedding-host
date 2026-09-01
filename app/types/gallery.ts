// 婚紗照頁（/gallery/[weddingId]）的靜態內容型別。
// 與 app/types/story.ts 同樣是單一婚禮的靜態內容，非後台可編輯的實體，故不走 app/types/api/。

export interface GalleryPhoto {
  /** 照片路徑；素材尚未到位時留空字串，改渲染 placeholder 色塊 */
  src: string
  /** 圖片替代文字（供螢幕閱讀器） */
  alt: string
  /** 圖說，可留空 */
  caption: string
  eager: boolean
}

/** 一個主題系列（草原／海邊／都會），對應 /gallery/[weddingId]/[series] 一頁 */
export interface GallerySeries {
  /** 網址片段 */
  slug: string
  /** 中文系列名——landing 釘住大字的左段、系列頁主標 */
  title: string
  /** 單字英文——landing 釘住大字的右段（跨欄排版，故只取一個字） */
  word: string
  /** 英文副標，系列頁 eyebrow 用 */
  subtitleEn: string
  /** 一句話場景描述 */
  description: string
  /** 代表圖（下一系列預告卡用） */
  cover: string
  /** landing 拼貼要用的三張（不重複 hero，挑得出系列調性即可） */
  showcase: GalleryPhoto[]
  photos: GalleryPhoto[]
}

/** 圍在 hero 四邊的大字，連起來就是 tagline；上方那個會輪換 */
export interface GalleryHeroWords {
  /** 上方（依序輪換，至少一個） */
  top: string[]
  left: string
  right: string
  bottom: string
}

export interface GalleryHeroContent {
  src: string
  alt: string
  /** 完整標語，給螢幕閱讀器與 SEO 用（畫面上由 words 四邊呈現） */
  tagline: string
  words: GalleryHeroWords
  /** 中文副標 */
  subtitle: string
  /** 左下角署名 */
  names: string
  date: string
  ctaLabel: string
  /** 婚禮時間（ISO 8601 含時區），倒數用 */
  weddingAt: string
  /** 倒數歸零後改顯示的字 */
  marriedLabel: string
}

export interface GalleryContent {
  eyebrow: string
  title: string
  description: string
  hero: GalleryHeroContent
  /** 開場蒙太奇依序疊出的照片（不含 hero，hero 恆為最後一張） */
  montage: string[]
  series: GallerySeries[]
  music: { src: string }
}
