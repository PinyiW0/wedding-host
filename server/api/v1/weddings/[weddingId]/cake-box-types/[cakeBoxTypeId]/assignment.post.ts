import type { H3Event } from 'h3'
import type { CakeBoxAssignmentConfiguredEvent, ConfigureCakeBoxAssignmentBody } from '../../../../../../../app/types/api/cakebox'

import { mockCakeBoxAssignments, mockCakeBoxTypes } from '../../../../../../mock/data/cakebox'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxAssignmentConfiguredEvent> => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')!
  const body = await readBody<ConfigureCakeBoxAssignmentBody>(event)

  if (!mockCakeBoxTypes.some(c => c.cakeBoxTypeId === cakeBoxTypeId)) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }

  // 一位賓客只保留一筆指派（upsert）：先移除同賓客的舊指派，再寫入新的。
  // 使「依分類帶入」可重複套用而不產生重複，且符合「一位賓客一種喜餅」語意。
  const existingIdx = mockCakeBoxAssignments.findIndex(a => a.guestId === body.guestId)
  if (existingIdx !== -1)
    mockCakeBoxAssignments.splice(existingIdx, 1)
  mockCakeBoxAssignments.push({ cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule })

  setResponseStatus(event, 201)
  return { cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule }
})
