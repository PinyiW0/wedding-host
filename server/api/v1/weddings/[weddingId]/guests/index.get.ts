import type { H3Event } from 'h3'
import type { GuestListItem } from '../../../../../../app/types/api/guests'

import { and, asc, eq, getTableColumns, isNull, ne, or } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories, guests } from '../../../../../db/schema'

// 合約回名稱；tier / isMainTable 供座位排序（名稱與語意脫鉤，issue #94），孤兒時以預設兜底
interface CategoryCols { categoryName: string | null, categoryTier: number | null, categoryIsMainTable: boolean | null }
type SlimRow = Omit<typeof guests.$inferSelect, 'blessing' | 'flowerDrawing'> & CategoryCols

// 預設 slim：不撈 blessing / flowerDrawing（base64 手繪可達數十 KB/張），
// 僅 RSVP 回覆管理頁（CSV 匯出、花圖下載）帶 ?fields=full 取完整欄位
// 接待員視角剔除的敏感欄位（issue #70 / M3）：報到／發喜餅不需這些 PII
function stripForReception(item: GuestListItem): GuestListItem {
  return { ...item, contact: '', notes: null, lineUserId: null, mailingAddress: null, customAnswers: null }
}

export default defineEventHandler(async (event: H3Event): Promise<GuestListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  // 接待員略過 fields=full（不撈 blessing/flowerDrawing）並剔除聯絡方式等敏感欄位
  const isReception = event.context.authUser?.role === '接待員'
  const full = !isReception && getQuery(event).fields === 'full'
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
    needsShuttle: g.needsShuttle ?? null,
    shuttleCount: g.shuttleCount ?? null,
    customAnswers: g.customAnswers ?? null,
    invitationSent: g.invitationSent,
    status: g.status ?? 'confirmed',
    source: g.source ?? 'manual',
    deletedAt: g.deletedAt,
  })
  // leftJoin 分類字典取名稱與 tier（必須 leftJoin：無 FK ⇒ 孤兒 categoryId 物理上可能存在，
  // innerJoin 會讓那些賓客從名單無聲消失）
  if (full) {
    // full 分支須明確 select（原無參數 db.select() 掛 join 後回傳會變巢狀 → blessing 全 undefined）
    const rows = await db.select({ ...getTableColumns(guests), ...categoryCols })
      .from(guests)
      .leftJoin(guestCategories, eq(guests.categoryId, guestCategories.categoryId))
      .where(where)
      .orderBy(asc(guests.seq))
    return rows.map(g => ({
      ...toItem(g),
      blessing: g.blessing ?? null,
      flowerDrawing: g.flowerDrawing ?? null,
    }))
  }
  const { blessing: _blessing, flowerDrawing: _flowerDrawing, ...slimColumns } = getTableColumns(guests)
  const rows = await db.select({ ...slimColumns, ...categoryCols })
    .from(guests)
    .leftJoin(guestCategories, eq(guests.categoryId, guestCategories.categoryId))
    .where(where)
    .orderBy(asc(guests.seq))
  const items = rows.map(toItem)
  return isReception ? items.map(stripForReception) : items
})
