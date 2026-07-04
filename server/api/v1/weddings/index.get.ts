import type { H3Event } from 'h3'
import type { WeddingListItem } from '../../../../app/types/api/weddings'

import { mockWeddings } from '../../../mock/data/weddings'

export default defineEventHandler((event: H3Event): WeddingListItem[] => {
  // 新人僅能看到自己擁有的婚禮；管理者／接待員／無 token 看全部（含已軟刪除，UI 以 deletedAt 分區）
  const user = getRequestUser(event)
  const visible = user.role === '新人'
    ? mockWeddings.filter(w => w.ownerId === user.userId)
    : mockWeddings
  return visible.map(w => ({
    weddingId: w.weddingId,
    title: w.title,
    venue: w.venue,
    address: w.address,
    date: w.date,
    ownerId: w.ownerId ?? null,
    deletedAt: w.deletedAt,
  }))
})
