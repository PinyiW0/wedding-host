import type { H3Event } from 'h3'
import type { GuestListItem } from '../../../../../../app/types/api/guests'

import { mockGuests } from '../../../../../mock/data/guests'

export default defineEventHandler((event: H3Event): GuestListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockGuests
    .filter(g => g.weddingId === weddingId)
    .map(g => ({
      guestId: g.guestId,
      weddingId: g.weddingId,
      name: g.name,
      side: g.side,
      diet: g.diet,
      category: g.category,
      contact: g.contact,
      needChildSeat: g.needChildSeat,
      notes: g.notes,
      lineUserId: g.lineUserId,
      rsvpAttending: g.rsvpAttending,
      deletedAt: g.deletedAt,
    }))
})
