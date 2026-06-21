import type { H3Event } from 'h3'
import type { CakeBoxTypeUpdatedEvent, UpdateCakeBoxTypeBody } from '../../../../../../../app/types/api/cakebox'

import { mockCakeBoxTypes } from '../../../../../../mock/data/cakebox'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxTypeUpdatedEvent> => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')
  const body = await readBody<UpdateCakeBoxTypeBody>(event)

  const cakeBoxType = mockCakeBoxTypes.find(c => c.cakeBoxTypeId === cakeBoxTypeId)
  if (!cakeBoxType) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }

  if (body.name !== undefined)
    cakeBoxType.name = body.name
  if (body.description !== undefined)
    cakeBoxType.description = body.description

  return { cakeBoxTypeId: cakeBoxType.cakeBoxTypeId, name: cakeBoxType.name, description: cakeBoxType.description }
})
