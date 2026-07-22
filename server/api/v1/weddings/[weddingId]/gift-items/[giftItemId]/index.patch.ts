import type { H3Event } from 'h3'
import type { GiftItemUpdatedEvent, UpdateGiftItemBody } from '../../../../../../../app/types/api/gifts'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { giftCategories, giftItems } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GiftItemUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const giftItemId = getRouterParam(event, 'giftItemId')!
  const body = await readBody<UpdateGiftItemBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(giftItems).where(and(eq(giftItems.weddingId, weddingId), eq(giftItems.giftItemId, giftItemId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '禮物品項不存在' })
  }

  // 類別需存在於本婚禮字典（issue #124 起可自訂）：DB 無 FK 約束，毒值一律 400 擋在入口
  if (body.category !== undefined) {
    const [category] = await db.select({ categoryId: giftCategories.categoryId }).from(giftCategories).where(and(eq(giftCategories.weddingId, weddingId), eq(giftCategories.categoryId, body.category)))
    if (!category) {
      throw createError({ statusCode: 400, statusMessage: '禮物類別不存在' })
    }
  }
  // 金額／數量欄驗證（issue #70 / M4）：防浮點／int4 溢位致 500、負值污染採購試算
  if (body.unitPrice !== undefined)
    assertPositiveInt(body.unitPrice, '單價', 100_000_000)
  if (body.quantity !== undefined)
    assertPositiveInt(body.quantity, '數量', 1_000_000)
  if (body.shippingFee1 !== undefined)
    assertPositiveInt(body.shippingFee1, '運費', 100_000_000)
  if (body.shippingFee2 !== undefined)
    assertPositiveInt(body.shippingFee2, '運費', 100_000_000)
  if (body.otherFee !== undefined)
    assertPositiveInt(body.otherFee, '其他費用', 100_000_000)

  const patch: Partial<typeof giftItems.$inferInsert> = {}
  if (body.category !== undefined)
    patch.category = body.category
  if (body.description !== undefined)
    patch.description = body.description
  if (body.imageUrl !== undefined)
    patch.imageUrl = body.imageUrl
  if (body.unitPrice !== undefined)
    patch.unitPrice = body.unitPrice
  if (body.quantity !== undefined)
    patch.quantity = body.quantity
  if (body.purchaseUrl !== undefined)
    patch.purchaseUrl = body.purchaseUrl
  if (body.distributionTime !== undefined)
    patch.distributionTime = body.distributionTime
  if (body.shippingFee1 !== undefined)
    patch.shippingFee1 = body.shippingFee1
  if (body.shippingFee2 !== undefined)
    patch.shippingFee2 = body.shippingFee2
  if (body.otherFee !== undefined)
    patch.otherFee = body.otherFee
  if (body.note !== undefined)
    patch.note = body.note

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [item] = Object.keys(patch).length
    ? await db.update(giftItems).set(patch).where(and(eq(giftItems.weddingId, weddingId), eq(giftItems.giftItemId, giftItemId))).returning()
    : [existing]

  return {
    giftItemId: item!.giftItemId,
    weddingId: item!.weddingId,
    category: item!.category,
    description: item!.description,
    imageUrl: item!.imageUrl,
    unitPrice: item!.unitPrice,
    quantity: item!.quantity,
    purchaseUrl: item!.purchaseUrl,
    distributionTime: item!.distributionTime,
    shippingFee1: item!.shippingFee1,
    shippingFee2: item!.shippingFee2,
    otherFee: item!.otherFee,
    note: item!.note,
  }
})
