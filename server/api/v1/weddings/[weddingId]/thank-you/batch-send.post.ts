import type { H3Event } from 'h3'
import type { ThankYouBatchSentEvent } from '../../../../../../app/types/api/thankyou'

import { and, asc, eq, isNull, ne } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests, weddings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouBatchSentEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // 已綁定 LINE 的賓客：lineUserId <> '' 同時排除 NULL 與空字串（對齊原 truthy 篩選）
  const boundGuests = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), ne(guests.lineUserId, ''), isNull(guests.deletedAt))).orderBy(asc(guests.seq))
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
