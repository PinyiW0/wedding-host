import type { H3Event } from 'h3'
import type { PublicThankYouCard } from '../../../../../../../app/types/api/thankyou'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests, thankYouCustomizations, thankYouTemplates, weddings } from '../../../../../../db/schema'

const GUEST_NAME_TOKEN_RE = /\{\{\s*guestName\s*\}\}/g

// 賓客公開謝卡（公開讀取）：解析範本 / 客製 → 帶入賓客名與婚禮資料
export default defineEventHandler(async (event: H3Event): Promise<PublicThankYouCard> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const guestId = getRouterParam(event, 'guestId')!

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(and(eq(weddings.weddingId, weddingId), isNull(weddings.deletedAt)))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  // weddingId 一併過濾（issue #70 / M2）：防跨婚禮枚舉並讀出他人賓客姓名
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  const [template] = await db.select().from(thankYouTemplates).where(eq(thankYouTemplates.weddingId, weddingId))
  const [customization] = await db.select().from(thankYouCustomizations).where(and(eq(thankYouCustomizations.weddingId, weddingId), eq(thankYouCustomizations.guestId, guestId)))

  const coupleName = wedding.groomName && wedding.brideName
    ? `${wedding.groomName} & ${wedding.brideName}`
    : wedding.title

  // 客製內容優先，否則用統一範本；{{guestName}} 一律以賓客名替換
  const rawContent = customization?.customContent ?? template?.templateContent ?? ''
  const content = rawContent.replace(GUEST_NAME_TOKEN_RE, guest.name)

  return {
    weddingId,
    guestId,
    guestName: guest.name,
    greeting: template?.greeting || 'With Gratitude',
    content,
    signature: template?.signature || coupleName,
    signatureDate: template?.signatureDate || wedding.date,
    templateImageUrl: template?.templateImageUrl ?? null,
  }
})
