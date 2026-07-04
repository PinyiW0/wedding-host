import type { H3Event } from 'h3'
import type { CakeBoxGuestExcludedEvent, ExcludeGuestCakeBoxBody } from '../../../../../../app/types/api/cakebox'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxExclusions } from '../../../../../db/schema'

// 將某賓客標記為「不發放」（新人本人等不需喜餅者）；一位賓客一筆，避免重複
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxGuestExcludedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ExcludeGuestCakeBoxBody>(event)

  if (!body?.guestId) {
    throw createError({ statusCode: 400, statusMessage: '請指定賓客' })
  }

  const db = useDb()
  const [existing] = await db.select().from(cakeBoxExclusions).where(and(eq(cakeBoxExclusions.weddingId, weddingId), eq(cakeBoxExclusions.guestId, body.guestId)))
  if (!existing)
    await db.insert(cakeBoxExclusions).values({ weddingId, guestId: body.guestId })

  setResponseStatus(event, 201)
  return { guestId: body.guestId }
})
