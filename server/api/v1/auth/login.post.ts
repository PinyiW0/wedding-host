import type { H3Event } from 'h3'
import type { LoginBody, UserLoggedInEvent } from '../../../../app/types/api/auth'

import { and, eq, isNull, ne } from 'drizzle-orm'

import { useDb } from '../../../db'
import { receptionAccounts, users } from '../../../db/schema'

// 防帳號枚舉：查無帳號與密碼錯誤的回應必須完全一致（同 401、同訊息），
// 且查無帳號時仍執行一次同成本的 scrypt 驗證，抹平可被量測的回應時間差
const dummyHash = hashPassword(crypto.randomUUID())

export default defineEventHandler(async (event: H3Event): Promise<UserLoggedInEvent> => {
  const body = await readBody<LoginBody>(event)

  if (!body?.username || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: '請輸入帳號與密碼' })
  }

  const db = useDb()
  const [user] = await db.select().from(users).where(and(eq(users.username, body.username), isNull(users.deletedAt)))
  if (user) {
    if (!verifyPassword(body.password, user.passwordHash)) {
      throw createError({ statusCode: 401, statusMessage: '帳號或密碼錯誤' })
    }
    setResponseStatus(event, 201)
    return {
      userId: user.userId,
      username: user.username,
      role: user.role,
      weddingId: user.weddingId,
      accessToken: await signAuthToken({ userId: user.userId, role: user.role, weddingId: user.weddingId }),
    }
  }

  // 接待帳號（新人建立、已設密碼者）：登入後取得限定該婚禮的接待員身分
  const [account] = await db.select().from(receptionAccounts).where(and(eq(receptionAccounts.username, body.username), ne(receptionAccounts.passwordHash, '')))
  if (!account) {
    verifyPassword(body.password, dummyHash)
    throw createError({ statusCode: 401, statusMessage: '帳號或密碼錯誤' })
  }
  if (!verifyPassword(body.password, account.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: '帳號或密碼錯誤' })
  }

  setResponseStatus(event, 201)
  return {
    userId: account.accountId,
    username: account.username,
    role: '接待員',
    weddingId: account.weddingId,
    accessToken: await signAuthToken({ userId: account.accountId, role: '接待員', weddingId: account.weddingId }),
  }
})
