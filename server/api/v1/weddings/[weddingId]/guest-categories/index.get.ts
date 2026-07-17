import type { H3Event } from 'h3'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories } from '../../../../../db/schema'

// 回傳該婚禮的分類字典（維持 seq 順序）。
// 改造前需 union「在用分類」是因為寫入端不回寫字典；改用 categoryId 後寫入端一律 find-or-create
// ⇒ in-use 必然已 stored，union 為純冗餘（且原本為此掃全表賓客含 base64，改造後只掃小表）（issue #94）。
export default defineEventHandler(async (event: H3Event): Promise<string[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const rows = await useDb()
    .select({ name: guestCategories.name })
    .from(guestCategories)
    .where(eq(guestCategories.weddingId, weddingId))
    .orderBy(asc(guestCategories.seq))
  return rows.map(r => r.name)
})
