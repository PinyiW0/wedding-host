import type { Db } from '../db'

import { and, eq, inArray } from 'drizzle-orm'

import { cakeBoxExclusions, guestCategories } from '../db/schema'

// 男方親屬（side=groom × 分類家屬層 tier=1）預設不發放喜餅（issue #105）：
// 台灣婚俗喜餅發給女方親友。只在「進入／離開男方親屬」判定轉換時動排除列，
// 無關編輯不重套預設，喜餅頁的手動覆寫（改回款式／設不發放）不會被打掉。
export function isGroomRelative(side: string | null | undefined, categoryTier: number | null | undefined): boolean {
  return side === 'groom' && categoryTier === 1
}

export async function getCategoryTier(db: Db, categoryId: string | null | undefined): Promise<number | null> {
  if (!categoryId)
    return null
  const [row] = await db.select({ tier: guestCategories.tier }).from(guestCategories).where(eq(guestCategories.categoryId, categoryId))
  return row?.tier ?? null
}

export async function syncGroomRelativeNoBoxBulk(db: Db, weddingId: string, entering: string[], leaving: string[]): Promise<void> {
  if (entering.length)
    await db.insert(cakeBoxExclusions).values(entering.map(guestId => ({ weddingId, guestId }))).onConflictDoNothing()
  if (leaving.length)
    await db.delete(cakeBoxExclusions).where(and(eq(cakeBoxExclusions.weddingId, weddingId), inArray(cakeBoxExclusions.guestId, leaving)))
}

export async function syncGroomRelativeNoBox(db: Db, weddingId: string, guestId: string, was: boolean, now: boolean): Promise<void> {
  if (was === now)
    return
  await syncGroomRelativeNoBoxBulk(db, weddingId, now ? [guestId] : [], now ? [] : [guestId])
}
