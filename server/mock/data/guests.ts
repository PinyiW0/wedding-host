// 賓客 mock 資料（含報到 / 禮金 / 喜餅 / RSVP 等接待狀態欄位）
// seed：guest-001（陳大明 / 男方 / 葷食 / 同事 / 未綁定 LINE / 未報到 / 未登記禮金 / 未發放喜餅）

import type { GuestSource, GuestStatus } from '../../../app/types/api/guests'
import type { AttendingStatus, InvitationPreference } from '../../../app/types/api/rsvp'

// 範例手繪小花（120×120 透明底 PNG）：供後台「查看回覆 / 下載花朵」即時示範
const SAMPLE_FLOWER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAA5ZDbSAAAB2klEQVR42u3cwW0CMRRFUdeXZcpgQSPpIMWwSl9BFJBR0Nhj+/1zJa9YIP2jGQFj05okSZIkHfa4ff6aQgjku8vUQmFBF4EFXQQWdCFcyAVwIRfAhVwAFzJg7Y4LGbB2x4UMWLvjQgYswAKcBpkAXB5+ZTBXPFjQYItAAwyGhhaMDCsYGVIwMpxwZDDBwFDCkYEEA+80tJ/vD8gpwC/M/y7AG+G+A7sDNOAOsCtDA+6MuxpyeeARuCshlwYeibsKclngK3BXQHb1uorzkK/EnY1c8hYNOBh4Bu5MZMCAAQMGDHgV5ErA5R4XzsSdgVzyoT9cwIB3Rq4AXHrbLOBw5HRgx1eCf4t2AC0YuO2W58EOgpcHbknZk1Xgz1jsqvRPO/H7ouEWONkAOPxsEtwCpwsBh58PBuwEP2DAgAEDBgwXMmS3aAswYMCAAQMGDBgyXMCAIduyAxhyv3X/usFNA36h/rUAb4x8BDsDulVrFdwrkFvVKgC36q2AOwq5qT/0CsA0B0LPBKY3GPoM7hlkWp3hj14/g3vmfXVRo4AFWCsjmxpg7YpsWqHQphOIbQqA5RatbT5omZJP0fI9WIAFWINwIbuCBViA5XuwOiObUjCy6QRim4IkSRrdE+f3PrB7gDi1AAAAAElFTkSuQmCC'

// 手繪風小花 SVG（花田假資料：參數化產生多樣花色，供公開花田呈現「一片花海」）
function flowerSvg(petalColor: string, centerColor: string, petals: number, wobble = 0): string {
  const cx = 60
  const cy = 56
  const petalEls = Array.from({ length: petals }, (_, i) => {
    const angle = (360 / petals) * i + wobble
    return `<ellipse cx='${cx}' cy='${cy - 22}' rx='15' ry='25' fill='${petalColor}' transform='rotate(${angle} ${cx} ${cy})'/>`
  }).join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>`
    + `<path d='M60 78 Q57 96 60 112' stroke='#7C9A6D' stroke-width='4' fill='none' stroke-linecap='round'/>`
    + `<ellipse cx='69' cy='97' rx='9' ry='5' fill='#8FAE7E' transform='rotate(-28 69 97)'/>`
    + `${petalEls}<circle cx='${cx}' cy='${cy}' r='11' fill='${centerColor}'/></svg>`
  return `data:image/svg+xml;utf8,${svg.replaceAll('#', '%23')}`
}

// 花色盤（低飽和蠟筆感，與 Editorial Luxe 米金色系和諧）
const FLOWER_ROSE = flowerSvg('#D98E8A', '#E8C46A', 6)
const FLOWER_BLUSH = flowerSvg('#E8B4B8', '#B8965A', 5, 12)
const FLOWER_LAVENDER = flowerSvg('#B9A7D0', '#E8C46A', 6, 8)
const FLOWER_PEACH = flowerSvg('#EFB08C', '#A6603F', 5)
const FLOWER_CREAM = flowerSvg('#EFD48C', '#C08552', 8)
const FLOWER_WHITE = flowerSvg('#F5EFE2', '#C9A96A', 6, 15)
const FLOWER_CORAL = flowerSvg('#E28E6D', '#8F5B3D', 5, 20)
const FLOWER_RED = flowerSvg('#C96F66', '#E8C46A', 6, 5)

export interface MockGuest {
  guestId: string
  weddingId: string
  name: string
  side: 'groom' | 'bride'
  diet: 'meat' | 'vegetarian'
  category: string
  contact: string
  // 兒童椅嬰兒數（不吃大人菜、不佔正常席、該桌額外加位）
  childChairCount: number
  notes: string | null
  lineUserId: string | null
  // 接待 / RSVP 狀態
  rsvpAttending: AttendingStatus | null
  checkedInAt: string | null
  giftAmount: number | null
  cakeBoxDistributedTypeId: string | null
  // 喜帖已寄送記號（管理端逐位勾選）
  invitationSent: boolean
  // 這組總人數（本人＋同行＋兒童椅嬰兒）；正常席人頭 = partySize − childChairCount
  partySize: number
  tableName: string | null
  deletedAt: string | null
  // 訪客 RSVP 表單補充欄位（選填）
  invitationPreference?: InvitationPreference | null
  mailingAddress?: string | null
  blessing?: string | null
  flowerDrawing?: string | null
  // 接駁車（限男方親友／高雄地區）
  needsShuttle?: boolean | null
  shuttleCount?: number | null
  // 自訂題答案（key = 自訂題 id）
  customAnswers?: Record<string, string | string[]> | null
  // 名單狀態與來源（混合制）；省略視為 confirmed / manual
  status?: GuestStatus
  source?: GuestSource
}

function g(partial: Partial<MockGuest> & Pick<MockGuest, 'guestId' | 'name' | 'side' | 'diet' | 'category'>): MockGuest {
  return {
    weddingId: 'wedding-001',
    contact: '0900000000',
    childChairCount: 0,
    notes: null,
    lineUserId: null,
    rsvpAttending: null,
    checkedInAt: null,
    giftAmount: null,
    cakeBoxDistributedTypeId: null,
    // 既有 seed 一律未寄送（由工廠預設補上，不動個別 seed 欄位值）
    invitationSent: false,
    partySize: 1,
    tableName: null,
    deletedAt: null,
    ...partial,
  }
}

export const mockGuests: MockGuest[] = [
  g({ guestId: 'guest-001', name: '陳大明', side: 'groom', diet: 'meat', category: '同事', contact: '0912345678', notes: '需要靠近舞台', partySize: 2, tableName: '主桌' }),
  g({ guestId: 'guest-002', name: '林美麗', side: 'bride', diet: 'vegetarian', category: '朋友', contact: '0922222222', partySize: 1, tableName: '女方家屬桌', flowerDrawing: FLOWER_BLUSH }),
  g({ guestId: 'guest-003', name: '王志強', side: 'groom', diet: 'meat', category: '家人', contact: '0933333333', lineUserId: 'line-u-003', rsvpAttending: 'attending', partySize: 4, tableName: '主桌', needsShuttle: true, shuttleCount: 2, invitationPreference: 'e-card', blessing: '新婚快樂，永浴愛河！祝志明與春嬌白頭偕老。', flowerDrawing: SAMPLE_FLOWER }),
  g({ guestId: 'guest-004', name: '李淑芬', side: 'bride', diet: 'meat', category: '同學', contact: '0944444444', partySize: 2, tableName: '女方家屬桌', flowerDrawing: FLOWER_LAVENDER }),
  g({ guestId: 'guest-005', name: '張文彬', side: 'groom', diet: 'vegetarian', category: '同事', contact: '0955555555', partySize: 1, tableName: null, flowerDrawing: FLOWER_PEACH }),
  g({ guestId: 'guest-006', name: '黃雅婷', side: 'bride', diet: 'meat', category: '朋友', contact: '0966666666', partySize: 3, tableName: '女方家屬桌', flowerDrawing: FLOWER_ROSE }),
  g({ guestId: 'guest-007', name: '吳俊賢', side: 'groom', diet: 'meat', category: '家人', contact: '0977777777', partySize: 2, tableName: '男方家屬桌', flowerDrawing: FLOWER_CREAM }),
  g({ guestId: 'guest-008', name: '蔡怡君', side: 'bride', diet: 'vegetarian', category: '同學', contact: '0988888888', partySize: 1, tableName: null, flowerDrawing: FLOWER_WHITE }),
  g({ guestId: 'guest-009', name: '鄭家豪', side: 'groom', diet: 'meat', category: '朋友', contact: '0900111222', partySize: 2, tableName: '男方家屬桌', flowerDrawing: FLOWER_CORAL }),
  g({ guestId: 'guest-010', name: '許雅雯', side: 'bride', diet: 'meat', category: '同事', contact: '0900333444', partySize: 1, tableName: '主桌', flowerDrawing: FLOWER_RED }),
  g({ guestId: 'guest-011', name: '謝明哲', side: 'groom', diet: 'meat', category: '家人', contact: '0900555666', partySize: 3, tableName: '男方家屬桌', flowerDrawing: FLOWER_BLUSH }),
  g({ guestId: 'guest-012', name: '周佳穎', side: 'bride', diet: 'vegetarian', category: '朋友', contact: '0900777888', childChairCount: 1, partySize: 3, tableName: '女方家屬桌', flowerDrawing: FLOWER_LAVENDER }),
  // guest-013：主桌（12 座）坐滿後的溢位賓客，供 04-seating「桌次已滿」測試使用
  g({ guestId: 'guest-013', name: '趙建國', side: 'groom', diet: 'meat', category: '同事', contact: '0900999111', partySize: 1, tableName: null }),
  // 婚禮主角與雙方父母：主桌專屬名單（category 新人／雙親）。
  // 預設不入座，按「推薦排序」時優先帶入主桌；新郎左、新娘右最靠舞台。
  g({ guestId: 'guest-101', name: '新郎 周岳辰', side: 'groom', diet: 'meat', category: '新人', contact: '0911000001', partySize: 1 }),
  g({ guestId: 'guest-102', name: '新娘 林映彤', side: 'bride', diet: 'meat', category: '新人', contact: '0911000002', partySize: 1 }),
  g({ guestId: 'guest-103', name: '周建宏', side: 'groom', diet: 'meat', category: '雙親', contact: '0911000003', notes: '新郎父親', partySize: 1 }),
  g({ guestId: 'guest-104', name: '蘇麗華', side: 'groom', diet: 'meat', category: '雙親', contact: '0911000004', notes: '新郎母親', partySize: 1 }),
  g({ guestId: 'guest-105', name: '林文德', side: 'bride', diet: 'meat', category: '雙親', contact: '0911000005', notes: '新娘父親', partySize: 1 }),
  g({ guestId: 'guest-106', name: '陳秀琴', side: 'bride', diet: 'meat', category: '雙親', contact: '0911000006', notes: '新娘母親', partySize: 1 }),
]
