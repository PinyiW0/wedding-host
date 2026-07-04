import type { H3Event } from 'h3'
import type { CakeBoxTypeCreatedEvent, CreateCakeBoxTypeBody } from '../../../../../../app/types/api/cakebox'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { cakeBoxTypes } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxTypeCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateCakeBoxTypeBody>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入款式名稱' })
  }

  const cakeBoxTypeId = `cakeboxtype-${crypto.randomUUID().slice(0, 8)}`
  const description = body.description ?? null
  const imageUrl = body.imageUrl ?? null
  const price = body.price ?? null

  const db = useDb()
  // 單一預設不變式：設為預設時，先取消同婚禮其他款式的預設
  if (body.isDefault) {
    await db.update(cakeBoxTypes).set({ isDefault: false }).where(eq(cakeBoxTypes.weddingId, weddingId))
  }

  await db.insert(cakeBoxTypes).values({ cakeBoxTypeId, weddingId, name: body.name, description, isDefault: body.isDefault, imageUrl, price })

  setResponseStatus(event, 201)
  return { cakeBoxTypeId, weddingId, name: body.name, description, isDefault: body.isDefault, imageUrl, price }
})
