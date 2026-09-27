import { eq, sql } from 'drizzle-orm'
import { useDb } from '../../../../../db'
import { giftCategories } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<{ categoryIds?: unknown }>(event)
  const ids = body?.categoryIds
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length)
    throw createError({ statusCode: 400, statusMessage: '類別排序格式不正確' })
  const db = useDb()
  const rows = await db.select({ id: giftCategories.categoryId }).from(giftCategories).where(eq(giftCategories.weddingId, weddingId))
  const allowed = new Set(rows.map(row => row.id))
  if (ids.length !== rows.length || ids.some(id => !allowed.has(id)))
    throw createError({ statusCode: 409, statusMessage: '類別清單已變更，請重新載入後排序' })
  if (ids.length) {
    // 單一 UPDATE，避免逐筆儲存途中失敗而留下半套順序；相容 Neon HTTP。
    const cases = ids.map((id, index) => sql`when ${giftCategories.categoryId} = ${id} then ${index}::integer`)
    await db.update(giftCategories).set({
      sortOrder: sql`case ${sql.join(cases, sql` `)} else ${giftCategories.sortOrder} end`,
    }).where(eq(giftCategories.weddingId, weddingId))
  }
  return { categoryIds: ids }
})
