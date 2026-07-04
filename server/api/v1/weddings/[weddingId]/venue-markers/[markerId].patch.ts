import type { H3Event } from 'h3'
import type { UpdateVenueMarkerBody, VenueMarkerUpdatedEvent } from '../../../../../../app/types/api/seating'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { venueMarkers } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<VenueMarkerUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const markerId = getRouterParam(event, 'markerId')!
  const body = await readBody<UpdateVenueMarkerBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(venueMarkers).where(and(eq(venueMarkers.weddingId, weddingId), eq(venueMarkers.markerId, markerId)))
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: '標記不存在' })

  const patch: Partial<typeof venueMarkers.$inferInsert> = {}
  if (body.label !== undefined) {
    const label = body.label.trim()
    if (!label)
      throw createError({ statusCode: 400, statusMessage: '請輸入標記文字' })
    patch.label = label
  }
  if (body.positionX !== undefined)
    patch.positionX = Math.max(0, Math.round(body.positionX))
  if (body.positionY !== undefined)
    patch.positionY = Math.max(0, Math.round(body.positionY))
  if (body.width !== undefined)
    patch.width = Math.max(40, Math.round(body.width))
  if (body.height !== undefined)
    patch.height = Math.max(24, Math.round(body.height))

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [marker] = Object.keys(patch).length
    ? await db.update(venueMarkers).set(patch).where(and(eq(venueMarkers.weddingId, weddingId), eq(venueMarkers.markerId, markerId))).returning()
    : [existing]

  return {
    markerId: marker!.markerId,
    weddingId: marker!.weddingId,
    label: marker!.label,
    positionX: marker!.positionX,
    positionY: marker!.positionY,
    width: marker!.width,
    height: marker!.height,
  }
})
