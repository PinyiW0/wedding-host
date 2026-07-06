import type { H3Event } from 'h3'
import type { CoupleAccountEvent, UpdateCoupleAccountBody } from '../../../../app/types/api/users'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../db'
import { users, weddings } from '../../../db/schema'

// 更新新人帳號：重設密碼（scrypt，不回顯）／顯示名稱／婚禮綁定（null＝解除）
export default defineEventHandler(async (event: H3Event): Promise<CoupleAccountEvent> => {
  const userId = getRouterParam(event, 'userId')!
  const body = await readBody<UpdateCoupleAccountBody>(event)

  if (!body || (body.password === undefined && body.displayName === undefined && body.weddingId === undefined)) {
    throw createError({ statusCode: 400, statusMessage: '未提供任何更新欄位' })
  }
  if (body.password !== undefined && !body.password) {
    throw createError({ statusCode: 400, statusMessage: '請輸入新密碼' })
  }

  const db = useDb()
  const [target] = await db.select().from(users).where(and(eq(users.userId, userId), isNull(users.deletedAt)))
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: '帳號不存在' })
  }

  const patch: Partial<typeof users.$inferInsert> = {}
  if (body.password) {
    patch.passwordHash = hashPassword(body.password)
  }
  if (body.displayName !== undefined) {
    patch.displayName = body.displayName
  }
  // 婚禮綁定變更：維持雙向關聯一致（users.weddingId + weddings.ownerId）
  if (body.weddingId !== undefined && body.weddingId !== target.weddingId) {
    if (body.weddingId) {
      await assertWeddingBindable(body.weddingId, userId)
    }
    await db.update(weddings).set({ ownerId: null }).where(eq(weddings.ownerId, userId))
    if (body.weddingId) {
      await db.update(weddings).set({ ownerId: userId }).where(eq(weddings.weddingId, body.weddingId))
    }
    patch.weddingId = body.weddingId
  }

  const updated = Object.keys(patch).length
    ? (await db.update(users).set(patch).where(eq(users.userId, userId)).returning())[0]!
    : target
  return {
    userId: updated.userId,
    username: updated.username,
    displayName: updated.displayName,
    weddingId: updated.weddingId ?? null,
  }
})
