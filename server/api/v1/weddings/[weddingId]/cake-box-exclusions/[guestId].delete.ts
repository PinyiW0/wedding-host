import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxExclusions } from '../../../../../db/schema'

// 取消某賓客的「不發放」標記（恢復為正常領取）
export default defineEventHandler(async (event: H3Event) => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const guestId = getRouterParam(event, 'guestId')!
  const db = useDb()
  await db.delete(cakeBoxExclusions)
    .where(and(eq(cakeBoxExclusions.weddingId, weddingId), eq(cakeBoxExclusions.guestId, guestId)))
  return { ok: true }
})
