import type { H3Event } from 'h3'
import type { CakeBoxExclusionListItem } from '../../../../../../app/types/api/cakebox'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxExclusions } from '../../../../../db/schema'

// 讀回該婚禮「不發放」的賓客清單（重整後仍能還原）
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxExclusionListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(cakeBoxExclusions).where(eq(cakeBoxExclusions.weddingId, weddingId)).orderBy(asc(cakeBoxExclusions.seq))
  return rows.map(e => ({ guestId: e.guestId }))
})
