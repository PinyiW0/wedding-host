import type { H3Event } from 'h3'
import type { UpdateWeddingBody, WeddingUpdatedEvent } from '../../../../../app/types/api/weddings'

import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<WeddingUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')
  const body = await readBody<UpdateWeddingBody>(event)

  const wedding = mockWeddings.find(w => w.weddingId === weddingId)
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  if (body.title !== undefined)
    wedding.title = body.title
  if (body.venue !== undefined)
    wedding.venue = body.venue
  if (body.address !== undefined)
    wedding.address = body.address
  if (body.date !== undefined)
    wedding.date = body.date
  if (body.mapLink !== undefined)
    wedding.mapLink = body.mapLink
  if (body.parkingInfo !== undefined)
    wedding.parkingInfo = body.parkingInfo
  if (body.transportInfo !== undefined)
    wedding.transportInfo = body.transportInfo

  return {
    weddingId: wedding.weddingId,
    title: wedding.title,
    venue: wedding.venue,
    address: wedding.address,
    date: wedding.date,
    mapLink: wedding.mapLink,
    parkingInfo: wedding.parkingInfo,
    transportInfo: wedding.transportInfo,
  }
})
