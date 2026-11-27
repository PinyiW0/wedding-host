import type { H3Event } from 'h3'
import type { ProjectionSettingsUpdatedEvent, UpdateProjectionSettingsBody } from '../../../../../app/types/api/projection'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { projectionSettings, weddings } from '../../../../db/schema'

const MAX_CUSTOM_FLOWERS = 50

export default defineEventHandler(async (event: H3Event): Promise<ProjectionSettingsUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateProjectionSettingsBody>(event)

  // 投影照片與自訂花由前端先直傳 R2，這裡只收網址（issue #226）
  assertImageRef(body?.photoDataUrl, '投影照片')
  if (body?.customFlowers != null) {
    if (!Array.isArray(body.customFlowers) || body.customFlowers.length > MAX_CUSTOM_FLOWERS) {
      throw createError({ statusCode: 400, statusMessage: '自訂花圖數量不正確' })
    }
    for (const flower of body.customFlowers)
      assertImageRef(flower, '自訂花圖')
  }

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const next = {
    weddingId,
    mediaType: body?.mediaType ?? 'none' as const,
    photoDataUrl: body?.photoDataUrl ?? null,
    videoUrl: body?.videoUrl ?? null,
    customFlowers: body?.customFlowers ?? [],
  }

  // singleton upsert：先查有無設定，有則更新、無則新增
  const [existing] = await db.select().from(projectionSettings).where(eq(projectionSettings.weddingId, weddingId))
  if (existing)
    await db.update(projectionSettings).set(next).where(eq(projectionSettings.weddingId, weddingId))
  else
    await db.insert(projectionSettings).values(next)

  return { ...next, customFlowers: [...next.customFlowers] }
})
