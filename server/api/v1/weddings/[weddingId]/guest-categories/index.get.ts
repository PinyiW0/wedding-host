import type { H3Event } from 'h3'

import { mockGuestCategories } from '../../../../../mock/data/guest-categories'
import { mockGuests } from '../../../../../mock/data/guests'

// 回傳「儲存清單（維持順序）∪ 未刪除賓客在用分類（補尾）」
export default defineEventHandler((event: H3Event): string[] => {
  const weddingId = getRouterParam(event, 'weddingId')

  const stored = mockGuestCategories
    .filter(c => c.weddingId === weddingId)
    .map(c => c.name)

  const seen = new Set(stored)
  const inUse: string[] = []
  for (const g of mockGuests) {
    if (g.weddingId !== weddingId || g.deletedAt)
      continue
    const name = g.category.trim()
    if (!name || seen.has(name))
      continue
    seen.add(name)
    inUse.push(name)
  }

  return [...stored, ...inUse]
})
