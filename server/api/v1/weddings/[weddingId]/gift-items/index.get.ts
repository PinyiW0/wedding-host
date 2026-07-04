import type { H3Event } from 'h3'
import type { GiftItemListItem } from '../../../../../../app/types/api/gifts'

import { mockGiftItems } from '../../../../../mock/data/gifts'

export default defineEventHandler((event: H3Event): GiftItemListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')!
  return mockGiftItems.filter(g => g.weddingId === weddingId)
})
