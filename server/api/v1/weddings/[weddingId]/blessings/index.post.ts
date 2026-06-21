import type { H3Event } from 'h3'
import type { BlessingSubmittedEvent, SubmitBlessingBody } from '../../../../../../app/types/api/blessings'

import { mockBlessings } from '../../../../../mock/data/blessings'

export default defineEventHandler(async (event: H3Event): Promise<BlessingSubmittedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SubmitBlessingBody>(event)

  if (!body?.message) {
    throw createError({ statusCode: 400, statusMessage: '請輸入祝福留言' })
  }

  const blessingId = `blessing-${crypto.randomUUID().slice(0, 8)}`
  const photoUrl = body.photoUrl ?? null
  mockBlessings.push({
    blessingId,
    weddingId,
    guestId: body.guestId,
    message: body.message,
    photoUrl,
    status: 'submitted',
    rejectReason: null,
  })

  setResponseStatus(event, 201)
  return { blessingId, guestId: body.guestId, message: body.message, photoUrl }
})
