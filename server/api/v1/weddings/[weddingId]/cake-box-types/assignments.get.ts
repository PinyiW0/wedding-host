import type { H3Event } from 'h3'
import type { CakeBoxAssignmentListItem } from '../../../../../../app/types/api/cakebox'

import { mockCakeBoxAssignments, mockCakeBoxTypes } from '../../../../../mock/data/cakebox'

// 讀回該婚禮已設定的喜餅指派規則清單（重整後仍能還原顯示）
// 指派只存 cakeBoxTypeId，故透過該婚禮的款式過濾並補上款式名稱供顯示
export default defineEventHandler((event: H3Event): CakeBoxAssignmentListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  const typesOfWedding = mockCakeBoxTypes.filter(t => t.weddingId === weddingId)
  const typeMap = new Map(typesOfWedding.map(t => [t.cakeBoxTypeId, t.name]))
  return mockCakeBoxAssignments
    .filter(a => typeMap.has(a.cakeBoxTypeId))
    .map(a => ({
      cakeBoxTypeId: a.cakeBoxTypeId,
      cakeBoxTypeName: typeMap.get(a.cakeBoxTypeId)!,
      guestId: a.guestId,
      assignmentRule: a.assignmentRule,
    }))
})
