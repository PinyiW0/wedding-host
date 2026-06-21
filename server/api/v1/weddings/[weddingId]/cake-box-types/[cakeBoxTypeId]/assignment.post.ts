import type { H3Event } from 'h3'
import type { CakeBoxAssignmentConfiguredEvent, ConfigureCakeBoxAssignmentBody } from '../../../../../../../app/types/api/cakebox'

import { mockCakeBoxAssignments, mockCakeBoxTypes } from '../../../../../../mock/data/cakebox'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxAssignmentConfiguredEvent> => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')!
  const body = await readBody<ConfigureCakeBoxAssignmentBody>(event)

  if (!mockCakeBoxTypes.some(c => c.cakeBoxTypeId === cakeBoxTypeId)) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }

  mockCakeBoxAssignments.push({ cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule })

  setResponseStatus(event, 201)
  return { cakeBoxTypeId, guestId: body.guestId, assignmentRule: body.assignmentRule }
})
