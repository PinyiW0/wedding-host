import type { H3Event } from 'h3'
import type { CakeBoxExtraOrderCreatedEvent, CreateCakeBoxExtraOrderBody } from '../../../../../../app/types/api/cakebox'

import { mockCakeBoxExtraOrders, mockCakeBoxTypes } from '../../../../../mock/data/cakebox'

// 新增一筆額外配發（公關／公司公餅）：款式 × 數量 × 備註
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxExtraOrderCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateCakeBoxExtraOrderBody>(event)

  if (!body?.cakeBoxTypeId || !mockCakeBoxTypes.some(t => t.weddingId === weddingId && t.cakeBoxTypeId === body.cakeBoxTypeId)) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }

  const quantity = Math.max(1, Math.floor(Number(body.quantity) || 0))
  const note = body.note?.trim() ? body.note.trim() : null
  const extraOrderId = `cakeextra-${crypto.randomUUID().slice(0, 8)}`

  mockCakeBoxExtraOrders.push({ extraOrderId, weddingId, cakeBoxTypeId: body.cakeBoxTypeId, quantity, note })

  setResponseStatus(event, 201)
  return { extraOrderId, cakeBoxTypeId: body.cakeBoxTypeId, quantity, note }
})
