import type { H3Event } from 'h3'
import type { CreateGuestBody, GuestCreatedEvent } from '../../../../../../app/types/api/guests'

import { useDb } from '../../../../../db'
import { guests } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateGuestBody>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入賓客姓名' })
  }

  const guestId = `guest-${crypto.randomUUID().slice(0, 8)}`
  const notes = body.notes ?? null
  const partySize = body.partySize ?? 1
  const childChairCount = body.childChairCount ?? 0
  // 數字欄與 enum 欄驗證（issue #70 / M4）：防浮點／溢位／負值落 integer 欄、非法 enum 污染統計
  assertPositiveInt(partySize, '總人數', 999)
  assertPositiveInt(childChairCount, '兒童椅數', 99)
  if (body.side !== undefined)
    assertEnum(body.side, ['groom', 'bride'], '男女方')
  if (body.diet !== undefined)
    assertEnum(body.diet, ['meat', 'vegetarian'], '飲食偏好')
  const db = useDb()
  await db.insert(guests).values({
    guestId,
    weddingId,
    name: body.name,
    side: body.side,
    diet: body.diet,
    category: body.category,
    contact: body.contact,
    childChairCount,
    notes,
    lineUserId: null,
    rsvpAttending: null,
    checkedInAt: null,
    giftAmount: null,
    cakeBoxDistributedTypeId: null,
    partySize,
    tableName: null,
    deletedAt: null,
    invitationSent: false,
  })

  setResponseStatus(event, 201)
  return {
    guestId,
    weddingId,
    name: body.name,
    side: body.side,
    diet: body.diet,
    category: body.category,
    contact: body.contact,
    partySize,
    childChairCount,
    notes,
  }
})
