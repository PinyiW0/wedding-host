import type { H3Event } from 'h3'
import type { ReceptionStatusItem } from '../../../../../app/types/api/reception'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { guests } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ReceptionStatusItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), isNull(guests.deletedAt))).orderBy(asc(guests.seq))
  return rows.map(g => ({
    guestId: g.guestId,
    checkedIn: g.checkedInAt !== null,
    giftAmount: g.giftAmount,
    cakeBoxTypeId: g.cakeBoxDistributedTypeId,
  }))
})
