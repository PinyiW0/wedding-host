import type { Db } from '../db'

import { giftCategories } from '../db/schema'

// 婚禮小物預設類別（issue #124）：categoryId 沿用語意 slug（與既有 gift_items.category 存值相容）。
// 單一真源：建立婚禮 seed、mock seed 與 migration 0010 回填皆為同一組值
export const DEFAULT_GIFT_CATEGORIES = [
  { categoryId: 'table', name: '桌上禮' },
  { categoryId: 'second_entrance', name: '二進禮' },
  { categoryId: 'game', name: '遊戲禮' },
  { categoryId: 'send_off', name: '送客禮' },
  { categoryId: 'room_visit', name: '探房禮' },
  { categoryId: 'tea_ceremony', name: '喝茶禮' },
] as const

export async function seedDefaultGiftCategories(db: Db, weddingId: string): Promise<void> {
  await db.insert(giftCategories).values(
    DEFAULT_GIFT_CATEGORIES.map((c, i) => ({ weddingId, categoryId: c.categoryId, name: c.name, sortOrder: i + 1 })),
  )
}
