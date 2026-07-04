import type { H3Event } from 'h3'
import type { GuestCategoriesSavedEvent, SaveGuestCategoriesBody } from '../../../../../../app/types/api/guests'

import { mockGuestCategories } from '../../../../../mock/data/guest-categories'

// 整份取代該婚禮的儲存清單（就地 splice+push，保持陣列參照供 mock reset）
export default defineEventHandler(async (event: H3Event): Promise<GuestCategoriesSavedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<SaveGuestCategoriesBody>(event)

  const cleaned = [...new Set((body?.categories ?? []).map(c => c.trim()).filter(Boolean))]

  for (let i = mockGuestCategories.length - 1; i >= 0; i--) {
    if (mockGuestCategories[i]!.weddingId === weddingId)
      mockGuestCategories.splice(i, 1)
  }
  for (const name of cleaned)
    mockGuestCategories.push({ weddingId, name })

  return { weddingId, categories: cleaned }
})
