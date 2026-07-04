import type { H3Event } from 'h3'
import type { VenueLayoutBody, VenueLayoutConfiguredEvent } from '../../../../../app/types/api/seating'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { venueLayouts, weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<VenueLayoutConfiguredEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<VenueLayoutBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // singleton：先查有無設定，有則更新、無則新增（weddingId 為 PK）
  const [existing] = await db.select().from(venueLayouts).where(eq(venueLayouts.weddingId, weddingId))
  if (existing) {
    await db.update(venueLayouts).set({
      stageWidth: body.stageWidth,
      stageHeight: body.stageHeight,
      stagePositionX: body.stagePositionX,
      stagePositionY: body.stagePositionY,
    }).where(eq(venueLayouts.weddingId, weddingId))
  }
  else {
    await db.insert(venueLayouts).values({ weddingId, ...body })
  }

  return { weddingId, ...body }
})
