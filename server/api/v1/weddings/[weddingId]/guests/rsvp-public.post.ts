import type { H3Event } from 'h3'
import type { PublicRsvpSubmittedEvent, SubmitPublicRsvpBody } from '../../../../../../app/types/api/pending-guests'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { guests, weddings } from '../../../../../db/schema'

// 公開自助 RSVP：不需登入，建立 status='pending_review' 的待確認賓客（不進正式名單）
export default defineEventHandler(async (event: H3Event): Promise<PublicRsvpSubmittedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SubmitPublicRsvpBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const guestId = `guest-${crypto.randomUUID().slice(0, 8)}`
  await db.insert(guests).values({
    guestId,
    weddingId,
    name: body.guestName || '未具名賓客',
    side: body.relationship ?? 'groom',
    diet: body.diet,
    category: body.relationCategory || '其他',
    contact: body.phone || '',
    childChairCount: body.childChairCount,
    notes: null,
    lineUserId: null,
    rsvpAttending: body.attending,
    checkedInAt: null,
    giftAmount: null,
    cakeBoxDistributedTypeId: null,
    partySize: 1 + body.plusOneCount + body.childChairCount,
    tableName: null,
    deletedAt: null,
    invitationPreference: body.invitation ?? null,
    mailingAddress: body.mailingAddress ?? null,
    blessing: body.blessing ?? null,
    flowerDrawing: body.flowerDrawing ?? null,
    needsShuttle: body.needsShuttle ?? null,
    shuttleCount: body.shuttleCount ?? null,
    customAnswers: body.customAnswers ?? null,
    status: 'pending_review',
    source: 'rsvp',
    invitationSent: false,
  })

  setResponseStatus(event, 201)
  return { guestId, weddingId, status: 'pending_review' }
})
