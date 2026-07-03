import type { H3Event } from 'h3'
import type { CreateGiftItemBody, GiftItemCreatedEvent } from '../../../../../../app/types/api/gifts'

import { mockGiftItems } from '../../../../../mock/data/gifts'

export default defineEventHandler(async (event: H3Event): Promise<GiftItemCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateGiftItemBody>(event)

  if (!body?.description) {
    throw createError({ statusCode: 400, statusMessage: '請輸入款式說明' })
  }
  if (!body.category) {
    throw createError({ statusCode: 400, statusMessage: '請選擇禮物類別' })
  }

  const giftItemId = `giftitem-${crypto.randomUUID().slice(0, 8)}`
  const item = {
    giftItemId,
    weddingId,
    category: body.category,
    description: body.description,
    imageUrl: body.imageUrl ?? null,
    unitPrice: body.unitPrice ?? 0,
    quantity: body.quantity ?? 0,
    purchaseUrl: body.purchaseUrl ?? null,
    distributionTime: body.distributionTime ?? null,
    shippingFee1: body.shippingFee1 ?? 0,
    shippingFee2: body.shippingFee2 ?? 0,
    otherFee: body.otherFee ?? 0,
    note: body.note ?? null,
  }
  mockGiftItems.push(item)

  setResponseStatus(event, 201)
  return item
})
