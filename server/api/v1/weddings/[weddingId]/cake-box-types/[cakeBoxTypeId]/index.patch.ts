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
  if (body.imageUrl !== undefined)
    cakeBoxType.imageUrl = body.imageUrl
  if (body.price !== undefined)
    cakeBoxType.price = body.price
  // 切換預設款：設為預設時取消同婚禮其他款式的預設（維持單一預設）
  if (body.isDefault !== undefined) {
    cakeBoxType.isDefault = body.isDefault
    if (body.isDefault) {
      for (const c of mockCakeBoxTypes) {
        if (c.weddingId === cakeBoxType.weddingId && c.cakeBoxTypeId !== cakeBoxType.cakeBoxTypeId)
          c.isDefault = false
      }
    }
  }

  return {
    cakeBoxTypeId: cakeBoxType.cakeBoxTypeId,
    name: cakeBoxType.name,
    description: cakeBoxType.description,
    isDefault: cakeBoxType.isDefault,
    imageUrl: cakeBoxType.imageUrl,
    price: cakeBoxType.price,
  }
})
