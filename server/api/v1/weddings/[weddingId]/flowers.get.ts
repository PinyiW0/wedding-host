import type { H3Event } from 'h3'
import type { FlowerWallItem } from '../../../../../app/types/api/flowers'

import { mockGuests } from '../../../../mock/data/guests'

// 花田（公開）：回該婚禮所有非空手繪小花 + 賓客名（排除待確認 / 已移除）
export default defineEventHandler((event: H3Event): FlowerWallItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockGuests
    .filter(
      g =>
        g.weddingId === weddingId
        && !g.deletedAt
        && g.status !== 'pending_review'
        && !!g.flowerDrawing,
    )
    .map(g => ({ guestId: g.guestId, name: g.name, flowerDrawing: g.flowerDrawing! }))
})
