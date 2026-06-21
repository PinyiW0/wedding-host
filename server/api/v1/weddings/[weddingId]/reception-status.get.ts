import type { H3Event } from 'h3'

import { mockGuests } from '../../../../mock/data/guests'

// 接待端讀取賓客的報到 / 禮金 / 喜餅狀態（GuestListItem 不含這些欄位，
// 故另開此端點供 /reception 頁面初始化狀態。對應 flow invariant #5）
export interface ReceptionStatusItem {
  guestId: string
  checkedIn: boolean
  giftAmount: number | null
  cakeBoxTypeId: string | null
}

export default defineEventHandler((event: H3Event): ReceptionStatusItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockGuests
    .filter(g => g.weddingId === weddingId && !g.deletedAt)
    .map(g => ({
      guestId: g.guestId,
      checkedIn: g.checkedInAt !== null,
      giftAmount: g.giftAmount,
      cakeBoxTypeId: g.cakeBoxDistributedTypeId,
    }))
})
