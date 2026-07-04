import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxExtraOrders } from '../../../../../db/schema'

// 移除一筆額外配發
export default defineEventHandler(async (event: H3Event) => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const extraOrderId = getRouterParam(event, 'extraOrderId')!
  const db = useDb()
  await db.delete(cakeBoxExtraOrders)
    .where(and(eq(cakeBoxExtraOrders.weddingId, weddingId), eq(cakeBoxExtraOrders.extraOrderId, extraOrderId)))
  return { ok: true }
})
