import type { H3Event } from 'h3'
import type { ReceptionStatusItem } from '../../../../../app/types/api/reception'

import { mockGuests } from '../../../../mock/data/guests'

export default defineEventHandler((event: H3Event): ReceptionStatusItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockGuests
    .filter(g => g.weddingId === weddingId && !g.deletedAt)
    .map(g => ({
      guestId: g.guestId,
      checkedIn: g.checkedInAt !== null,
      giftAmount: g.giftAmount,
      cakeBoxTypeId: g.cakeBoxDistributedTypeId,
    }))
})
