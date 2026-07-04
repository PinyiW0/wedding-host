import type { H3Event } from 'h3'
import type { CakeBoxAssignmentListItem } from '../../../../../../app/types/api/cakebox'

import { asc, eq, inArray } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxAssignments, cakeBoxTypes } from '../../../../../db/schema'

// 讀回該婚禮已設定的喜餅指派規則清單（重整後仍能還原顯示）
// 指派只存 cakeBoxTypeId，故透過該婚禮的款式過濾並補上款式名稱供顯示
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxAssignmentListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const typesOfWedding = await db.select().from(cakeBoxTypes).where(eq(cakeBoxTypes.weddingId, weddingId))
  const typeMap = new Map(typesOfWedding.map(t => [t.cakeBoxTypeId, t.name]))
  // 該婚禮沒有任何款式時直接回空（避免 inArray 空陣列）
  if (typeMap.size === 0)
    return []
  const rows = await db.select().from(cakeBoxAssignments).where(inArray(cakeBoxAssignments.cakeBoxTypeId, [...typeMap.keys()])).orderBy(asc(cakeBoxAssignments.seq))
  return rows.map(a => ({
    cakeBoxTypeId: a.cakeBoxTypeId,
    cakeBoxTypeName: typeMap.get(a.cakeBoxTypeId)!,
    guestId: a.guestId,
    assignmentRule: a.assignmentRule,
  }))
})
