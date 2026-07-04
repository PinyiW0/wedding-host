import type { H3Event } from 'h3'
import type { CakeBoxExclusionListItem } from '../../../../../../app/types/api/cakebox'

import { mockCakeBoxExclusions } from '../../../../../mock/data/cakebox'

// 讀回該婚禮「不發放」的賓客清單（重整後仍能還原）
export default defineEventHandler((event: H3Event): CakeBoxExclusionListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockCakeBoxExclusions
    .filter(e => e.weddingId === weddingId)
    .map(e => ({ guestId: e.guestId }))
})
