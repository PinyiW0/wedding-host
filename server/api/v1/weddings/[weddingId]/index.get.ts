import type { H3Event } from 'h3'
import type { WeddingDetail } from '../../../../../app/types/api/weddings'

import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler((event: H3Event): WeddingDetail => {
  const weddingId = getRouterParam(event, 'weddingId')
  const wedding = mockWeddings.find(w => w.weddingId === weddingId)
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  // 新人僅能存取自己擁有的婚禮
  assertWeddingAccess(getRequestUser(event), wedding.ownerId)
  return {
    weddingId: wedding.weddingId,
    title: wedding.title,
    venue: wedding.venue,
    address: wedding.address,
    date: wedding.date,
    groomName: wedding.groomName ?? null,
    brideName: wedding.brideName ?? null,
    mapLink: wedding.mapLink,
    parkingInfo: wedding.parkingInfo,
    transportInfo: wedding.transportInfo,
    transportImageUrls: wedding.transportImageUrls ?? [],
    ownerId: wedding.ownerId ?? null,
    deletedAt: wedding.deletedAt,
  }
})
