import type { H3Event } from 'h3'
import type { DismissEtiquetteWarningBody, EtiquetteWarningDismissedEvent } from '../../../../../../../app/types/api/seating'

import { mockEtiquetteWarnings } from '../../../../../../mock/data/seating'
import { mockWeddings } from '../../../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<EtiquetteWarningDismissedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const warningId = getRouterParam(event, 'warningId')
  const body = await readBody<DismissEtiquetteWarningBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const warning = mockEtiquetteWarnings.find(w => w.warningId === warningId)
  if (warning) {
    warning.dismissed = true
  }

  setResponseStatus(event, 201)
  return { warningId: warningId ?? '', warningType: body?.warningType ?? warning?.warningType ?? '' }
})
