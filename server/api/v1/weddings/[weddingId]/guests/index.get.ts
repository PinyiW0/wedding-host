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
      childChairCount: g.childChairCount,
      notes: g.notes,
      lineUserId: g.lineUserId,
      rsvpAttending: g.rsvpAttending,
      partySize: g.partySize,
      tableName: g.tableName,
      invitationPreference: g.invitationPreference ?? null,
      mailingAddress: g.mailingAddress ?? null,
      blessing: g.blessing ?? null,
      flowerDrawing: g.flowerDrawing ?? null,
      needsShuttle: g.needsShuttle ?? null,
      shuttleCount: g.shuttleCount ?? null,
      deletedAt: g.deletedAt,
    }))
})
