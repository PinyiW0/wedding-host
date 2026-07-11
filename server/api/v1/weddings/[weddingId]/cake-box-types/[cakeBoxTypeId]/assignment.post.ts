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

  // 一位賓客只保留一筆指派（upsert）：先移除同賓客的舊指派，再寫入新的。
  // 使「依分類帶入」可重複套用而不產生重複，且符合「一位賓客一種喜餅」語意。
  await db.delete(cakeBoxAssignments).where(eq(cakeBoxAssignments.guestId, body.guestId))
  await db.insert(cakeBoxAssignments).values({ cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule })

  setResponseStatus(event, 201)
  return { cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule }
})
