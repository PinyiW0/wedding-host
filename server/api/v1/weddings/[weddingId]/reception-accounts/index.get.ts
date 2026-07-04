import type { H3Event } from 'h3'
import type { ReceptionAccountListItem } from '../../../../../../app/types/api/accounts'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { receptionAccounts } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ReceptionAccountListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(receptionAccounts).where(eq(receptionAccounts.weddingId, weddingId)).orderBy(asc(receptionAccounts.seq))
  // 明確映射欄位，避免 passwordHash 外洩
  return rows.map(a => ({ accountId: a.accountId, weddingId: a.weddingId, username: a.username }))
})
