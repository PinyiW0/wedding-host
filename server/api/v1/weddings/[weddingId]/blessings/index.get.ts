import type { H3Event } from 'h3'
import type { BlessingListItem } from '../../../../../../app/types/api/blessings'

import { mockBlessings } from '../../../../../mock/data/blessings'

export default defineEventHandler((event: H3Event): BlessingListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockBlessings.filter(b => b.weddingId === weddingId)
})
