import type { Db } from '../db'

import { and, eq, inArray, ne } from 'drizzle-orm'

import { cakeBoxTypes } from '../db/schema'

// 組合款（issue #106）：驗證內含單款——需屬本婚禮、非組合款（維持單層）、不可含自己。
// 去重後回傳；空清單回 null（視為一般單款，也是「解除組合」的寫法）。
export async function resolveComboComponents(db: Db, weddingId: string, raw: unknown, selfId?: string): Promise<string[] | null> {
  const ids = Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0))] : []
  if (!ids.length)
    return null
  if (selfId && ids.includes(selfId)) {
    throw createError({ statusCode: 400, statusMessage: '組合款不可內含自己' })
  }
  const rows = await db
    .select({ cakeBoxTypeId: cakeBoxTypes.cakeBoxTypeId, componentTypeIds: cakeBoxTypes.componentTypeIds })
    .from(cakeBoxTypes)
    .where(and(eq(cakeBoxTypes.weddingId, weddingId), inArray(cakeBoxTypes.cakeBoxTypeId, ids)))
  if (rows.length !== ids.length) {
    throw createError({ statusCode: 404, statusMessage: '內含款式不存在' })
  }
  if (rows.some(r => (r.componentTypeIds ?? []).length > 0)) {
    throw createError({ statusCode: 400, statusMessage: '組合款不可再內含組合款' })
  }
  // 只含一款的「組合」＝把單款換個名字：訂購總覽會把份數拆算到內含單款、
  // 該組合本身永遠訂不到，是會靜默出錯的建模誤用（issue #140）。
  // 放在存在性／巢狀檢查之後，讓「內含款不存在」仍回 404 而非被這條攔胡
  if (ids.length === 1) {
    throw createError({ statusCode: 400, statusMessage: '組合款至少需內含兩款；只發一盒請建成單款' })
  }
  return ids
}

// 找出引用指定單款的組合款名稱（刪除守門、單款升組合守門共用）
export async function findReferencingCombos(db: Db, weddingId: string, cakeBoxTypeId: string): Promise<string[]> {
  const rows = await db
    .select({ name: cakeBoxTypes.name, componentTypeIds: cakeBoxTypes.componentTypeIds })
    .from(cakeBoxTypes)
    .where(and(eq(cakeBoxTypes.weddingId, weddingId), ne(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId)))
  return rows.filter(r => (r.componentTypeIds ?? []).includes(cakeBoxTypeId)).map(r => r.name)
}
