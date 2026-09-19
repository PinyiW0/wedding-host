// RSVP 表單設定 mock 資料：每場婚禮一份；未設定過時回「預設範本」（現有那套系統題）

import type { RsvpBanner, RsvpFormConfigDetail, RsvpQuestion } from '../../../app/types/api/rsvp-config'

import { RSVP_BANNER_PHOTO_MAX, RSVP_BANNER_SET_MAX } from '../../../app/types/api/rsvp-config'

export interface MockRsvpFormConfig extends RsvpFormConfigDetail {}

// 沒指定底色時的預設：gold-light，暖砂色，疊在 cream 頁面上不打架
export const DEFAULT_BANNER_TONE = '#D8C39B'

// 預設範本＝現有賓客表單那套系統題（依畫面順序），theme=minimal、banner=null
// 接駁車示範「顯示對象」：audience='groom' 讓男方親友才看得到（新人可在後台改為所有人／女方）
export function defaultRsvpQuestions(): RsvpQuestion[] {
  return [
    { type: 'builtin', key: 'attending', label: '是否會出席婚禮？', enabled: true, order: 1 },
    { type: 'builtin', key: 'diet', label: '餐點選擇', enabled: true, order: 2 },
    { type: 'builtin', key: 'partySize', label: '攜伴人數', enabled: true, order: 3 },
    { type: 'builtin', key: 'childChair', label: '兒童椅數', enabled: true, order: 4 },
    {
      type: 'builtin',
      key: 'shuttle',
      label: '高雄地區接駁車',
      description: '只有高雄地區的家人才需要選',
      enabled: true,
      audience: 'groom',
      order: 5,
    },
    { type: 'builtin', key: 'invitation', label: '是否需要喜帖？', enabled: true, order: 6 },
    { type: 'builtin', key: 'blessing', label: '想給新人的祝福', enabled: true, order: 7 },
    { type: 'builtin', key: 'flower', label: '畫一朵小花給新人們', enabled: true, order: 8 },
  ]
}

export function defaultRsvpFormConfig(weddingId: string): RsvpFormConfigDetail {
  return { weddingId, theme: 'minimal', banner: null, banners: [], questions: defaultRsvpQuestions() }
}

// 讀取正規化：多組欄位是後來才加的，舊存檔只有單張 banner——包成一組一張，
// 新人不必重新上傳。同 normalizeRsvpQuestions 的補漏思路
export function normalizeRsvpBanners(
  banners: RsvpBanner[] | null | undefined,
  banner: string | null,
): RsvpBanner[] {
  if (banners?.length)
    return banners
  return banner ? [{ tone: DEFAULT_BANNER_TONE, photos: [banner] }] : []
}

// 寫入驗證：這個端點沒有 zod，逐欄自己驗（server-security 第 4 條）
// 照片網址只放行三種：http(s) 絕對網址（R2）、image 的 dataURL（本機／e2e）、
// 本站絕對路徑（/images/...，示範資料用）。擋掉 javascript: 之類會進 <img src> 的東西
// （frontend-security 第 2 條，這裡在 server 再擋一次，不倚賴前端）。
// 本站路徑的 (?!\/) 不可省：`//evil.com/x.png` 是協定相對網址，會載到站外去
const SAFE_SRC_RE = /^(?:https?:\/\/|data:image\/|\/(?!\/))/i
const TONE_RE = /^#[0-9a-f]{6}$/i
// dataURL 存進 jsonb，一組三張就可能到數 MB；單張 8MB 是 useImageUpload 壓過
// （最長邊 1600、JPEG 0.85）之後的寬鬆上限
const MAX_SRC_LENGTH = 8 * 1024 * 1024

export function sanitizeRsvpBanners(input: unknown): RsvpBanner[] {
  if (!Array.isArray(input))
    return []
  const out: RsvpBanner[] = []
  for (const item of input) {
    if (out.length >= RSVP_BANNER_SET_MAX)
      break
    const photos: string[] = []
    for (const src of (item as RsvpBanner)?.photos ?? []) {
      if (photos.length >= RSVP_BANNER_PHOTO_MAX)
        break
      if (typeof src === 'string' && src.length <= MAX_SRC_LENGTH && SAFE_SRC_RE.test(src))
        photos.push(src)
    }
    // 整組沒有一張合格就丟掉，不留空組——空組會讓賓客滑到一片純色
    if (!photos.length)
      continue
    const tone = (item as RsvpBanner)?.tone
    out.push({ tone: typeof tone === 'string' && TONE_RE.test(tone) ? tone : DEFAULT_BANNER_TONE, photos })
  }
  return out
}

// 存檔正規化：補回預設範本有、但存檔缺少的系統題（依 order 插回原位）
// 後台只能開關系統題、不能刪，故缺漏必來自版本落差——補回可讓既有設定自動長出新系統題
export function normalizeRsvpQuestions(saved: RsvpQuestion[]): RsvpQuestion[] {
  const savedKeys = new Set(
    saved.filter(q => q.type === 'builtin').map(q => q.key),
  )
  const missing = defaultRsvpQuestions().filter(
    q => q.type === 'builtin' && !savedKeys.has(q.key),
  )
  if (!missing.length)
    return saved
  return [...saved, ...missing].sort((a, b) => a.order - b.order)
}

// 已被管理員覆寫過的設定才入此表；查無則回預設範本
export const mockRsvpFormConfigs: MockRsvpFormConfig[] = []
