import type { H3Event } from 'h3'
import type { ReceptionAccountListItem } from '../../../../../../app/types/api/accounts'

import { mockReceptionAccounts } from '../../../../../mock/data/accounts'

export default defineEventHandler((event: H3Event): ReceptionAccountListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  // 明確映射欄位，避免 passwordHash 外洩
  return mockReceptionAccounts
    .filter(a => a.weddingId === weddingId)
    .map(a => ({ accountId: a.accountId, weddingId: a.weddingId, username: a.username }))
})
