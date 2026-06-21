import type { H3Event } from 'h3'
import type { EtiquetteSettingsBody, EtiquetteSettingsUpdatedEvent } from '../../../../../app/types/api/seating'

import { mockEtiquetteSettings } from '../../../../mock/data/seating'
import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<EtiquetteSettingsUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<EtiquetteSettingsBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const existing = mockEtiquetteSettings.find(s => s.weddingId === weddingId)
  if (existing) {
    Object.assign(existing, body)
  }
  else {
    mockEtiquetteSettings.push({ weddingId, ...body })
  }

  return { weddingId, ...body }
})
