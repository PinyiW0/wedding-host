import type { H3Event } from 'h3'
import type { ProjectionSettingsUpdatedEvent, UpdateProjectionSettingsBody } from '../../../../../app/types/api/projection'

import { mockProjectionSettings } from '../../../../mock/data/projection'
import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<ProjectionSettingsUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateProjectionSettingsBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const next = {
    weddingId,
    mediaType: body?.mediaType ?? 'none',
    photoDataUrl: body?.photoDataUrl ?? null,
    videoUrl: body?.videoUrl ?? null,
    customFlowers: body?.customFlowers ?? [],
  }

  const existing = mockProjectionSettings.find(s => s.weddingId === weddingId)
  if (existing)
    Object.assign(existing, next)
  else
    mockProjectionSettings.push(next)

  return { ...next, customFlowers: [...next.customFlowers] }
})
