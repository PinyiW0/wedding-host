import type { H3Event } from 'h3'
import type { AdminRegisteredEvent, RegisterAdminBody } from '../../../../app/types/api/auth'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../db'
import { users } from '../../../db/schema'

// enforced 模式的公開註冊收斂（issue #23）：僅系統無任何管理員時開放（首次開通），
// 其後需管理員登入才能建立新管理員。open 模式（dev／e2e）維持公開，凍結 spec 依賴此行為。
async function assertAdminRegisterAllowed(event: H3Event): Promise<void> {
  if (useRuntimeConfig().authMode !== 'enforced')
    return
  const db = useDb()
  const [existingAdmin] = await db.select({ userId: users.userId }).from(users).where(and(eq(users.role, '管理者'), isNull(users.deletedAt))).limit(1)
  if (!existingAdmin)
    return
  // 路由分類為 public，中介層不解析 token，這裡自行驗證請求者身分
  const header = getHeader(event, 'authorization')
  const payload = header?.startsWith('Bearer ') ? await verifyAuthToken(header.slice(7)) : null
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: '請先登入' })
  }
  const [requester] = await db.select().from(users).where(and(eq(users.userId, payload.userId), isNull(users.deletedAt)))
  if (!requester || requester.role !== '管理者') {
    throw createError({ statusCode: 403, statusMessage: '只有管理者可以建立管理員帳號' })
  }
}

export default defineEventHandler(async (event: H3Event): Promise<AdminRegisteredEvent> => {
  const body = await readBody<RegisterAdminBody>(event)

  if (!body?.email || !body?.displayName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入電子郵件與顯示名稱' })
  }
  await assertAdminRegisterAllowed(event)

  const db = useDb()
  const [existing] = await db.select({ userId: users.userId }).from(users).where(and(eq(users.email, body.email), isNull(users.deletedAt)))
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: '此電子郵件已被註冊' })
  }

  const userId = `user-${crypto.randomUUID().slice(0, 8)}`
  await db.insert(users).values({
    userId,
    username: body.email,
    email: body.email,
    // 密碼選填（凍結 spec 僅送 email＋顯示名稱）：未設定則不可登入，可由管理端重設
    passwordHash: body.password ? hashPassword(body.password) : '',
    displayName: body.displayName,
    role: '管理者',
    weddingId: null,
    deletedAt: null,
  })

  setResponseStatus(event, 201)
  return { userId, email: body.email, displayName: body.displayName }
})
