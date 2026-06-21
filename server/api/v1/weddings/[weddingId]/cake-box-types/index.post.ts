import type { H3Event } from 'h3'
import type { CakeBoxTypeCreatedEvent, CreateCakeBoxTypeBody } from '../../../../../../app/types/api/cakebox'

import { mockCakeBoxTypes } from '../../../../../mock/data/cakebox'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxTypeCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateCakeBoxTypeBody>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入款式名稱' })
  }

  const cakeBoxTypeId = `cakeboxtype-${crypto.randomUUID().slice(0, 8)}`
  const description = body.description ?? null
  mockCakeBoxTypes.push({ cakeBoxTypeId, weddingId, name: body.name, description, isDefault: body.isDefault })

  setResponseStatus(event, 201)
  return { cakeBoxTypeId, weddingId, name: body.name, description, isDefault: body.isDefault }
})
