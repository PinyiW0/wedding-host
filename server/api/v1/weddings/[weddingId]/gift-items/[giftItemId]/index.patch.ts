import type { H3Event } from 'h3'
import type { GiftItemUpdatedEvent, UpdateGiftItemBody } from '../../../../../../../app/types/api/gifts'

import { mockGiftItems } from '../../../../../../mock/data/gifts'

export default defineEventHandler(async (event: H3Event): Promise<GiftItemUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const giftItemId = getRouterParam(event, 'giftItemId')!
  const body = await readBody<UpdateGiftItemBody>(event)

  const item = mockGiftItems.find(g => g.weddingId === weddingId && g.giftItemId === giftItemId)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: '禮物品項不存在' })
  }

  if (body.category !== undefined)
    item.category = body.category
  if (body.description !== undefined)
    item.description = body.description
  if (body.imageUrl !== undefined)
    item.imageUrl = body.imageUrl
  if (body.unitPrice !== undefined)
    item.unitPrice = body.unitPrice
  if (body.quantity !== undefined)
    item.quantity = body.quantity
  if (body.purchaseUrl !== undefined)
    item.purchaseUrl = body.purchaseUrl
  if (body.distributionTime !== undefined)
    item.distributionTime = body.distributionTime
  if (body.shippingFee1 !== undefined)
    item.shippingFee1 = body.shippingFee1
  if (body.shippingFee2 !== undefined)
    item.shippingFee2 = body.shippingFee2
  if (body.otherFee !== undefined)
    item.otherFee = body.otherFee
  if (body.note !== undefined)
    item.note = body.note

  return item
})
