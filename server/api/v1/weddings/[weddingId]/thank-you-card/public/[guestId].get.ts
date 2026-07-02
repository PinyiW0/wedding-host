import type { H3Event } from 'h3'
import type { PublicThankYouCard } from '../../../../../../../app/types/api/thankyou'

import { mockGuests } from '../../../../../../mock/data/guests'
import { mockThankYouCustomizations, mockThankYouTemplates } from '../../../../../../mock/data/thankyou'
import { mockWeddings } from '../../../../../../mock/data/weddings'

const GUEST_NAME_TOKEN_RE = /\{\{\s*guestName\s*\}\}/g

// 賓客公開謝卡（公開讀取）：解析範本 / 客製 → 帶入賓客名與婚禮資料
export default defineEventHandler((event: H3Event): PublicThankYouCard => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const guestId = getRouterParam(event, 'guestId')!

  const wedding = mockWeddings.find(w => w.weddingId === weddingId && !w.deletedAt)
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  const template = mockThankYouTemplates.find(t => t.weddingId === weddingId)
  const customization = mockThankYouCustomizations.find(
    c => c.weddingId === weddingId && c.guestId === guestId,
  )

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
