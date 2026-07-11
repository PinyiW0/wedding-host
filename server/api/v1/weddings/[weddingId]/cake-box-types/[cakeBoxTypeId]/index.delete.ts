import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { cakeBoxTypes } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event) => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [existing] = await db.select().from(cakeBoxTypes).where(and(eq(cakeBoxTypes.weddingId, weddingId), eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }
  await db.delete(cakeBoxTypes).where(eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId))

  setResponseStatus(event, 204)
})
