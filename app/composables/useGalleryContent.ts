// 婚紗照頁（/gallery/[weddingId]）的靜態內容。
// 照片放在 public/images/gallery/，命名 gallery-01.webp ~ gallery-33.webp。
// 分組依照片實際場景（草原粉紗／海邊白紗／都會黑禮服）判定；要調整只需改下方三個編號陣列。
import type { GalleryContent, GalleryPhoto, GallerySeries } from '~/types/gallery'

const ASSET_BASE = '/images/gallery/'

/** 每張照片的場景描述，同時作為 alt 文字 */
const PHOTO_ALT: Record<number, string> = {
  1: '草原樹林間新人牽手漫步，粉色禮服與灰西裝',
  2: '新人在山林木橋上牽手前行，手持粉紫捧花',
  3: '新人於草地上依偎，手持戒指盒額頭相貼',
  4: '新人在林蔭石板路上相擁，前景有彩色光斑',
  5: '新人並立於長草草原中，各含一朵小黃花',
  6: '新人在海灘並肩遠望，白紗與灰西裝，海面映著夕陽',
  7: '新人沿海灘牽手漫步，相視而笑，白紗拖尾在後',
  8: '海邊夕陽下新人合影，灰西裝與白紗',
  9: '新人在海邊捧著發光的 LOVE 字燈，暖色光斑環繞',
  10: '新人牽手走過都會斑馬線回眸，黑灰印花蓬裙',
  11: '新人坐於商場噴水池邊合影，黑色禮服與紅玫瑰',
  12: '都會街頭黑色禮服合影，背景是商場建築街景',
  13: '新人在噴泉水柱後方相擁親吻，黑色禮服',
  14: '新人倚靠於都會大樓與噴水池前，黑禮服與紅玫瑰',
  15: '新人在樹蔭草地上挽手對望，粉紗與乾燥捧花',
  16: '新人於樹下由身後環抱合影，粉紗與捧花',
  17: '新人並坐溪畔草坡依偎，粉紗鋪展於草地',
  18: '草地上親吻特寫，粉色禮服',
  19: '新人在林蔭石板路上親吻，彩色圓形光斑環繞',
  20: '林間石板路上的站姿獨照，灰色三件式西裝',
  21: '新人在草原中回眸，手持拍立得相機，粉紗長裙',
  22: '草坡上雙手捧頰微笑的獨照，粉色禮服',
  23: '山谷草原前新人回頭大笑，粉紗長裙鋪地',
  24: '山谷草原上新人合影，粉色禮服',
  25: '新人在山前草地舉起拍立得相機合影',
  26: '新人於海邊沙丘相擁，白紗長拖尾與捧花',
  27: '海邊草地手持捧花的獨照，灰西裝配印花襯衫',
  28: '海灘上新人全身合影，白紗拖尾鋪展於沙地',
  29: '新人在海灘面對面相望，白紗頭紗與捧花',
  30: '海灘夕陽下新人合影，白紗禮服',
  31: '新人在海邊挽手相視而笑，逆光夕陽半身構圖',
  32: '新人於海灘由身後環抱，共持紫色系捧花',
  33: '海邊夕陽下頭紗飛揚，新人親吻臉頰',
}

/** 每個系列前幾張先載，其餘 lazy load（沿用 useStoryContent 的做法） */
const EAGER_COUNT = 3

function photoSrc(num: number): string {
  return `${ASSET_BASE}gallery-${String(num).padStart(2, '0')}.webp`
}

function buildPhotos(nums: number[], eagerCount = EAGER_COUNT): GalleryPhoto[] {
  return nums.map((num, i) => ({
    src: photoSrc(num),
    alt: PHOTO_ALT[num] ?? `婚紗照 ${num}`,
    caption: '',
    eager: i < eagerCount,
  }))
}

interface SeriesSeed {
  slug: string
  title: string
  word: string
  subtitleEn: string
  description: string
  /** 代表圖編號 */
  cover: number
  /** landing 拼貼的三張編號 */
  showcase: number[]
  nums: number[]
}

const SERIES_SEEDS: SeriesSeed[] = [
  {
    slug: 'meadow',
    title: '山之間',
    word: 'Hills',
    subtitleEn: 'Among the Hills',
    description: '草原、山谷與林蔭小徑，粉色禮服的一天。',
    cover: 1,
    showcase: [1, 23, 19],
    nums: [1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
  },
  {
    slug: 'seaside',
    title: '海與黃昏',
    word: 'Seaside',
    subtitleEn: 'Where the Sun Meets the Sea',
    description: '海風、拖尾與落日，白紗在沙上鋪開。',
    cover: 30,
    showcase: [28, 33, 31],
    nums: [6, 7, 8, 9, 26, 27, 28, 29, 30, 31, 32, 33],
  },
  {
    slug: 'city',
    title: '城市節奏',
    word: 'Streets',
    subtitleEn: 'Streets in Motion',
    description: '街口、噴泉與玻璃帷幕，黑色禮服的城市節奏。',
    cover: 12,
    showcase: [12, 10, 13],
    nums: [10, 11, 12, 13, 14],
  },
]

export function useGalleryContent(): GalleryContent {
  const series: GallerySeries[] = SERIES_SEEDS.map(seed => ({
    slug: seed.slug,
    title: seed.title,
    word: seed.word,
    subtitleEn: seed.subtitleEn,
    description: seed.description,
    cover: photoSrc(seed.cover),
    showcase: buildPhotos(seed.showcase, 0),
    photos: buildPhotos(seed.nums),
  }))

  return {
    eyebrow: 'Wedding Photos · 婚紗照',
    title: '在鏡頭前，先練習了一次幸福',
    description: '三個場景、三種樣子，都是同一天想留住的心情。',
    hero: {
      src: photoSrc(8),
      alt: PHOTO_ALT[8]!,
      tagline: 'Shine in your Love',
      // 四邊各一個字，連起來就是標語；上方那個在 Shine／Happy 之間輪換
      words: {
        top: ['Shine', 'Happy'],
        left: 'in',
        right: 'your',
        bottom: 'Love',
      },
      subtitle: '在鏡頭前，先練習了一次幸福',
      names: 'Alex & Lele',
      date: '2026.11.22',
      ctaLabel: '開始看照片',
      // 入席時間（見 useStoryContent 的 venue.dateTime）
      weddingAt: '2026-11-22T12:00:00+08:00',
      marriedLabel: 'We\'re married!',
    },
    // 三個主題混排、直橫交錯，最後由 hero 收尾
    montage: [3, 12, 21, 33, 26].map(photoSrc),
    series,
    music: { src: '/audio/wedding-bgm.mp3' },
  }
}

/** 依 slug 取系列；找不到回 null（頁面據此丟 404） */
export function findGallerySeries(content: GalleryContent, slug: string): GallerySeries | null {
  return content.series.find(s => s.slug === slug) ?? null
}

/** 取前後系列（環狀），供系列頁的上一組／下一組使用 */
export function adjacentGallerySeries(content: GalleryContent, slug: string): { prev: GallerySeries, next: GallerySeries } | null {
  const list = content.series
  const index = list.findIndex(s => s.slug === slug)
  if (index === -1)
    return null
  const total = list.length
  return {
    prev: list[(index - 1 + total) % total]!,
    next: list[(index + 1) % total]!,
  }
}
