import type { H3Event } from 'h3'
import type { GuestCategoriesSavedEvent, SaveGuestCategoriesBody } from '../../../../../../app/types/api/guests'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guestCategories } from '../../../../../db/schema'

// 整份取代該婚禮的儲存清單（先刪全部再依傳入順序 insert，seq 自增保序）
export default defineEventHandler(async (event: H3Event): Promise<GuestCategoriesSavedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<SaveGuestCategoriesBody>(event)

  const cleaned = [...new Set((body?.categories ?? []).map(c => c.trim()).filter(Boolean))]

  const db = useDb()
  await db.delete(guestCategories).where(eq(guestCategories.weddingId, weddingId))
  if (cleaned.length)
    await db.insert(guestCategories).values(cleaned.map(name => ({ weddingId, name })))

  return { weddingId, categories: cleaned }
})
