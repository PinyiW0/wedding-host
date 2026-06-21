import type { H3Event } from 'h3'
import type { EtiquetteWarningListItem } from '../../../../../../app/types/api/seating'

import { mockEtiquetteWarnings } from '../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event): EtiquetteWarningListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockEtiquetteWarnings
    .filter(w => w.weddingId === weddingId)
    .map(w => ({
      warningId: w.warningId,
      warningType: w.warningType,
      message: w.message,
      dismissed: w.dismissed,
    }))
})
