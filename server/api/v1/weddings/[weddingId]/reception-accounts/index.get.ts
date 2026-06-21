import type { H3Event } from 'h3'
import type { ReceptionAccountListItem } from '../../../../../../app/types/api/accounts'

import { mockReceptionAccounts } from '../../../../../mock/data/accounts'

export default defineEventHandler((event: H3Event): ReceptionAccountListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockReceptionAccounts.filter(a => a.weddingId === weddingId)
})
