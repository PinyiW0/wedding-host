import type { H3Event } from 'h3'
import type { CakeBoxGuestExcludedEvent, ExcludeGuestCakeBoxBody } from '../../../../../../app/types/api/cakebox'

import { mockCakeBoxExclusions } from '../../../../../mock/data/cakebox'

// 將某賓客標記為「不發放」（新人本人等不需喜餅者）；一位賓客一筆，避免重複
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxGuestExcludedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ExcludeGuestCakeBoxBody>(event)

  if (!body?.guestId) {
    throw createError({ statusCode: 400, statusMessage: '請指定賓客' })
  }

  if (!mockCakeBoxExclusions.some(e => e.weddingId === weddingId && e.guestId === body.guestId))
    mockCakeBoxExclusions.push({ weddingId, guestId: body.guestId })

  setResponseStatus(event, 201)
  return { guestId: body.guestId }
})
