import type { H3Event } from 'h3'
import type { CakeBoxGuestExcludedEvent, ExcludeGuestCakeBoxBody } from '../../../../../../app/types/api/cakebox'

import { useDb } from '../../../../../db'
import { cakeBoxExclusions } from '../../../../../db/schema'

// 將某賓客標記為「不發放」（新人本人等不需喜餅者）；一位賓客一筆，避免重複
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxGuestExcludedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ExcludeGuestCakeBoxBody>(event)

  if (!body?.guestId) {
    throw createError({ statusCode: 400, statusMessage: '請指定賓客' })
  }

  // (weddingId, guestId) unique + onConflictDoNothing：冪等寫入取代 check-then-insert，
  // 併發重複由 DB 兜底、不產生多筆（issue #71）
  const db = useDb()
  await db.insert(cakeBoxExclusions).values({ weddingId, guestId: body.guestId }).onConflictDoNothing()

  setResponseStatus(event, 201)
  return { guestId: body.guestId }
})
