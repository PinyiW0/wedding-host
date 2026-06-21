import type { H3Event } from 'h3'
import type { SendThankYouFallbackBody, ThankYouFallbackSentEvent } from '../../../../../../app/types/api/thankyou'

import { mockWeddings } from '../../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouFallbackSentEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SendThankYouFallbackBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  setResponseStatus(event, 201)
  return { weddingId, guestId: body.guestId, channel: body?.channel ?? 'email' }
})
