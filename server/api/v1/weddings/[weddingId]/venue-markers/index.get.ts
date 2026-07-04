import type { H3Event } from 'h3'
import type { VenueMarkerListItem } from '../../../../../../app/types/api/seating'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { venueMarkers } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<VenueMarkerListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(venueMarkers).where(eq(venueMarkers.weddingId, weddingId)).orderBy(asc(venueMarkers.seq))
  return rows.map(m => ({
    markerId: m.markerId,
    weddingId: m.weddingId,
    label: m.label,
    positionX: m.positionX,
    positionY: m.positionY,
    width: m.width,
    height: m.height,
  }))
})
