import type { H3Event } from 'h3'
import type { CreateGiftItemBody, GiftCategory, GiftItemCreatedEvent } from '../../../../../../app/types/api/gifts'

import { useDb } from '../../../../../db'
import { giftItems } from '../../../../../db/schema'

const GIFT_CATEGORIES: readonly GiftCategory[] = ['table', 'second_entrance', 'game', 'send_off', 'room_visit', 'tea_ceremony']

export default defineEventHandler(async (event: H3Event): Promise<GiftItemCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateGiftItemBody>(event)

  if (!body?.description) {
    throw createError({ statusCode: 400, statusMessage: '請輸入款式說明' })
  }
  if (!body.category) {
    throw createError({ statusCode: 400, statusMessage: '請選擇禮物類別' })
  }
  // 六類白名單：category 為 TS-only enum、DB 落 text 無 CHECK 約束，
  // 毒值會讓 gifts.vue 的 map[item.category].push 擲 TypeError 炸掉整頁，且只能改 DB 救回
  assertEnum(body.category, GIFT_CATEGORIES, '禮物類別')

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
  const db = useDb()
  await db.insert(giftItems).values(item)

  setResponseStatus(event, 201)
  return item
})
