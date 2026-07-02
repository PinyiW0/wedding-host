import type { H3Event } from 'h3'
import type { MergePendingGuestBody, PendingGuestMergedEvent } from '../../../../../../../app/types/api/pending-guests'

import { mockGuests } from '../../../../../../mock/data/guests'

// 併入既有賓客：把待確認回覆套到指定正式賓客，待確認筆移除
export default defineEventHandler(async (event: H3Event): Promise<PendingGuestMergedEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<MergePendingGuestBody>(event)

  const pending = mockGuests.find(
    g => g.guestId === guestId && g.status === 'pending_review' && !g.deletedAt,
  )
  if (!pending) {
    throw createError({ statusCode: 404, statusMessage: '待確認賓客不存在' })
  }
  const target = mockGuests.find(
    g => g.guestId === body.targetGuestId && g.status !== 'pending_review' && !g.deletedAt,
  )
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  // 套用待確認回覆到正式賓客（保留正式賓客的身分資料，覆寫 RSVP 相關欄位）
  target.rsvpAttending = pending.rsvpAttending
  target.diet = pending.diet
  target.partySize = pending.partySize
  target.childChairCount = pending.childChairCount
  target.invitationPreference = pending.invitationPreference ?? target.invitationPreference
  target.mailingAddress = pending.mailingAddress ?? target.mailingAddress
  target.blessing = pending.blessing ?? target.blessing
  target.flowerDrawing = pending.flowerDrawing ?? target.flowerDrawing
  target.needsShuttle = pending.needsShuttle ?? target.needsShuttle
  target.shuttleCount = pending.shuttleCount ?? target.shuttleCount
  target.customAnswers = pending.customAnswers ?? target.customAnswers
  if (!target.contact && pending.contact)
    target.contact = pending.contact

  // 待確認筆移除（軟刪除）
  pending.deletedAt = new Date().toISOString()

  return { guestId: pending.guestId, targetGuestId: target.guestId }
})
