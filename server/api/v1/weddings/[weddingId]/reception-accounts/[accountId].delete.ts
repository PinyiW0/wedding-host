import type { H3Event } from 'h3'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { receptionAccounts } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event) => {
  const accountId = getRouterParam(event, 'accountId')!
  const db = useDb()
  // 以 returning 判斷是否真的刪到資料，等價原本 findIndex + splice
  const deleted = await db.delete(receptionAccounts)
    .where(eq(receptionAccounts.accountId, accountId))
    .returning()
  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: '接待帳號不存在' })
  }

  setResponseStatus(event, 204)
})
