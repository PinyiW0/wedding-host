import type { Db } from '../db'

import { guestCategories } from '../db/schema'

// 分類語意「初值」推斷（issue #94）：原 useSeatingMath 的 FAMILY／VIP 正則搬來這裡。
// 關鍵差異——正則只在「首次建立分類」時跑一次當預設值，之後以 guest_categories.tier /
// isMainTable 欄位為準；不再是每次渲染都拿名稱字串重新比對的執行期規則。
const FAMILY_CATEGORY_RE = /雙親|父母|家人|家屬|長輩|親戚/
const VIP_CATEGORY_RE = /主管|貴賓|vip|摯友|朋友/i
const MAIN_TABLE_NAMES = new Set(['新人', '雙親'])

export function inferCategoryDefaults(name: string): { tier: number, isMainTable: boolean } {
  const isMainTable = MAIN_TABLE_NAMES.has(name)
  if (name === '新人')
    return { tier: 0, isMainTable }
  if (FAMILY_CATEGORY_RE.test(name))
    return { tier: 1, isMainTable }
  if (VIP_CATEGORY_RE.test(name))
    return { tier: 2, isMainTable }
  return { tier: 3, isMainTable }
}

// find-or-create：單語句 upsert + RETURNING（neon-http 無 db.transaction()，不得 select-then-insert）。
// 必須 onConflictDoUpdate 而非 DoNothing——DO NOTHING 在衝突時 RETURNING 回 0 列，拿不到既有 id。
// set { name } 是刻意的 no-op（值不變），只為觸發 RETURNING，且不覆寫既有 tier / isMainTable
// （日後人工調過的語意不會被推斷值打回去）。空白名稱回 null：對齊 guests.categoryId nullable 的
// 「未分類」語意，不在字典造空列。名稱一律 trim 存入（(weddingId,name) unique 索引的意義所在）。
// 回傳含 tier：供「男方親屬預設不發放喜餅」判定（issue #105），以欄位為準而非名稱正則。
export async function resolveCategory(db: Db, weddingId: string, rawName: string | null | undefined): Promise<{ categoryId: string, tier: number } | null> {
  const name = (rawName ?? '').trim()
  if (!name)
    return null
  const [row] = await db.insert(guestCategories)
    .values({ categoryId: `gcat-${crypto.randomUUID().slice(0, 8)}`, weddingId, name, ...inferCategoryDefaults(name) })
    .onConflictDoUpdate({ target: [guestCategories.weddingId, guestCategories.name], set: { name } })
    .returning({ categoryId: guestCategories.categoryId, tier: guestCategories.tier })
  return row!
}

// 讀取端點共用的 join 欄位組：合約回名稱，tier / isMainTable 供座位排序（名稱與語意脫鉤）。
// 搭配 leftJoin(guestCategories, eq(guests.categoryId, guestCategories.categoryId)) 使用。
export const categoryCols = {
  categoryName: guestCategories.name,
  categoryTier: guestCategories.tier,
  categoryIsMainTable: guestCategories.isMainTable,
}
