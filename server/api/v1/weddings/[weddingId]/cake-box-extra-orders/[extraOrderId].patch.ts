import type { H3Event } from 'h3'
import type { CakeBoxExtraOrderUpdatedEvent, UpdateCakeBoxExtraOrderBody } from '../../../../../../app/types/api/cakebox'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxExtraOrders, cakeBoxTypes } from '../../../../../db/schema'

// 編輯一筆額外配發（issue #108）：可改款式／數量／姓名／聯絡／備註
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxExtraOrderUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const extraOrderId = getRouterParam(event, 'extraOrderId')!
  const body = await readBody<UpdateCakeBoxExtraOrderBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(cakeBoxExtraOrders).where(and(eq(cakeBoxExtraOrders.weddingId, weddingId), eq(cakeBoxExtraOrders.extraOrderId, extraOrderId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '額外配發不存在' })
  }

  const patch: Partial<typeof cakeBoxExtraOrders.$inferInsert> = {}
  if (body.cakeBoxTypeId !== undefined) {
    // 款式需屬本婚禮（對齊 index.post.ts 的租戶把關）
    const [type] = await db.select({ cakeBoxTypeId: cakeBoxTypes.cakeBoxTypeId }).from(cakeBoxTypes).where(and(eq(cakeBoxTypes.weddingId, weddingId), eq(cakeBoxTypes.cakeBoxTypeId, body.cakeBoxTypeId)))
    if (!type) {
      throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
    }
    patch.cakeBoxTypeId = body.cakeBoxTypeId
  }
  if (body.quantity !== undefined)
    patch.quantity = Math.max(1, Math.floor(Number(body.quantity) || 0))
  if (body.recipientName !== undefined)
    patch.recipientName = body.recipientName?.trim() ? body.recipientName.trim() : null
  if (body.recipientContact !== undefined)
    patch.recipientContact = body.recipientContact?.trim() ? body.recipientContact.trim() : null
  if (body.note !== undefined)
    patch.note = body.note?.trim() ? body.note.trim() : null

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [row] = Object.keys(patch).length
    ? await db.update(cakeBoxExtraOrders).set(patch).where(eq(cakeBoxExtraOrders.extraOrderId, extraOrderId)).returning()
    : [existing]

  return {
    extraOrderId: row!.extraOrderId,
    cakeBoxTypeId: row!.cakeBoxTypeId,
    quantity: row!.quantity,
    recipientName: row!.recipientName,
    recipientContact: row!.recipientContact,
    note: row!.note,
  }
})
