import type { H3Event } from 'h3'
import type { GuestListItem } from '../../../../../../app/types/api/guests'

import { and, asc, eq, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(guests).where(and(
    eq(guests.weddingId, weddingId),
    or(isNull(guests.status), ne(guests.status, 'pending_review')),
  )).orderBy(asc(guests.seq))
  return rows.map(g => ({
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
    customAnswers: g.customAnswers ?? null,
    invitationSent: g.invitationSent,
    status: g.status ?? 'confirmed',
    source: g.source ?? 'manual',
    deletedAt: g.deletedAt,
  }))
})
