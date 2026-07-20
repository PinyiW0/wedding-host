import type { H3Event } from 'h3'
import type { CakeBoxTypeUpdatedEvent, UpdateCakeBoxTypeBody } from '../../../../../../../app/types/api/cakebox'

import { and, eq, ne } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { cakeBoxTypes } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<CakeBoxTypeUpdatedEvent> => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateCakeBoxTypeBody>(event)

  const db = useDb()
  const [existing] = await db.select().from(cakeBoxTypes).where(and(eq(cakeBoxTypes.weddingId, weddingId), eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }

  // 價格欄驗證（issue #70 / M4）：防浮點／int4 溢位致 500、負值
  if (body.price !== undefined && body.price !== null)
    assertPositiveInt(body.price, '款式價格', 100_000_000)

  // 組合款驗證（issue #106）需在任何 mutation 之前（含下方取消其他預設的 update）
  let componentTypeIds: string[] | null | undefined
  if (body.componentTypeIds !== undefined) {
    componentTypeIds = await resolveComboComponents(db, weddingId, body.componentTypeIds, cakeBoxTypeId)
    // 已被其他組合引用的單款不可自己變組合（維持單層）
    if (componentTypeIds) {
      const refs = await findReferencingCombos(db, weddingId, cakeBoxTypeId)
      if (refs.length) {
        throw createError({ statusCode: 400, statusMessage: `此款式已是組合「${refs[0]}」的內含款，不可再設為組合` })
      }
    }
  }

  const patch: Partial<typeof cakeBoxTypes.$inferInsert> = {}
  if (componentTypeIds !== undefined)
    patch.componentTypeIds = componentTypeIds
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
    componentTypeIds: cakeBoxType!.componentTypeIds ?? null,
  }
})
