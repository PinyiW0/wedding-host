import type { H3Event } from 'h3'
import type { ThankYouBatchSentEvent } from '../../../../../../app/types/api/thankyou'

import { mockGuests } from '../../../../../mock/data/guests'
import { mockWeddings } from '../../../../../mock/data/weddings'

export default defineEventHandler((event: H3Event): ThankYouBatchSentEvent => {
  const weddingId = getRouterParam(event, 'weddingId')!

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const boundGuests = mockGuests.filter(g => g.weddingId === weddingId && g.lineUserId && !g.deletedAt)
  if (boundGuests.length === 0) {
    throw createError({ statusCode: 409, statusMessage: '沒有已綁定 LINE 的賓客' })
  }

  // mock：群發結果固定回 50 位（對齊 flow 的預期人數）
  setResponseStatus(event, 201)
  return { weddingId, recipientCount: 50 }
})
