import type { H3Event } from 'h3'
import type { CreateWeddingBody, WeddingCreatedEvent } from '../../../../app/types/api/weddings'

import { mockWeddings } from '../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<WeddingCreatedEvent> => {
  const body = await readBody<CreateWeddingBody>(event)

  if (!body?.title || !body?.venue || !body?.address || !body?.date) {
    throw createError({ statusCode: 400, statusMessage: '請完整填寫婚禮名稱、場地、地址與日期' })
  }

  const weddingId = `wedding-${crypto.randomUUID().slice(0, 8)}`
  mockWeddings.unshift({
    weddingId,
    title: body.title,
    venue: body.venue,
    address: body.address,
    date: body.date,
    mapLink: null,
    parkingInfo: null,
    transportInfo: null,
    deletedAt: null,
  })

  setResponseStatus(event, 201)
  return { weddingId, title: body.title, venue: body.venue, address: body.address, date: body.date }
})
