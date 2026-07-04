import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { venueMarkers } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<void> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const markerId = getRouterParam(event, 'markerId')!

  const db = useDb()
  const [existing] = await db.select().from(venueMarkers).where(and(eq(venueMarkers.weddingId, weddingId), eq(venueMarkers.markerId, markerId)))
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '標記不存在' })

  await db.delete(venueMarkers)
    .where(and(eq(venueMarkers.weddingId, weddingId), eq(venueMarkers.markerId, markerId)))
  setResponseStatus(event, 204)
})
