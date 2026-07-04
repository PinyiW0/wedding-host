import type { H3Event } from 'h3'
import type { VenueLayoutDetail } from '../../../../../app/types/api/seating'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { venueLayouts } from '../../../../db/schema'

// 讀回該婚禮的場地佈局：尚未設定回 null（重整後仍能還原 modal 既有值）
export default defineEventHandler(async (event: H3Event): Promise<VenueLayoutDetail | null> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [layout] = await db.select().from(venueLayouts).where(eq(venueLayouts.weddingId, weddingId))
  if (!layout) {
    return null
  }
  return {
    weddingId: layout.weddingId,
    stageWidth: layout.stageWidth,
    stageHeight: layout.stageHeight,
    stagePositionX: layout.stagePositionX,
    stagePositionY: layout.stagePositionY,
  }
})
