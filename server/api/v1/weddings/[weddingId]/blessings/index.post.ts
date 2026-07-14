import type { H3Event } from 'h3'
import type { BlessingSubmittedEvent, SubmitBlessingBody } from '../../../../../../app/types/api/blessings'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { blessings, guests } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<BlessingSubmittedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SubmitBlessingBody>(event)

  if (!body?.message) {
    throw createError({ statusCode: 400, statusMessage: '請輸入祝福留言' })
  }

  const db = useDb()
  // 身分二擇一：專屬連結帶 guestId；共用 QR 帶賓客自填姓名
  let guestId = body.guestId || null
  const guestName = body.guestName?.trim() || null
  // guestId 需屬於本婚禮（issue #70 / M6）：否則忽略，防持婚禮簽名者冒用他人 guestId 上牆
  if (guestId) {
    const [owner] = await db.select({ guestId: guests.guestId }).from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId)))
    if (!owner)
      guestId = null
  }
  if (!guestId && !guestName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入您的姓名' })
  }

  const blessingId = `blessing-${crypto.randomUUID().slice(0, 8)}`
  const photoUrl = body.photoUrl ?? null
  await db.insert(blessings).values({
    blessingId,
    weddingId,
    guestId,
    guestName,
    message: body.message,
    photoUrl,
    status: 'submitted',
    rejectReason: null,
  })

  setResponseStatus(event, 201)
  return { blessingId, guestId, guestName, message: body.message, photoUrl }
})
