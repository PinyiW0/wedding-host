import type { H3Event } from 'h3'
import type { InvitationSentMarkedEvent, MarkInvitationSentBody } from '../../../../../../../app/types/api/guests'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

// 標記喜帖已寄送：PUT 冪等設值（重複送同值不報錯，可勾選可取消）
export default defineEventHandler(async (event: H3Event): Promise<InvitationSentMarkedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<MarkInvitationSentBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  const invitationSent = body?.sent === true
  await db.update(guests).set({ invitationSent }).where(eq(guests.guestId, guest.guestId))

  return { guestId: guest.guestId, invitationSent }
})
