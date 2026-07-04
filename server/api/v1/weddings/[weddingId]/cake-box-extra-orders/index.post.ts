import type { H3Event } from 'h3'
import type { CakeBoxExtraOrderCreatedEvent, CreateCakeBoxExtraOrderBody } from '../../../../../../app/types/api/cakebox'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxExtraOrders, cakeBoxTypes } from '../../../../../db/schema'

// 新增一筆額外配發（公關／公司公餅）：款式 × 數量 × 具名收餅對象（姓名／聯絡，選填）× 備註
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxExtraOrderCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateCakeBoxExtraOrderBody>(event)

  if (!body?.cakeBoxTypeId) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }
  const db = useDb()
  const [existingType] = await db.select().from(cakeBoxTypes).where(and(eq(cakeBoxTypes.weddingId, weddingId), eq(cakeBoxTypes.cakeBoxTypeId, body.cakeBoxTypeId)))
  if (!existingType) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }

  const quantity = Math.max(1, Math.floor(Number(body.quantity) || 0))
  const recipientName = body.recipientName?.trim() ? body.recipientName.trim() : null
  const recipientContact = body.recipientContact?.trim() ? body.recipientContact.trim() : null
  const note = body.note?.trim() ? body.note.trim() : null
  const extraOrderId = `cakeextra-${crypto.randomUUID().slice(0, 8)}`

  await db.insert(cakeBoxExtraOrders).values({ extraOrderId, weddingId, cakeBoxTypeId: body.cakeBoxTypeId, quantity, recipientName, recipientContact, note })

  setResponseStatus(event, 201)
  return { extraOrderId, cakeBoxTypeId: body.cakeBoxTypeId, quantity, recipientName, recipientContact, note }
})
