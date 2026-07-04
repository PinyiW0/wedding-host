import type { H3Event } from 'h3'
import type { ThankYouBatchSentEvent } from '../../../../../../app/types/api/thankyou'

import { mockGuests } from '../../../../../mock/data/guests'
import { mockWeddings } from '../../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouBatchSentEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const boundGuests = mockGuests.filter(g => g.weddingId === weddingId && g.lineUserId && !g.deletedAt)
  if (boundGuests.length === 0) {
    throw createError({ statusCode: 409, statusMessage: '沒有已綁定 LINE 的賓客' })
  }

  // M4 基礎建設：已設定 channel token 時逐位發送個人化謝卡簽名連結
  if (isLinePushConfigured()) {
    const origin = getRequestURL(event).origin
    let recipientCount = 0
    for (const guest of boundGuests) {
      const url = `${origin}/thankyou/${weddingId}/${guest.guestId}?sig=${signGuestLink(weddingId, guest.guestId)}`
      if (await pushLineMessage(guest.lineUserId!, `感謝您蒞臨我們的婚禮！這是您的專屬謝卡：${url}`))
        recipientCount++
    }
    setResponseStatus(event, 201)
    return { weddingId, recipientCount }
  }

  // mock：群發結果固定回 50 位（對齊 flow 的預期人數）
  setResponseStatus(event, 201)
  return { weddingId, recipientCount: 50 }
})
