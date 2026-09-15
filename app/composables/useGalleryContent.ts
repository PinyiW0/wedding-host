// 婚紗照頁（/gallery/[weddingId]）的靜態內容。
// 照片放在 public/images/gallery/，命名 gallery-01.webp ~ gallery-33.webp。
// 分組依照片實際場景（草原粉紗／海邊白紗／都會黑禮服）判定；要調整只需改下方三個編號陣列。
import type { GalleryContent, GalleryPhoto, GallerySeries } from '~/types/gallery'

const ASSET_BASE = '/images/gallery/'
/** 水彩插圖（去背 webp，由 public/images/story/ 的 PNG 轉出，1.9MB → 80~260KB） */
const ART_BASE = '/images/gallery-art/'

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
  /** 系列名一律英文（新人指示：不要中文系列名） */
  title: string
  word: string
  /** landing 大字的切點；挑在音節上，斷開後眼睛才拼得回來（SUN|SET、GREEN|ERY） */
  wordSplit: number
  description: string
  /** 系列頁首圖編號（滿版出血會裁掉上下，橫式優先——橫式只有 01~09） */
  cover: number
  /** 首圖的垂直裁切錨點；直式照片要把這個值調到人臉的高度，否則寬版裁切會切到頭 */
  coverFocus: string
  /** 頁尾「下一個系列」預告卡編號（非直視鏡頭，橫式優先——橫式只有 01~09） */
  preview: number
  /**
   * PublicMenu 目錄列的縮圖編號。那裡是 3:2 置中裁切，直式（10~33）會切掉頭或半身，
   * 所以只准填橫式（01~09）；city 系列本身沒有橫式照片，只能借別組的一張。
   */
  menuThumb: number
  /** landing 大字上方的水彩插圖檔名（public/images/gallery-art/ 底下，去背 webp） */
  artwork: string
  /** 這一段要不要飄泡泡 */
  bubbles?: boolean
  /** 這一段要不要在插圖左邊放兩支會自轉的風車 */
  windmills?: boolean
  /** landing 照片流的照片編號；桌機依系列版型取前七張、手機只演前四張（見 GallerySeriesShowcase） */
  showcase: number[]
  nums: number[]
}

const SERIES_SEEDS: SeriesSeed[] = [
  {
    slug: 'meadow',
    title: 'In the Wild',
    word: 'GREENERY',
    wordSplit: 5,
    description: '畫面看起來靜謐又唯美，實際上裙子裡一堆蟲蟲鑽進來，鞋子踩的全是爛泥巴。',
    cover: 1,
    coverFocus: '46%',
    preview: 2,
    // 02 是橫式，兩人全身居中，3:2 只修掉上下各 2%，人不會被切
    menuThumb: 2,
    artwork: 'meadow.webp',
    windmills: true,
    showcase: [1, 23, 19, 17, 25, 4, 21],
    nums: [1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
  },
  {
    slug: 'seaside',
    title: 'By the Ocean',
    word: 'SUNSET',
    wordSplit: 3,
    description: '頭紗差點被狂風吹飛，跟夕陽極速搶時間，還一邊狂吃沙子。',
    cover: 6,
    coverFocus: '38%',
    preview: 7,
    // 07 是橫式，兩人並肩走在畫面中央，3:2 裁切不切人
    menuThumb: 7,
    artwork: 'seaside.webp',
    bubbles: true,
    showcase: [28, 33, 31, 26, 9, 7, 32],
    nums: [6, 7, 8, 9, 26, 27, 28, 29, 30, 31, 32, 33],
  },
  {
    slug: 'city',
    title: 'In the City',
    word: 'DOWNTOWN',
    wordSplit: 4,
    description: '照片裡的光影美到不行，實際上是在高溫下差點熱到中暑拍完的。',
    cover: 14,
    coverFocus: '28%',
    preview: 13,
    // city 的 10~14 全是直式，3:2 裁切只留中間那條會切掉頭，所以借 04：
    // 橫式、兩張臉最大又壓在正中央，縮到 64px 仍看得出是誰；彩色光斑也讓這一列不跟上面的海邊列撞調性
    menuThumb: 4,
    artwork: 'city.webp',
    showcase: [12, 10, 13, 14, 11],
    nums: [10, 11, 12, 13, 14],
  },
]

export function useGalleryContent(): GalleryContent {
  const series: GallerySeries[] = SERIES_SEEDS.map(seed => ({
    slug: seed.slug,
    title: seed.title,
    word: seed.word,
    wordSplit: seed.wordSplit,
    description: seed.description,
    cover: photoSrc(seed.cover),
    coverFocus: seed.coverFocus,
    preview: photoSrc(seed.preview),
    menuThumb: photoSrc(seed.menuThumb),
    artwork: `${ART_BASE}${seed.artwork}`,
    bubbles: seed.bubbles ?? false,
    windmills: seed.windmills ?? false,
    showcase: buildPhotos(seed.showcase, 0),
    photos: buildPhotos(seed.nums),
  }))

  return {
    eyebrow: 'Wedding Gallery',
    title: '奔向光的落點，留下我們相愛的樣子',
    description: '幾千個平凡日子匯聚成這一刻，把最自然的笑意與目光，留給未來的我們。',
    seriesLine: 'Let\'s run into our happily ever after',
    nextHint: '看完了這輯，繼續看下一場故事 ➔',
    outro: '照片留下了瞬間，但最美的風景，是那天有你們在場。',
    outroArt: `${ART_BASE}outro.webp`,
    hero: {
      src: photoSrc(1),
      alt: PHOTO_ALT[1]!,
      tagline: 'Shine in your Love',
      // 四邊各一個字，連起來就是標語；上方那個在 Shine／Happy 之間輪換
      words: {
        top: ['Shine', 'Happy'],
        left: 'in',
        right: 'your',
        bottom: 'Love',
      },
      names: 'Alex & Lele',
      date: '2026.11.22',
      // 入席時間（見 useStoryContent 的 venue.dateTime）
      weddingAt: '2026-11-22T12:00:00+08:00',
      marriedLabel: 'We\'re married!',
    },
    togetherSince: '2015-05-21T00:00:00+08:00',
    // 三個主題混排、直橫交錯，最後由 hero 收尾
    montage: [3, 12, 21, 33, 26].map(photoSrc),
    // hero 之後那行留白，連起來就是新人的名字
    interludes: ['Chenming', '&', 'Pinyi'],
    // 09：橫式、手捧發光的 LOVE 字燈，主體與兩張臉都在中央，3:2 裁切頭頂還留得住白邊；
    // 「LOVE」本身就是喜帖語彙，且與 city 借用的 04（日光近拍）完全不同調，符合新人「兩者要不一樣」
    inviteThumb: photoSrc(9),
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
