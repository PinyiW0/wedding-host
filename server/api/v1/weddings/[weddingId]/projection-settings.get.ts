import type { H3Event } from 'h3'
import type { ProjectionSettings } from '../../../../../app/types/api/projection'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { projectionSettings, weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ProjectionSettings> => {
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // 未設定回預設值（對齊 rsvp-config「未設定回預設」慣例）
  const [existing] = await db.select().from(projectionSettings).where(eq(projectionSettings.weddingId, weddingId))
  return existing
    ? {
        weddingId: existing.weddingId,
        mediaType: existing.mediaType,
        photoDataUrl: existing.photoDataUrl,
        videoUrl: existing.videoUrl,
        customFlowers: existing.customFlowers,
      }
    : { weddingId, mediaType: 'none', photoDataUrl: null, videoUrl: null, customFlowers: [] }
})
