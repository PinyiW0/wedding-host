// 賓客 mock 資料（含報到 / 禮金 / 喜餅 / RSVP 等接待狀態欄位）
// seed：guest-001（陳大明 / 男方 / 葷食 / 同事 / 未綁定 LINE / 未報到 / 未登記禮金 / 未發放喜餅）

import type { AttendingStatus, InvitationPreference } from '../../../app/types/api/rsvp'

// 範例手繪小花（120×120 透明底 PNG）：供後台「查看回覆 / 下載花朵」即時示範
const SAMPLE_FLOWER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAA5ZDbSAAAB2klEQVR42u3cwW0CMRRFUdeXZcpgQSPpIMWwSl9BFJBR0Nhj+/1zJa9YIP2jGQFj05okSZIkHfa4ff6aQgjku8vUQmFBF4EFXQQWdCFcyAVwIRfAhVwAFzJg7Y4LGbB2x4UMWLvjQgYswAKcBpkAXB5+ZTBXPFjQYItAAwyGhhaMDCsYGVIwMpxwZDDBwFDCkYEEA+80tJ/vD8gpwC/M/y7AG+G+A7sDNOAOsCtDA+6MuxpyeeARuCshlwYeibsKclngK3BXQHb1uorzkK/EnY1c8hYNOBh4Bu5MZMCAAQMGDHgV5ErA5R4XzsSdgVzyoT9cwIB3Rq4AXHrbLOBw5HRgx1eCf4t2AC0YuO2W58EOgpcHbknZk1Xgz1jsqvRPO/H7ouEWONkAOPxsEtwCpwsBh58PBuwEP2DAgAEDBgwXMmS3aAswYMCAAQMGDBgyXMCAIduyAxhyv3X/usFNA36h/rUAb4x8BDsDulVrFdwrkFvVKgC36q2AOwq5qT/0CsA0B0LPBKY3GPoM7hlkWp3hj14/g3vmfXVRo4AFWCsjmxpg7YpsWqHQphOIbQqA5RatbT5omZJP0fI9WIAFWINwIbuCBViA5XuwOiObUjCy6QRim4IkSRrdE+f3PrB7gDi1AAAAAElFTkSuQmCC'

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
    partySize: 1,
    tableName: null,
    deletedAt: null,
    ...partial,
  }
}

export const mockGuests: MockGuest[] = [
  g({ guestId: 'guest-001', name: '陳大明', side: 'groom', diet: 'meat', category: '同事', contact: '0912345678', notes: '需要靠近舞台', partySize: 2, tableName: '主桌' }),
  g({ guestId: 'guest-002', name: '林美麗', side: 'bride', diet: 'vegetarian', category: '朋友', contact: '0922222222', partySize: 1, tableName: '女方家屬桌' }),
  g({ guestId: 'guest-003', name: '王志強', side: 'groom', diet: 'meat', category: '家人', contact: '0933333333', lineUserId: 'line-u-003', rsvpAttending: 'attending', partySize: 4, tableName: '主桌', needsShuttle: true, shuttleCount: 2, invitationPreference: 'e-card', blessing: '新婚快樂，永浴愛河！祝振茗與品儀白頭偕老。', flowerDrawing: SAMPLE_FLOWER }),
  g({ guestId: 'guest-004', name: '李淑芬', side: 'bride', diet: 'meat', category: '同學', contact: '0944444444', partySize: 2, tableName: '女方家屬桌' }),
  g({ guestId: 'guest-005', name: '張文彬', side: 'groom', diet: 'vegetarian', category: '同事', contact: '0955555555', partySize: 1, tableName: null }),
  g({ guestId: 'guest-006', name: '黃雅婷', side: 'bride', diet: 'meat', category: '朋友', contact: '0966666666', partySize: 3, tableName: '女方家屬桌' }),
  g({ guestId: 'guest-007', name: '吳俊賢', side: 'groom', diet: 'meat', category: '家人', contact: '0977777777', partySize: 2, tableName: '男方家屬桌' }),
  g({ guestId: 'guest-008', name: '蔡怡君', side: 'bride', diet: 'vegetarian', category: '同學', contact: '0988888888', partySize: 1, tableName: null }),
  g({ guestId: 'guest-009', name: '鄭家豪', side: 'groom', diet: 'meat', category: '朋友', contact: '0900111222', partySize: 2, tableName: '男方家屬桌' }),
  g({ guestId: 'guest-010', name: '許雅雯', side: 'bride', diet: 'meat', category: '同事', contact: '0900333444', partySize: 1, tableName: '主桌' }),
  g({ guestId: 'guest-011', name: '謝明哲', side: 'groom', diet: 'meat', category: '家人', contact: '0900555666', partySize: 3, tableName: '男方家屬桌' }),
  g({ guestId: 'guest-012', name: '周佳穎', side: 'bride', diet: 'vegetarian', category: '朋友', contact: '0900777888', childChairCount: 1, partySize: 3, tableName: '女方家屬桌' }),
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
