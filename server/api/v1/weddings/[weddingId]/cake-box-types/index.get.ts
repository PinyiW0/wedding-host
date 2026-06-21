import type { H3Event } from 'h3'
import type { CakeBoxTypeListItem } from '../../../../../../app/types/api/cakebox'

import { mockCakeBoxTypes } from '../../../../../mock/data/cakebox'

export default defineEventHandler((event: H3Event): CakeBoxTypeListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockCakeBoxTypes.filter(c => c.weddingId === weddingId)
})
