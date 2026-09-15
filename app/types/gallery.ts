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
  /** 系列名（英文短句，如 In the Wild）——系列頁主標、選單列、a11y 名稱 */
  title: string
  /** 單字英文——landing 釘住的大字，會依 wordSplit 拆成左右兩半 */
  word: string
  /** word 的切點（第幾個字母之後切）；左半靠畫面左緣、右半靠右緣，照片從中間穿過 */
  wordSplit: number
  /** 一句話場景描述 */
  description: string
  /** 系列頁首圖（滿版出血，橫式優先） */
  cover: string
  /** 首圖的垂直裁切錨點（object-position 的 Y），直式照片靠它把人臉留在畫面裡 */
  coverFocus: string
  /** 頁尾「下一個系列」預告卡用；挑非直視鏡頭的一張，橫式優先 */
  preview: string
  /**
   * PublicMenu 目錄列右側的縮圖。
   * 該處是 3:2 置中裁切（object-fit: cover），直式照片會被切掉頭或半身，
   * 所以只能填橫式照片（01~09、37、43、45、48），且不跟 preview 共用——preview 是為滿版預告卡挑的，兩者用途不同。
   */
  menuThumb: string
  /** landing 大字上方的水彩插圖（去背 webp）；留空字串代表這個系列沒有插圖 */
  artwork: string
  /** 這一段要不要飄泡泡（目前只有海邊那組） */
  bubbles: boolean
  /** 這一段要不要在插圖左邊放兩支會自轉的風車（目前只有草原那組） */
  windmills: boolean
  /** landing 照片流要用的照片（不重複 hero，挑得出系列調性即可；桌機最多七張、手機四張，尺寸與節奏見 GallerySeriesShowcase 的版型表） */
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
  /** 左下角署名 */
  names: string
  date: string
  /** 婚禮時間（ISO 8601 含時區），倒數用 */
  weddingAt: string
  /** 倒數歸零後改顯示的字 */
  marriedLabel: string
}

export interface GalleryContent {
  eyebrow: string
  title: string
  description: string
  /** 系列頁首圖底下的收尾句 */
  seriesLine: string
  /** 系列頁尾「下一系列」卡片上方的提示句 */
  nextHint: string
  /** landing 頁尾出口的收尾句 */
  outro: string
  /** landing 頁尾收尾句上方的水彩插圖（去背 webp） */
  outroArt: string
  hero: GalleryHeroContent
  /** 在一起的起算日（ISO 8601 含時區）；開場的計數器數到今天為止的天數 */
  togetherSince: string
  /** 開場蒙太奇依序疊出的照片（不含 hero，hero 恆為最後一張） */
  montage: string[]
  /** hero 與系列區塊之間那行名字，三個字依序落在最左／中間／最右 */
  interludes: string[]
  /** PublicMenu 目錄「喜帖」那一列的縮圖；同樣是 3:2 裁切，只能填橫式照片，且要跟三個系列的 menuThumb 都不同 */
  inviteThumb: string
  series: GallerySeries[]
  music: { src: string }
}
