import type { H3Event } from 'h3'
import type { CreateGiftItemBody, GiftItemCreatedEvent } from '../../../../../../app/types/api/gifts'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { giftCategories, giftItems } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GiftItemCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateGiftItemBody>(event)

  if (!body?.description) {
    throw createError({ statusCode: 400, statusMessage: '請輸入款式說明' })
  }
  if (!body.category) {
    throw createError({ statusCode: 400, statusMessage: '請選擇禮物類別' })
  }
  const db = useDb()
  // 類別需存在於本婚禮字典（issue #124 起可自訂）：DB 無 FK 約束，
  // 毒值品項不會落在任何類別區塊、金額也對不上，一律 400 擋在入口
  const [category] = await db.select({ categoryId: giftCategories.categoryId }).from(giftCategories).where(and(eq(giftCategories.weddingId, weddingId), eq(giftCategories.categoryId, body.category)))
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: '禮物類別不存在' })
  }

  const giftItemId = `giftitem-${crypto.randomUUID().slice(0, 8)}`
  const item: GiftItemCreatedEvent = {
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
  // 金額／數量欄落 integer（issue #70 / M4）：防浮點／int4 溢位致 500、負值污染採購試算
  assertPositiveInt(item.unitPrice, '單價', 100_000_000)
  assertPositiveInt(item.quantity, '數量', 1_000_000)
  assertPositiveInt(item.shippingFee1, '運費', 100_000_000)
  assertPositiveInt(item.shippingFee2, '運費', 100_000_000)
  assertPositiveInt(item.otherFee, '其他費用', 100_000_000)
  await db.insert(giftItems).values(item)

  setResponseStatus(event, 201)
  return item
})
