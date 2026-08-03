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
  // 價格落 integer 欄（issue #70 / M4）：防浮點／int4 溢位致 500、負值
  if (price !== null)
    assertPositiveInt(price, '款式價格', 100_000_000)

  const db = useDb()
  // 組合款驗證（issue #106）需在任何 mutation 之前：neon-http 無 transaction，先寫後檢查沒得回頭
  const componentTypeIds = await resolveComboComponents(db, weddingId, body.componentTypeIds)

  // 單一預設不變式：設為預設時，先取消同婚禮其他款式的預設
  if (body.isDefault) {
    await db.update(cakeBoxTypes).set({ isDefault: false }).where(eq(cakeBoxTypes.weddingId, weddingId))
  }

  // 未帶＝接待台可選（issue #138）：既有呼叫端與匯入流程不必為此欄改動
  const visibleToReception = body.visibleToReception ?? true

  await db.insert(cakeBoxTypes).values({ cakeBoxTypeId, weddingId, name: body.name, description, isDefault: body.isDefault, imageUrl, price, componentTypeIds, visibleToReception })

  setResponseStatus(event, 201)
  return { cakeBoxTypeId, weddingId, name: body.name, description, isDefault: body.isDefault, imageUrl, price, componentTypeIds, visibleToReception }
})
