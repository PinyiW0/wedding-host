import type { H3Event } from 'h3'
import type { WeddingListItem } from '../../../../app/types/api/weddings'

import { mockWeddings } from '../../../mock/data/weddings'

export default defineEventHandler((event: H3Event): WeddingListItem[] => {
  // 含已軟刪除：UI 以 deletedAt 分區呈現（未刪除 / 回收區）
  void event
  return mockWeddings.map(w => ({
    weddingId: w.weddingId,
    title: w.title,
    venue: w.venue,
    address: w.address,
    date: w.date,
    deletedAt: w.deletedAt,
  }))
})
