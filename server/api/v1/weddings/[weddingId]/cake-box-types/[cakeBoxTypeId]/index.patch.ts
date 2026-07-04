import type { H3Event } from 'h3'
import type { CakeBoxTypeUpdatedEvent, UpdateCakeBoxTypeBody } from '../../../../../../../app/types/api/cakebox'

import { and, eq, ne } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { cakeBoxTypes } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxTypeUpdatedEvent> => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')!
  const body = await readBody<UpdateCakeBoxTypeBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(cakeBoxTypes).where(eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }

  const patch: Partial<typeof cakeBoxTypes.$inferInsert> = {}
  if (body.name !== undefined)
    patch.name = body.name
  if (body.description !== undefined)
    patch.description = body.description
  if (body.imageUrl !== undefined)
    patch.imageUrl = body.imageUrl
  if (body.price !== undefined)
    patch.price = body.price
  // 切換預設款：設為預設時取消同婚禮其他款式的預設（維持單一預設）
  if (body.isDefault !== undefined) {
    patch.isDefault = body.isDefault
    if (body.isDefault) {
      await db.update(cakeBoxTypes).set({ isDefault: false }).where(and(eq(cakeBoxTypes.weddingId, existing.weddingId), ne(cakeBoxTypes.cakeBoxTypeId, existing.cakeBoxTypeId)))
    }
  }

  // 空 patch 時不打 update（drizzle set({}) 會擲錯），直接回現值
  const [cakeBoxType] = Object.keys(patch).length
    ? await db.update(cakeBoxTypes).set(patch).where(eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId)).returning()
    : [existing]

  return {
    cakeBoxTypeId: cakeBoxType!.cakeBoxTypeId,
    name: cakeBoxType!.name,
    description: cakeBoxType!.description,
    isDefault: cakeBoxType!.isDefault,
    imageUrl: cakeBoxType!.imageUrl,
    price: cakeBoxType!.price,
  }
})
