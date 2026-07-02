import type { H3Event } from 'h3'
import type { PendingGuestConfirmedEvent } from '../../../../../../../app/types/api/pending-guests'

import { mockGuests } from '../../../../../../mock/data/guests'

// 建為新賓客：將待確認賓客轉為正式名單
export default defineEventHandler((event: H3Event): PendingGuestConfirmedEvent => {
  const guestId = getRouterParam(event, 'guestId')

  const pending = mockGuests.find(
    g => g.guestId === guestId && g.status === 'pending_review' && !g.deletedAt,
  )
  if (!pending) {
    throw createError({ statusCode: 404, statusMessage: '待確認賓客不存在' })
  }

  pending.status = 'confirmed'
  return { guestId: pending.guestId }
})
