import type { H3Event } from 'h3'
import type { CoupleAccountEvent, CreateCoupleAccountBody } from '../../../../app/types/api/users'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../db'
import { users, weddings } from '../../../db/schema'

// 管理員代建新人帳密（issue #23 方案 a）：帳密私下交給新人，不做邀請連結流程
export default defineEventHandler(async (event: H3Event): Promise<CoupleAccountEvent> => {
  const body = await readBody<CreateCoupleAccountBody>(event)

  if (!body?.username || !body?.password || !body?.displayName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入帳號、密碼與顯示名稱' })
  }
  const db = useDb()
  const [duplicate] = await db.select({ userId: users.userId }).from(users).where(and(eq(users.username, body.username), isNull(users.deletedAt)))
  if (duplicate) {
    throw createError({ statusCode: 409, statusMessage: '帳號名稱已存在' })
  }

  // 綁定婚禮：先驗證存在與未被其他新人綁定，再寫入雙向關聯（users.weddingId + weddings.ownerId）
  if (body.weddingId) {
    await assertWeddingBindable(body.weddingId)
  }

  const userId = `user-${crypto.randomUUID().slice(0, 8)}`
  await db.insert(users).values({
    userId,
    username: body.username,
    email: '',
    passwordHash: hashPassword(body.password),
    displayName: body.displayName,
    role: '新人',
    weddingId: body.weddingId ?? null,
    deletedAt: null,
  })
  if (body.weddingId) {
    await db.update(weddings).set({ ownerId: userId }).where(eq(weddings.weddingId, body.weddingId))
  }

  setResponseStatus(event, 201)
  return { userId, username: body.username, displayName: body.displayName, weddingId: body.weddingId ?? null }
})
