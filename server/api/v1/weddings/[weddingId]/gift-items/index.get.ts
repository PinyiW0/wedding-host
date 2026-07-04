import type { H3Event } from 'h3'
import type { GiftItemListItem } from '../../../../../../app/types/api/gifts'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { giftItems } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GiftItemListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(giftItems).where(eq(giftItems.weddingId, weddingId)).orderBy(asc(giftItems.seq))
  return rows.map(g => ({
    giftItemId: g.giftItemId,
    weddingId: g.weddingId,
    category: g.category,
    description: g.description,
    imageUrl: g.imageUrl,
    unitPrice: g.unitPrice,
    quantity: g.quantity,
    purchaseUrl: g.purchaseUrl,
    distributionTime: g.distributionTime,
    shippingFee1: g.shippingFee1,
    shippingFee2: g.shippingFee2,
    otherFee: g.otherFee,
    note: g.note,
  }))
})
