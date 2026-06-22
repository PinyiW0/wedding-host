// 賓客 mock 資料（含報到 / 禮金 / 喜餅 / RSVP 等接待狀態欄位）
// seed：guest-001（陳大明 / 男方 / 葷食 / 同事 / 未綁定 LINE / 未報到 / 未登記禮金 / 未發放喜餅）

import type { AttendingStatus } from '../../../app/types/api/rsvp'

export interface MockGuest {
  guestId: string
  weddingId: string
  name: string
  side: 'groom' | 'bride'
  diet: 'meat' | 'vegetarian'
  category: string
  contact: string
  needChildSeat: boolean
  notes: string | null
  lineUserId: string | null
  // 接待 / RSVP 狀態
  rsvpAttending: AttendingStatus | null
  checkedInAt: string | null
  giftAmount: number | null
  cakeBoxDistributedTypeId: string | null
  // 這組總人數（本人＋攜伴）與桌次（display 用，真實後端應由座位安排推導）
  partySize: number
  tableName: string | null
  deletedAt: string | null
}

function g(partial: Partial<MockGuest> & Pick<MockGuest, 'guestId' | 'name' | 'side' | 'diet' | 'category'>): MockGuest {
  return {
    weddingId: 'wedding-001',
    contact: '0900000000',
    needChildSeat: false,
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
  g({ guestId: 'guest-003', name: '王志強', side: 'groom', diet: 'meat', category: '家人', contact: '0933333333', lineUserId: 'line-u-003', rsvpAttending: 'attending', partySize: 4, tableName: '主桌' }),
  g({ guestId: 'guest-004', name: '李淑芬', side: 'bride', diet: 'meat', category: '同學', contact: '0944444444', partySize: 2, tableName: '女方家屬桌' }),
  g({ guestId: 'guest-005', name: '張文彬', side: 'groom', diet: 'vegetarian', category: '同事', contact: '0955555555', partySize: 1, tableName: null }),
  g({ guestId: 'guest-006', name: '黃雅婷', side: 'bride', diet: 'meat', category: '朋友', contact: '0966666666', partySize: 3, tableName: '女方家屬桌' }),
  g({ guestId: 'guest-007', name: '吳俊賢', side: 'groom', diet: 'meat', category: '家人', contact: '0977777777', partySize: 2, tableName: '男方家屬桌' }),
  g({ guestId: 'guest-008', name: '蔡怡君', side: 'bride', diet: 'vegetarian', category: '同學', contact: '0988888888', partySize: 1, tableName: null }),
  g({ guestId: 'guest-009', name: '鄭家豪', side: 'groom', diet: 'meat', category: '朋友', contact: '0900111222', partySize: 2, tableName: '男方家屬桌' }),
  g({ guestId: 'guest-010', name: '許雅雯', side: 'bride', diet: 'meat', category: '同事', contact: '0900333444', partySize: 1, tableName: '主桌' }),
  g({ guestId: 'guest-011', name: '謝明哲', side: 'groom', diet: 'meat', category: '家人', contact: '0900555666', partySize: 3, tableName: '男方家屬桌' }),
  g({ guestId: 'guest-012', name: '周佳穎', side: 'bride', diet: 'vegetarian', category: '朋友', contact: '0900777888', needChildSeat: true, partySize: 3, tableName: '女方家屬桌' }),
  // guest-013：主桌（12 座）坐滿後的溢位賓客，供 04-seating「桌次已滿」測試使用
  g({ guestId: 'guest-013', name: '趙建國', side: 'groom', diet: 'meat', category: '同事', contact: '0900999111', partySize: 1, tableName: null }),
]
