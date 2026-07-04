import type { H3Event } from 'h3'
import type { CreateReceptionAccountBody, ReceptionAccountCreatedEvent } from '../../../../../../app/types/api/accounts'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { receptionAccounts } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ReceptionAccountCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateReceptionAccountBody>(event)

  if (!body?.username) {
    throw createError({ statusCode: 400, statusMessage: '請輸入帳號名稱' })
  }
  const db = useDb()
  const [duplicate] = await db.select().from(receptionAccounts).where(and(eq(receptionAccounts.weddingId, weddingId), eq(receptionAccounts.username, body.username)))
  if (duplicate) {
    throw createError({ statusCode: 409, statusMessage: '帳號名稱已存在' })
  }

  const accountId = `account-${crypto.randomUUID().slice(0, 8)}`
  // 密碼選填：有設定才能用此帳號登入接待端（相容既有「僅名單管理」的建立流程）
  await db.insert(receptionAccounts).values({
    accountId,
    weddingId,
    username: body.username,
    passwordHash: body.password ? hashPassword(body.password) : '',
  })

  setResponseStatus(event, 201)
  return { accountId, weddingId, username: body.username }
})
