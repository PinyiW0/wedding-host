import type { H3Event } from 'h3'

import { mockCakeBoxExtraOrders } from '../../../../../mock/data/cakebox'

// 移除一筆額外配發
export default defineEventHandler((event: H3Event) => {
  const weddingId = getRouterParam(event, 'weddingId')
  const extraOrderId = getRouterParam(event, 'extraOrderId')
  const idx = mockCakeBoxExtraOrders.findIndex(o => o.weddingId === weddingId && o.extraOrderId === extraOrderId)
  if (idx !== -1)
    mockCakeBoxExtraOrders.splice(idx, 1)
  return { ok: true }
})
