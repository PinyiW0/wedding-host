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
  // 這支刻意整列撈：併入時要把待確認筆的祝福與手繪花圖搬到正式賓客（低頻的後台操作，不在輪詢路徑上）
  const [pending] = await db.select().from(guests).where(and(
    eq(guests.weddingId, weddingId),
    eq(guests.guestId, guestId),
    eq(guests.status, 'pending_review'),
    isNull(guests.deletedAt),
  ))
  if (!pending) {
    throw createError({ statusCode: 404, statusMessage: '待確認賓客不存在' })
  }
  // 同上：目標賓客也要整列，才能在待確認筆沒填時保留原本的祝福與花圖
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
    invitedPartySize: target.invitedPartySize ?? (target.rsvpAttending === null ? target.partySize : null),
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

  // 併入的人數與正式賓客不同時同步座位（issue #174）：與賓客自行改 RSVP 同一套規則
  await syncSeatsOnPartyChange(
    db,
    target.guestId,
    { partySize: target.partySize, childChairCount: target.childChairCount },
    { partySize: pending.partySize, childChairCount: pending.childChairCount },
  )

  await defaultDeclinedNoBox(db, weddingId, target.guestId, target.rsvpAttending, pending.rsvpAttending)

  // 待確認筆移除（軟刪除）
  await db.update(guests).set({ deletedAt: new Date().toISOString() }).where(eq(guests.guestId, pending.guestId))

  return { guestId: pending.guestId, targetGuestId: target.guestId }
})
