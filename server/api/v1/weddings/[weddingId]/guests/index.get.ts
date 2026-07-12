import type { H3Event } from 'h3'
import type { GuestListItem } from '../../../../../../app/types/api/guests'

import { and, asc, eq, getTableColumns, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests } from '../../../../../db/schema'

type SlimRow = Omit<typeof guests.$inferSelect, 'blessing' | 'flowerDrawing'>

// 預設 slim：不撈 blessing / flowerDrawing（base64 手繪可達數十 KB/張），
// 僅 RSVP 回覆管理頁（CSV 匯出、花圖下載）帶 ?fields=full 取完整欄位
export default defineEventHandler(async (event: H3Event): Promise<GuestListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const full = getQuery(event).fields === 'full'
  const db = useDb()
  const where = and(
    eq(guests.weddingId, weddingId),
    or(isNull(guests.status), ne(guests.status, 'pending_review')),
  )
  const toItem = (g: SlimRow): GuestListItem => ({
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
    needsShuttle: g.needsShuttle ?? null,
    shuttleCount: g.shuttleCount ?? null,
    customAnswers: g.customAnswers ?? null,
    invitationSent: g.invitationSent,
    status: g.status ?? 'confirmed',
    source: g.source ?? 'manual',
    deletedAt: g.deletedAt,
  })
  if (full) {
    const rows = await db.select().from(guests).where(where).orderBy(asc(guests.seq))
    return rows.map(g => ({
      ...toItem(g),
      blessing: g.blessing ?? null,
      flowerDrawing: g.flowerDrawing ?? null,
    }))
  }
  const { blessing: _blessing, flowerDrawing: _flowerDrawing, ...slimColumns } = getTableColumns(guests)
  const rows = await db.select(slimColumns).from(guests).where(where).orderBy(asc(guests.seq))
  return rows.map(toItem)
})
