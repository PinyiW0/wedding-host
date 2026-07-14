import type { H3Event } from 'h3'
import type { ResendThankYouBody, ThankYouResentEvent } from '../../../../../../app/types/api/thankyou'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests, thankYouTemplates, weddings } from '../../../../../db/schema'

// 群發失敗後對單一賓客重發謝卡（issue #72）：內容與群發同一份範本訊息
export default defineEventHandler(async (event: H3Event): Promise<ThankYouResentEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ResendThankYouBody>(event)
  if (!body?.guestId) {
    throw createError({ statusCode: 400, statusMessage: '缺少賓客編號' })
  }

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // 租戶隔離：guestId 一律以 weddingId 限定查詢
  const [guest] = await db.select().from(guests).where(
    and(eq(guests.guestId, body.guestId), eq(guests.weddingId, weddingId), isNull(guests.deletedAt)),
  )
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (!guest.lineUserId) {
    throw createError({ statusCode: 409, statusMessage: '賓客未綁定 LINE' })
  }

  // 真發送：單人 push（1 則計 1 額度）；失敗回 502 讓前端保留在失敗清單可再重試
  if (isLinePushConfigured()) {
    const [template] = await db.select().from(thankYouTemplates).where(eq(thankYouTemplates.weddingId, weddingId))
    const sent = await pushLineMessage(guest.lineUserId, buildThankYouLineMessages(template))
    if (!sent) {
      throw createError({ statusCode: 502, statusMessage: '重發失敗，請稍後再試' })
    }
  }

  // mock（未設定 LINE token）：不真發送，直接回成功
  setResponseStatus(event, 201)
  return { weddingId, guestId: guest.guestId }
})
