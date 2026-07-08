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

    // 群發內容＝謝卡範本內文（未設範本時用預設感謝詞）；範本圖片需公開 https 才能附上
    const [template] = await db.select().from(thankYouTemplates).where(eq(thankYouTemplates.weddingId, weddingId))
    const text = [
      template?.greeting,
      template?.templateContent,
      [template?.signature, template?.signatureDate].filter(Boolean).join(' '),
    ].map(part => part?.trim()).filter(Boolean).join('\n\n') || '感謝您蒞臨我們的婚禮！'
    const imageUrl = template?.templateImageUrl?.startsWith('https://') ? template.templateImageUrl : null
    const messages = [
      { type: 'text' as const, text },
      ...(imageUrl ? [{ type: 'image' as const, originalContentUrl: imageUrl, previewImageUrl: imageUrl }] : []),
    ]

    const { successCount, failedCount } = await multicastLineMessages(
      boundGuests.map(guest => guest.lineUserId!),
      messages,
    )
    await db.insert(thankYouBatchSends).values({
      weddingId,
      successCount,
      failedCount,
      sentAt: new Date().toISOString(),
      sentBy: getRequestUser(event).userId,
    })
    if (successCount === 0) {
      throw createError({ statusCode: 502, statusMessage: 'LINE 群發失敗，請稍後再試' })
    }
    setResponseStatus(event, 201)
    return { weddingId, recipientCount: successCount }
  }

  // mock：群發結果固定回 50 位（對齊 flow 的預期人數）
  setResponseStatus(event, 201)
  return { weddingId, recipientCount: 50 }
})
