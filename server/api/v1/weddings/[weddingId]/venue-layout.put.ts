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
      // 參考圖：body 未帶＝維持既有（舞台表單只送舞台欄位）、帶 null＝移除
      ...(body.referenceImageUrl !== undefined ? { referenceImageUrl: body.referenceImageUrl } : {}),
      // 參考圖對位：未帶＝維持既有
      ...(body.refImageX !== undefined ? { refImageX: body.refImageX } : {}),
      ...(body.refImageY !== undefined ? { refImageY: body.refImageY } : {}),
      ...(body.refImageScale !== undefined ? { refImageScale: body.refImageScale } : {}),
    }).where(eq(venueLayouts.weddingId, weddingId))
  }
  else {
    await db.insert(venueLayouts).values({ weddingId, ...body, referenceImageUrl: body.referenceImageUrl ?? null })
  }

  const [saved] = await db.select().from(venueLayouts).where(eq(venueLayouts.weddingId, weddingId))
  return {
    weddingId,
    stageWidth: saved!.stageWidth,
    stageHeight: saved!.stageHeight,
    stagePositionX: saved!.stagePositionX,
    stagePositionY: saved!.stagePositionY,
    referenceImageUrl: saved!.referenceImageUrl,
    refImageX: saved!.refImageX,
    refImageY: saved!.refImageY,
    refImageScale: saved!.refImageScale,
  }
})
