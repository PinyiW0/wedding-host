import type { H3Event } from 'h3'
import type { PendingGuestRejectedEvent } from '../../../../../../../app/types/api/pending-guests'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

// 略過：拒絕此待確認回覆（軟刪除，從待確認區移除）
export default defineEventHandler(async (event: H3Event): Promise<PendingGuestRejectedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!

  const db = useDb()
  const [pending] = await db.select().from(guests).where(and(
    eq(guests.guestId, guestId),
    eq(guests.status, 'pending_review'),
    isNull(guests.deletedAt),
  ))
  if (!pending) {
    throw createError({ statusCode: 404, statusMessage: '待確認賓客不存在' })
  }

  await db.update(guests).set({ deletedAt: new Date().toISOString() }).where(eq(guests.guestId, guestId))
  return { guestId: pending.guestId }
})
