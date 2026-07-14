import type { H3Event } from 'h3'
import type { ThankYouBatchSentEvent } from '../../../../../../app/types/api/thankyou'

import { and, asc, eq, isNull, ne } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests, thankYouBatchSends, thankYouTemplates, weddings } from '../../../../../db/schema'

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

  // 真發送：multicast 同一訊息給全部已綁定賓客（個人化連結由 fallback 複製連結補位）
  if (isLinePushConfigured()) {
    // 額度預檢：查得到剩餘額度且不足時擋下；查不到（無上限方案/查詢失敗）放行，由 LINE 端把關
    const remaining = await getLineQuotaRemaining()
    if (remaining !== null && boundGuests.length > remaining) {
      throw createError({
        statusCode: 409,
        statusMessage: `LINE 推播額度不足：本月剩餘 ${remaining} 則，群發需 ${boundGuests.length} 則`,
      })
    }

    const [template] = await db.select().from(thankYouTemplates).where(eq(thankYouTemplates.weddingId, weddingId))
    const { successCount, failedCount, failedUserIds } = await multicastLineMessages(
      boundGuests.map(guest => guest.lineUserId!),
      buildThankYouLineMessages(template),
    )
    await db.insert(thankYouBatchSends).values({
      weddingId,
      successCount,
      failedCount,
      sentAt: new Date().toISOString(),
      sentBy: getRequestUser(event).userId,
    })
    // 失敗不再擋回應：把失敗賓客清單交給前端顯示並提供單獨重發（issue #72）
    const failedSet = new Set(failedUserIds)
    const failedGuests = boundGuests
      .filter(guest => failedSet.has(guest.lineUserId!))
      .map(guest => ({ guestId: guest.guestId, name: guest.name }))
    setResponseStatus(event, 201)
    return { weddingId, recipientCount: successCount, failedGuests }
  }

  // mock：群發結果固定回 50 位（對齊 flow 的預期人數），不真發送、無失敗名單
  setResponseStatus(event, 201)
  return { weddingId, recipientCount: 50, failedGuests: [] }
})
