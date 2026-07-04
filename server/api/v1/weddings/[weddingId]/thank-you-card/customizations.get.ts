import type { H3Event } from 'h3'
import type { ThankYouCustomizationListItem } from '../../../../../../app/types/api/thankyou'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { thankYouCustomizations } from '../../../../../db/schema'

// 讀回該婚禮的個別客製謝卡清單（重整後仍能還原顯示）
export default defineEventHandler(async (event: H3Event): Promise<ThankYouCustomizationListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(thankYouCustomizations).where(eq(thankYouCustomizations.weddingId, weddingId)).orderBy(asc(thankYouCustomizations.seq))
  return rows.map(c => ({
    weddingId: c.weddingId,
    guestId: c.guestId,
    customContent: c.customContent,
  }))
})
