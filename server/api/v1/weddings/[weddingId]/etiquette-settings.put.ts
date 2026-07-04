import type { H3Event } from 'h3'
import type { EtiquetteSettingsBody, EtiquetteSettingsUpdatedEvent } from '../../../../../app/types/api/seating'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { etiquetteSettings, weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<EtiquetteSettingsUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<EtiquetteSettingsBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // singleton：先查有無設定，有則更新、無則新增（weddingId 為 PK）
  const [existing] = await db.select().from(etiquetteSettings).where(eq(etiquetteSettings.weddingId, weddingId))
  if (existing) {
    await db.update(etiquetteSettings).set({
      elderNearMain: body.elderNearMain,
      mainTableFull: body.mainTableFull,
      sameCategoryTogether: body.sameCategoryTogether,
    }).where(eq(etiquetteSettings.weddingId, weddingId))
  }
  else {
    await db.insert(etiquetteSettings).values({ weddingId, ...body })
  }

  return { weddingId, ...body }
})
