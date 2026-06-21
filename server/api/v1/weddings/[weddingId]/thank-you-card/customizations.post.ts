import type { H3Event } from 'h3'
import type { CustomizeThankYouCardBody, ThankYouCardCustomizedEvent } from '../../../../../../app/types/api/thankyou'

import { mockThankYouCustomizations } from '../../../../../mock/data/thankyou'
import { mockWeddings } from '../../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouCardCustomizedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CustomizeThankYouCardBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const existing = mockThankYouCustomizations.find(c => c.weddingId === weddingId && c.guestId === body.guestId)
  if (existing) {
    existing.customContent = body.customContent
  }
  else {
    mockThankYouCustomizations.push({ weddingId, guestId: body.guestId, customContent: body.customContent })
  }

  setResponseStatus(event, 201)
  return { weddingId, guestId: body.guestId, customContent: body.customContent }
})
