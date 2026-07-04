import type { H3Event } from 'h3'

import { mockCakeBoxExclusions } from '../../../../../mock/data/cakebox'

// 取消某賓客的「不發放」標記（恢復為正常領取）
export default defineEventHandler((event: H3Event) => {
  const weddingId = getRouterParam(event, 'weddingId')
  const guestId = getRouterParam(event, 'guestId')
  const idx = mockCakeBoxExclusions.findIndex(e => e.weddingId === weddingId && e.guestId === guestId)
  if (idx !== -1)
    mockCakeBoxExclusions.splice(idx, 1)
  return { ok: true }
})
