import type { H3Event } from 'h3'
import type { AdminRegisteredEvent, RegisterAdminBody } from '../../../../app/types/api/auth'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../db'
import { users } from '../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<AdminRegisteredEvent> => {
  const body = await readBody<RegisterAdminBody>(event)

  if (!body?.email || !body?.displayName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入電子郵件與顯示名稱' })
  }
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
    passwordHash: '',
    displayName: body.displayName,
    role: '管理者',
    weddingId: null,
    deletedAt: null,
  })

  setResponseStatus(event, 201)
  return { userId, email: body.email, displayName: body.displayName }
})
