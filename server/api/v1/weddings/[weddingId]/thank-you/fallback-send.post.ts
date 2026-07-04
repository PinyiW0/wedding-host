import type { H3Event } from 'h3'
import type { SendThankYouFallbackBody, ThankYouFallbackSentEvent } from '../../../../../../app/types/api/thankyou'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { weddings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouFallbackSentEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SendThankYouFallbackBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  setResponseStatus(event, 201)
  return { weddingId, guestId: body.guestId, channel: body?.channel ?? 'email' }
})
