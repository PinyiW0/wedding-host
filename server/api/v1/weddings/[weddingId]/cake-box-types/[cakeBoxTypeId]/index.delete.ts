import type { H3Event } from 'h3'

import { mockCakeBoxTypes } from '../../../../../../mock/data/cakebox'

export default defineEventHandler((event: H3Event) => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')
  const index = mockCakeBoxTypes.findIndex(c => c.cakeBoxTypeId === cakeBoxTypeId)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }
  mockCakeBoxTypes.splice(index, 1)

  setResponseStatus(event, 204)
})
