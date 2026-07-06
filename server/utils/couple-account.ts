import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../db'
import { users, weddings } from '../db/schema'

// 婚禮可綁定檢查：需存在、且未被其他有效新人帳號綁定（exceptUserId＝重綁自己時放行）
// 注意：管理員建立的婚禮 ownerId 是管理員自己，不算占用——僅「有效的新人」擁有者才擋 409
export async function assertWeddingBindable(weddingId: string, exceptUserId?: string): Promise<void> {
  const db = useDb()
  const [wedding] = await db.select({ ownerId: weddings.ownerId }).from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  if (wedding.ownerId && wedding.ownerId !== exceptUserId) {
    const [owner] = await db.select({ userId: users.userId }).from(users).where(and(eq(users.userId, wedding.ownerId), eq(users.role, '新人'), isNull(users.deletedAt)))
    if (owner) {
      throw createError({ statusCode: 409, statusMessage: '此婚禮已綁定其他新人帳號' })
    }
  }
}
