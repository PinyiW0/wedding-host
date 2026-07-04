import type { H3Event } from 'h3'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event) => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  if (wedding.deletedAt) {
    throw createError({ statusCode: 409, statusMessage: '婚禮已被刪除' })
  }
  await db.update(weddings).set({ deletedAt: new Date().toISOString() }).where(eq(weddings.weddingId, weddingId))

  setResponseStatus(event, 204)
})
