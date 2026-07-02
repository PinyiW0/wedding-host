import type { H3Event } from 'h3'
import type { PendingGuestRejectedEvent } from '../../../../../../../app/types/api/pending-guests'

import { mockGuests } from '../../../../../../mock/data/guests'

// 略過：拒絕此待確認回覆（軟刪除，從待確認區移除）
export default defineEventHandler((event: H3Event): PendingGuestRejectedEvent => {
  const guestId = getRouterParam(event, 'guestId')

  const pending = mockGuests.find(
    g => g.guestId === guestId && g.status === 'pending_review' && !g.deletedAt,
  )
  if (!pending) {
    throw createError({ statusCode: 404, statusMessage: '待確認賓客不存在' })
  }

  pending.deletedAt = new Date().toISOString()
  return { guestId: pending.guestId }
})
