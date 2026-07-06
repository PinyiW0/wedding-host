import type { H3Event } from 'h3'
import type { BlessingSubmittedEvent, SubmitBlessingBody } from '../../../../../../app/types/api/blessings'

import { useDb } from '../../../../../db'
import { blessings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<BlessingSubmittedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SubmitBlessingBody>(event)

  if (!body?.message) {
    throw createError({ statusCode: 400, statusMessage: '請輸入祝福留言' })
  }

  // 身分二擇一：專屬連結帶 guestId；共用 QR 帶賓客自填姓名
  const guestId = body.guestId || null
  const guestName = body.guestName?.trim() || null
  if (!guestId && !guestName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入您的姓名' })
  }

  const blessingId = `blessing-${crypto.randomUUID().slice(0, 8)}`
  const photoUrl = body.photoUrl ?? null
  const db = useDb()
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
