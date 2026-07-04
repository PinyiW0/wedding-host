import type { H3Event } from 'h3'
import type { ProjectionSettings } from '../../../../../app/types/api/projection'

import { mockProjectionSettings } from '../../../../mock/data/projection'
import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler((event: H3Event): ProjectionSettings => {
  const weddingId = getRouterParam(event, 'weddingId')!

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // 未設定回預設值（對齊 rsvp-config「未設定回預設」慣例）
  const existing = mockProjectionSettings.find(s => s.weddingId === weddingId)
  return existing
    ? { ...existing, customFlowers: [...existing.customFlowers] }
    : { weddingId, mediaType: 'none', photoDataUrl: null, videoUrl: null, customFlowers: [] }
})
