import type { H3Event } from 'h3'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../db'
import { users } from '../../../db/schema'

// 停用帳號（軟刪除）：login 以 deletedAt 過濾，停用後即無法登入
// business guards（issue #23）：不得停用最後一個管理者（409）優先於不可停用自己（403），
// 否則「唯一管理者停用自己」會被 403 攔走，409 保護永遠不可達
export default defineEventHandler(async (event: H3Event) => {
  const userId = getRouterParam(event, 'userId')!
  const db = useDb()

  const [target] = await db.select().from(users).where(and(eq(users.userId, userId), isNull(users.deletedAt)))
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: '帳號不存在' })
  }

  if (target.role === '管理者') {
    const admins = await db.select({ userId: users.userId }).from(users).where(and(eq(users.role, '管理者'), isNull(users.deletedAt)))
    if (admins.length <= 1) {
      throw createError({ statusCode: 409, statusMessage: '不得停用最後一個管理者' })
    }
    if (getRequestUser(event).userId === userId) {
      throw createError({ statusCode: 403, statusMessage: '不可停用自己的帳號' })
    }
  }

  await db.update(users).set({ deletedAt: new Date().toISOString() }).where(eq(users.userId, userId))
  setResponseStatus(event, 204)
})
