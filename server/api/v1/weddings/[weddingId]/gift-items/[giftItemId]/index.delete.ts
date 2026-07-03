import type { H3Event } from 'h3'

import { mockGiftItems } from '../../../../../../mock/data/gifts'

export default defineEventHandler((event: H3Event): void => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const giftItemId = getRouterParam(event, 'giftItemId')!

  const index = mockGiftItems.findIndex(g => g.weddingId === weddingId && g.giftItemId === giftItemId)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: '禮物品項不存在' })
  }

  mockGiftItems.splice(index, 1)
  setResponseStatus(event, 204)
})
