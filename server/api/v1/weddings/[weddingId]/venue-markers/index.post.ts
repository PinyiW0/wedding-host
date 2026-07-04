import type { H3Event } from 'h3'
import type { CreateVenueMarkerBody, VenueMarkerCreatedEvent } from '../../../../../../app/types/api/seating'

import { useDb } from '../../../../../db'
import { venueMarkers } from '../../../../../db/schema'

// 預設尺寸與落點（左上角附近，之後由拖曳調整位置）
const DEFAULT_WIDTH = 140
const DEFAULT_HEIGHT = 48

export default defineEventHandler(async (event: H3Event): Promise<VenueMarkerCreatedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<CreateVenueMarkerBody>(event)

  const label = body?.label?.trim() ?? ''
  if (!label)
    throw createError({ statusCode: 400, statusMessage: '請輸入標記文字' })

  const marker = {
    markerId: `marker-${crypto.randomUUID().slice(0, 8)}`,
    weddingId,
    label,
    positionX: Math.max(0, Math.round(body.positionX ?? 24)),
    positionY: Math.max(0, Math.round(body.positionY ?? 24)),
    width: Math.max(40, Math.round(body.width ?? DEFAULT_WIDTH)),
    height: Math.max(24, Math.round(body.height ?? DEFAULT_HEIGHT)),
  }
  const db = useDb()
  await db.insert(venueMarkers).values(marker)

  setResponseStatus(event, 201)
  return { ...marker }
})
