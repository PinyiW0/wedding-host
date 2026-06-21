import type { H3Event } from 'h3'
import type { WeddingRestoredEvent } from '../../../../../app/types/api/weddings'

import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler((event: H3Event): WeddingRestoredEvent => {
  const weddingId = getRouterParam(event, 'weddingId')
  const wedding = mockWeddings.find(w => w.weddingId === weddingId)
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  if (!wedding.deletedAt) {
    throw createError({ statusCode: 409, statusMessage: '婚禮未被刪除' })
  }
  wedding.deletedAt = null

  return { weddingId: wedding.weddingId }
})
