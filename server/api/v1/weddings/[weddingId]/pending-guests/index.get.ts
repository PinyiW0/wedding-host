import type { H3Event } from 'h3'
import type { GuestListItem } from '../../../../../../app/types/api/guests'

import { and, asc, eq, getTableColumns, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories, guests } from '../../../../../db/schema'

// 待確認賓客清單：公開自助回覆（status='pending_review'）且未略過者
export default defineEventHandler(async (event: H3Event): Promise<GuestListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  // leftJoin 取分類名稱與 tier（合約回名稱，issue #94）
  const rows = await db.select({ ...getTableColumns(guests), ...categoryCols })
    .from(guests)
    .leftJoin(guestCategories, eq(guests.categoryId, guestCategories.categoryId))
    .where(and(
      eq(guests.weddingId, weddingId),
      eq(guests.status, 'pending_review'),
      isNull(guests.deletedAt),
    ))
    .orderBy(asc(guests.seq))
  return rows.map(g => ({
    guestId: g.guestId,
    weddingId: g.weddingId,
    name: g.name,
    side: g.side,
    diet: g.diet,
    category: g.categoryName ?? '',
    categoryTier: g.categoryTier ?? 3,
    categoryIsMainTable: g.categoryIsMainTable ?? false,
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
    status: g.status ?? 'confirmed',
    source: g.source ?? 'manual',
    deletedAt: g.deletedAt,
  }))
})
