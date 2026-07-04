import type { H3Event } from 'h3'
import type { GuestCategoryRenamedEvent, RenameGuestCategoryBody } from '../../../../../../app/types/api/guests'

import { mockGuestCategories } from '../../../../../mock/data/guest-categories'
import { mockGuests } from '../../../../../mock/data/guests'

// 分類改名：儲存清單 from→to，並連動該婚禮所有 category === from 的賓客（含軟刪）
export default defineEventHandler(async (event: H3Event): Promise<GuestCategoryRenamedEvent> => {
  const weddingId = String(getRouterParam(event, 'weddingId'))
  const body = await readBody<RenameGuestCategoryBody>(event)

  const from = body?.from?.trim() ?? ''
  const to = body?.to?.trim() ?? ''
  if (!to)
    throw createError({ statusCode: 400, statusMessage: '請輸入分類名稱' })

  const storedEntry = mockGuestCategories.find(c => c.weddingId === weddingId && c.name === from)
  const usedByGuest = mockGuests.some(g => g.weddingId === weddingId && g.category === from)
  if (!storedEntry && !usedByGuest)
    throw createError({ statusCode: 404, statusMessage: '分類不存在' })

  // 目標名稱已在清單 → 合併（移除 from 條目）；否則就地改名
  const toExists = mockGuestCategories.some(c => c.weddingId === weddingId && c.name === to)
  if (storedEntry) {
    if (toExists)
      mockGuestCategories.splice(mockGuestCategories.indexOf(storedEntry), 1)
    else
      storedEntry.name = to
  }

  let updatedGuests = 0
  for (const g of mockGuests) {
    if (g.weddingId === weddingId && g.category === from) {
      g.category = to
      updatedGuests++
    }
  }

  return { weddingId, from, to, updatedGuests }
})
