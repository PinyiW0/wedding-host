import type { H3Event } from 'h3'
import type { CakeBoxDistributedEvent, DistributeCakeBoxBody } from '../../../../../../../app/types/api/reception'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { cakeBoxTypes, guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxDistributedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<DistributeCakeBoxBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.cakeBoxDistributedTypeId) {
    throw createError({ statusCode: 409, statusMessage: '喜餅已發放' })
  }
  const cakeBoxTypeId = body?.cakeBoxTypeId ?? 'cakeboxtype-001'
  // cakeBoxTypeId 需屬於本婚禮（issue #70 / L2）：防指向跨婚禮或幽靈款式
  if (body?.cakeBoxTypeId) {
    const [type] = await db.select({ id: cakeBoxTypes.cakeBoxTypeId }).from(cakeBoxTypes).where(and(eq(cakeBoxTypes.weddingId, weddingId), eq(cakeBoxTypes.cakeBoxTypeId, body.cakeBoxTypeId)))
    if (!type) {
      throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
    }
  }
  await db.update(guests).set({ cakeBoxDistributedTypeId: cakeBoxTypeId }).where(eq(guests.guestId, guest.guestId))

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, cakeBoxTypeId }
})
