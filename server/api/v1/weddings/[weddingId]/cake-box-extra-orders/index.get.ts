import type { H3Event } from 'h3'
import type { CakeBoxExtraOrderListItem } from '../../../../../../app/types/api/cakebox'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxExtraOrders, cakeBoxTypes } from '../../../../../db/schema'

// 讀回該婚禮「額外配發（公關用）」清單，補上款式名稱供顯示
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxExtraOrderListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const typesOfWedding = await db.select().from(cakeBoxTypes).where(eq(cakeBoxTypes.weddingId, weddingId))
  const typeMap = new Map(typesOfWedding.map(t => [t.cakeBoxTypeId, t.name]))
  const rows = await db.select().from(cakeBoxExtraOrders).where(eq(cakeBoxExtraOrders.weddingId, weddingId)).orderBy(asc(cakeBoxExtraOrders.seq))
  return rows.map(o => ({
    extraOrderId: o.extraOrderId,
    cakeBoxTypeId: o.cakeBoxTypeId,
    cakeBoxTypeName: typeMap.get(o.cakeBoxTypeId) ?? '（已刪除款式）',
    quantity: o.quantity,
    recipientName: o.recipientName,
    recipientContact: o.recipientContact,
    note: o.note,
  }))
})
