import type { H3Event } from 'h3'
import type { UpdateWeddingBody, WeddingUpdatedEvent } from '../../../../../app/types/api/weddings'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<WeddingUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateWeddingBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  // 新人僅能編輯自己擁有的婚禮
  assertWeddingAccess(getRequestUser(event), existing.ownerId)

  const patch: Partial<typeof weddings.$inferInsert> = {}
  if (body.title !== undefined)
    patch.title = body.title
  if (body.venue !== undefined)
    patch.venue = body.venue
  if (body.address !== undefined)
    patch.address = body.address
  if (body.date !== undefined)
    patch.date = body.date
  if (body.groomName !== undefined)
    patch.groomName = body.groomName
  if (body.brideName !== undefined)
    patch.brideName = body.brideName
  if (body.mapLink !== undefined)
    patch.mapLink = body.mapLink
  if (body.parkingInfo !== undefined)
    patch.parkingInfo = body.parkingInfo
  if (body.transportInfo !== undefined)
    patch.transportInfo = body.transportInfo
  if (body.transportImageUrls !== undefined)
    patch.transportImageUrls = body.transportImageUrls

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [wedding] = Object.keys(patch).length
    ? await db.update(weddings).set(patch).where(eq(weddings.weddingId, weddingId)).returning()
    : [existing]

  return {
    weddingId: wedding!.weddingId,
    title: wedding!.title,
    venue: wedding!.venue,
    address: wedding!.address,
    date: wedding!.date,
    groomName: wedding!.groomName ?? null,
    brideName: wedding!.brideName ?? null,
    mapLink: wedding!.mapLink,
    parkingInfo: wedding!.parkingInfo,
    transportInfo: wedding!.transportInfo,
    transportImageUrls: wedding!.transportImageUrls ?? [],
  }
})
