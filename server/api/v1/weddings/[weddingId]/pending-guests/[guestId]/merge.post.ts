import type { H3Event } from 'h3'
import type { MergePendingGuestBody, PendingGuestMergedEvent } from '../../../../../../../app/types/api/pending-guests'

import { and, eq, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

// 併入既有賓客：把待確認回覆套到指定正式賓客，待確認筆移除
export default defineEventHandler(async (event: H3Event): Promise<PendingGuestMergedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<MergePendingGuestBody>(event)

  const db = useDb()
  const [pending] = await db.select().from(guests).where(and(
    eq(guests.weddingId, weddingId),
    eq(guests.guestId, guestId),
    eq(guests.status, 'pending_review'),
    isNull(guests.deletedAt),
  ))
  if (!pending) {
    throw createError({ statusCode: 404, statusMessage: '待確認賓客不存在' })
  }
  const [target] = await db.select().from(guests).where(and(
    eq(guests.weddingId, weddingId),
    eq(guests.guestId, body.targetGuestId),
    or(isNull(guests.status), ne(guests.status, 'pending_review')),
    isNull(guests.deletedAt),
  ))
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  // 套用待確認回覆到正式賓客（保留正式賓客的身分資料，覆寫 RSVP 相關欄位）
  const patch: Partial<typeof guests.$inferInsert> = {
    rsvpAttending: pending.rsvpAttending,
    diet: pending.diet,
    partySize: pending.partySize,
    childChairCount: pending.childChairCount,
    invitationPreference: pending.invitationPreference ?? target.invitationPreference,
    mailingAddress: pending.mailingAddress ?? target.mailingAddress,
    blessing: pending.blessing ?? target.blessing,
    flowerDrawing: pending.flowerDrawing ?? target.flowerDrawing,
    needsShuttle: pending.needsShuttle ?? target.needsShuttle,
    shuttleCount: pending.shuttleCount ?? target.shuttleCount,
    customAnswers: pending.customAnswers ?? target.customAnswers,
  }
  if (!target.contact && pending.contact)
    patch.contact = pending.contact
  await db.update(guests).set(patch).where(eq(guests.guestId, target.guestId))

  // 待確認筆移除（軟刪除）
  await db.update(guests).set({ deletedAt: new Date().toISOString() }).where(eq(guests.guestId, pending.guestId))

  return { guestId: pending.guestId, targetGuestId: target.guestId }
})
