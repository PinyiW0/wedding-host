import type { H3Event } from 'h3'
import type { CakeBoxGuestExcludedEvent, ExcludeGuestCakeBoxBody } from '../../../../../../app/types/api/cakebox'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxAssignments, cakeBoxExclusions, guests } from '../../../../../db/schema'

// 將某賓客標記為「不發放」（新人本人等不需喜餅者）；一位賓客一筆，避免重複
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxGuestExcludedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ExcludeGuestCakeBoxBody>(event)

  if (!body?.guestId) {
    throw createError({ statusCode: 400, statusMessage: '請指定賓客' })
  }

  const db = useDb()
  // guestId 需屬於本婚禮：對齊 assignment.post.ts / thank-you-card/customizations.post.ts 的
  // 既有把關（原本此端點直接 insert，可寫入他人婚禮 guestId 的排除列）
  const [guest] = await db.select({ guestId: guests.guestId }).from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, body.guestId)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  // (weddingId, guestId) unique + onConflictDoNothing：冪等寫入取代 check-then-insert，
  // 併發重複由 DB 兜底、不產生多筆（issue #71）
  await db.insert(cakeBoxExclusions).values({ weddingId, guestId: body.guestId }).onConflictDoNothing()

  // 不發放與指派互斥（issue #138）：舊指派留著會讓接待端仍讀到指定款、顯示可發放的打勾。
  // 順序不可顛倒——neon-http 無 transaction，先刪指派若排除寫入失敗，賓客會退化成「未指定款式」
  await db.delete(cakeBoxAssignments).where(eq(cakeBoxAssignments.guestId, body.guestId))

  setResponseStatus(event, 201)
  return { guestId: body.guestId }
})
