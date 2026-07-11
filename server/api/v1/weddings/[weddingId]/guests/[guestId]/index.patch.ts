import type { H3Event } from 'h3'
import type { GuestUpdatedEvent, UpdateGuestBody } from '../../../../../../../app/types/api/guests'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestUpdatedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateGuestBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  const patch: Partial<typeof guests.$inferInsert> = {}
  if (body.name !== undefined)
    patch.name = body.name
  if (body.side !== undefined)
    patch.side = body.side
  if (body.diet !== undefined)
    patch.diet = body.diet
  if (body.category !== undefined)
    patch.category = body.category
  if (body.contact !== undefined)
    patch.contact = body.contact
  if (body.partySize !== undefined)
    patch.partySize = body.partySize
  if (body.childChairCount !== undefined)
    patch.childChairCount = body.childChairCount
  if (body.notes !== undefined)
    patch.notes = body.notes
  // 管理員修正的 RSVP 回覆欄位（接駁／喜帖）
  if (body.needsShuttle !== undefined)
    patch.needsShuttle = body.needsShuttle
  if (body.shuttleCount !== undefined)
    patch.shuttleCount = body.shuttleCount
  if (body.invitationPreference !== undefined)
    patch.invitationPreference = body.invitationPreference
  if (body.mailingAddress !== undefined)
    patch.mailingAddress = body.mailingAddress

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [guest] = Object.keys(patch).length
    ? await db.update(guests).set(patch).where(eq(guests.guestId, guestId)).returning()
    : [existing]

  return {
    guestId: guest!.guestId,
    weddingId: guest!.weddingId,
    name: guest!.name,
    side: guest!.side,
    diet: guest!.diet,
    category: guest!.category,
    contact: guest!.contact,
    partySize: guest!.partySize,
    childChairCount: guest!.childChairCount,
    notes: guest!.notes,
  }
})
