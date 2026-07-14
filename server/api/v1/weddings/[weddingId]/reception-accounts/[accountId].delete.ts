import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { receptionAccounts } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event) => {
  const accountId = getRouterParam(event, 'accountId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  // 以 returning 判斷是否真的刪到資料，等價原本 findIndex + splice
  // weddingId 一併過濾（issue #70 / H3）：防跨婚禮刪除他人接待帳號
  const deleted = await db.delete(receptionAccounts)
    .where(and(eq(receptionAccounts.accountId, accountId), eq(receptionAccounts.weddingId, weddingId)))
    .returning()
  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: '接待帳號不存在' })
  }

  setResponseStatus(event, 204)
})
