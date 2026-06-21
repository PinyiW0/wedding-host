import type { H3Event } from 'h3'
import type { TableListItem } from '../../../../../../app/types/api/seating'

import { mockTables } from '../../../../../mock/data/seating'

export default defineEventHandler((event: H3Event): TableListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockTables.filter(t => t.weddingId === weddingId)
})
