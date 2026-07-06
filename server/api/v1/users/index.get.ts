import type { CoupleAccountListItem } from '../../../../app/types/api/users'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../db'
import { users } from '../../../db/schema'

// 列出新人帳號（含已停用，UI 以 deletedAt 呈現狀態）；管理者限定由中介層把關
export default defineEventHandler(async (): Promise<CoupleAccountListItem[]> => {
  const db = useDb()
  const rows = await db.select().from(users).where(eq(users.role, '新人')).orderBy(asc(users.seq))
  // 明確映射欄位，避免 passwordHash 外洩
  return rows.map(u => ({
    userId: u.userId,
    username: u.username,
    displayName: u.displayName,
    weddingId: u.weddingId ?? null,
    deletedAt: u.deletedAt ?? null,
  }))
})
