import type { H3Event } from 'h3'
import type { ReceptionAccountCreatedEvent, UpdateReceptionAccountBody } from '../../../../../../app/types/api/accounts'

import { and, eq, ne } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { receptionAccounts } from '../../../../../db/schema'

// 編輯接待帳號：改名／重設密碼（issue #23——打錯密碼不再只能砍掉重建）
export default defineEventHandler(async (event: H3Event): Promise<ReceptionAccountCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const accountId = getRouterParam(event, 'accountId')!
  const body = await readBody<UpdateReceptionAccountBody>(event)

  if (!body || (body.username === undefined && body.password === undefined)) {
    throw createError({ statusCode: 400, statusMessage: '未提供任何更新欄位' })
  }
  if (body.username !== undefined && !body.username) {
    throw createError({ statusCode: 400, statusMessage: '請輸入帳號名稱' })
  }
  if (body.password !== undefined && !body.password) {
    throw createError({ statusCode: 400, statusMessage: '請輸入新密碼' })
  }

  const db = useDb()
  const [target] = await db.select().from(receptionAccounts).where(and(eq(receptionAccounts.accountId, accountId), eq(receptionAccounts.weddingId, weddingId)))
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: '接待帳號不存在' })
  }

  if (body.username) {
    const [duplicate] = await db.select({ accountId: receptionAccounts.accountId }).from(receptionAccounts).where(and(
      eq(receptionAccounts.weddingId, weddingId),
      eq(receptionAccounts.username, body.username),
      ne(receptionAccounts.accountId, accountId),
    ))
    if (duplicate) {
      throw createError({ statusCode: 409, statusMessage: '帳號名稱已存在' })
    }
  }

  const [updated] = await db.update(receptionAccounts)
    .set({
      ...(body.username ? { username: body.username } : {}),
      ...(body.password ? { passwordHash: hashPassword(body.password) } : {}),
    })
    .where(eq(receptionAccounts.accountId, accountId))
    .returning()
  return { accountId, weddingId, username: updated!.username }
})
