import type { Db } from '../db'

import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'

import { cakeBoxExclusions, guestCategories, guests } from '../db/schema'

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
  if (leaving.length) {
    // 離開男方親屬分類，不應解除不出席者的不發放設定。
    const eligible = db.select({ guestId: guests.guestId }).from(guests).where(and(
      eq(guests.weddingId, weddingId),
      inArray(guests.guestId, leaving),
      or(isNull(guests.rsvpAttending), ne(guests.rsvpAttending, 'declined')),
    ))
    await db.delete(cakeBoxExclusions).where(and(eq(cakeBoxExclusions.weddingId, weddingId), inArray(cakeBoxExclusions.guestId, eligible)))
  }
}

export async function syncGroomRelativeNoBox(db: Db, weddingId: string, guestId: string, was: boolean, now: boolean): Promise<void> {
  if (was === now)
    return
  await syncGroomRelativeNoBoxBulk(db, weddingId, now ? [guestId] : [], now ? [] : [guestId])
}

// 進入「不出席」時套用預設；重送相同狀態保留新人在喜餅頁的手動選擇。
// 之後改為出席也不自動解除不發放，避免覆蓋人工決定或男方親屬規則。
export async function defaultDeclinedNoBox(db: Db, weddingId: string, guestId: string, previous: string | null, attending: string | null): Promise<void> {
  if (attending === 'declined' && previous !== 'declined')
    await db.insert(cakeBoxExclusions).values({ weddingId, guestId }).onConflictDoNothing()
}
