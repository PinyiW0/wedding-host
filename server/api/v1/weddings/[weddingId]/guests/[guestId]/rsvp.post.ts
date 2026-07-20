import type { H3Event } from 'h3'
import type { RsvpSubmittedEvent, SubmitRsvpBody } from '../../../../../../../app/types/api/rsvp'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests, seats } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RsvpSubmittedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SubmitRsvpBody>(event)
  assertValidRsvpInput(body)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.rsvpAttending) {
    throw createError({ statusCode: 409, statusMessage: '已提交過 RSVP' })
  }
  const patch: Partial<typeof guests.$inferInsert> = {
    rsvpAttending: body.attending,
    diet: body.diet,
    childChairCount: body.childChairCount,
    // 同步總人數：本人 + 同行（plusOneCount）+ 兒童椅嬰兒
    partySize: 1 + body.plusOneCount + body.childChairCount,
  }

  // 補充欄位：能對應既有欄位的就更新，其餘存入專屬欄位（皆選填）
  if (body.guestName)
    patch.name = body.guestName
  if (body.relationship)
    patch.side = body.relationship
  // 有填才動分類（保留空值不覆寫的現行語意）；find-or-create 成 categoryId
  let resolvedCategoryTier: number | null = null
  if (body.relationCategory?.trim()) {
    const resolvedCategory = await resolveCategory(db, weddingId, body.relationCategory.trim())
    patch.categoryId = resolvedCategory?.categoryId ?? null
    resolvedCategoryTier = resolvedCategory?.tier ?? null
  }
  if (body.phone)
    patch.contact = body.phone
  if (body.invitation !== undefined)
    patch.invitationPreference = body.invitation
  if (body.mailingAddress !== undefined)
    patch.mailingAddress = body.mailingAddress
  if (body.blessing !== undefined)
    patch.blessing = body.blessing
  if (body.flowerDrawing !== undefined)
    patch.flowerDrawing = body.flowerDrawing
  if (body.needsShuttle !== undefined)
    patch.needsShuttle = body.needsShuttle
  if (body.shuttleCount !== undefined)
    patch.shuttleCount = body.shuttleCount
  if (body.customAnswers !== undefined)
    patch.customAnswers = body.customAnswers

  await db.update(guests).set(patch).where(eq(guests.guestId, guest.guestId))

  // 婉拒者不進排桌次（issue #96）：釋放先前已被安排的座位
  if (body.attending === 'declined')
    await db.delete(seats).where(eq(seats.guestId, guest.guestId))

  // 男方親屬預設不發放喜餅（issue #105）：RSVP 可補側別／分類，判定轉換時同步排除列
  if (body.relationship || body.relationCategory?.trim()) {
    const oldTier = await getCategoryTier(db, guest.categoryId)
    const newTier = body.relationCategory?.trim() ? resolvedCategoryTier : oldTier
    await syncGroomRelativeNoBox(
      db,
      weddingId,
      guest.guestId,
      isGroomRelative(guest.side, oldTier),
      isGroomRelative(patch.side ?? guest.side, newTier),
    )
  }

  setResponseStatus(event, 201)
  return {
    guestId: guest.guestId,
    attending: body.attending,
    diet: body.diet,
    plusOneCount: body.plusOneCount,
    childChairCount: body.childChairCount,
    guestName: body.guestName,
    relationship: body.relationship,
    relationCategory: body.relationCategory,
    phone: body.phone,
    invitation: body.invitation,
    mailingAddress: body.mailingAddress,
    blessing: body.blessing,
    flowerDrawing: body.flowerDrawing,
    needsShuttle: body.needsShuttle,
    shuttleCount: body.shuttleCount,
    customAnswers: body.customAnswers,
  }
})
