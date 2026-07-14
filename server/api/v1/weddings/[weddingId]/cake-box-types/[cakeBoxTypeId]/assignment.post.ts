import type { H3Event } from 'h3'
import type { CakeBoxAssignmentConfiguredEvent, ConfigureCakeBoxAssignmentBody } from '../../../../../../../app/types/api/cakebox'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { cakeBoxAssignments, cakeBoxTypes, guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxAssignmentConfiguredEvent> => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ConfigureCakeBoxAssignmentBody>(event)

  const db = useDb()
  const [existingType] = await db.select().from(cakeBoxTypes).where(and(eq(cakeBoxTypes.weddingId, weddingId), eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId)))
  if (!existingType) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, body.guestId)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  // 一位賓客只保留一筆指派：改用單語句 upsert（guestId unique）取代 delete+insert 非原子替換，
  // 中途失敗不會讓賓客沒有指派，併發重複也由 DB 唯一約束兜底（issue #71）
  await db.insert(cakeBoxAssignments)
    .values({ cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule })
    .onConflictDoUpdate({ target: cakeBoxAssignments.guestId, set: { cakeBoxTypeId, assignmentRule: body.assignmentRule } })

  setResponseStatus(event, 201)
  return { cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule }
})
