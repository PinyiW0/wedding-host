import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { cakeBoxAssignments, cakeBoxExtraOrders, cakeBoxTypes, guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event) => {
  const cakeBoxTypeId = getRouterParam(event, 'cakeBoxTypeId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [existing] = await db.select().from(cakeBoxTypes).where(and(eq(cakeBoxTypes.weddingId, weddingId), eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '喜餅款式不存在' })
  }
  // 組合引用守門（issue #106）：被組合內含的單款不可刪，先於組合款解除引用
  const referencingCombos = await findReferencingCombos(db, weddingId, cakeBoxTypeId)
  if (referencingCombos.length) {
    throw createError({ statusCode: 409, statusMessage: `此款式為組合「${referencingCombos[0]}」的內含款，請先解除引用` })
  }
  // 既成事實不可因刪款式而湮滅：已發放（賓客已領餅）與額外配發（已下訂的數量）一律擋下。
  // 指派（cake_box_assignments）則屬「預定發哪款」的計畫，款式沒了即無意義 → 隨款式一併清除
  // （凍結 spec 06-cakebox「成功移除喜餅款式」刪的 cakeboxtype-001 在 seed 即帶指派且須成功）。
  // 兩道守門都必須在任何 mutation 之前：neon-http 無 transaction，先寫後檢查沒得回頭。
  const [distributed] = await db.select({ guestId: guests.guestId }).from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.cakeBoxDistributedTypeId, cakeBoxTypeId)))
  if (distributed) {
    throw createError({ statusCode: 409, statusMessage: '已有賓客領取此款式，無法移除' })
  }
  const [extraOrder] = await db.select({ extraOrderId: cakeBoxExtraOrders.extraOrderId }).from(cakeBoxExtraOrders).where(and(eq(cakeBoxExtraOrders.weddingId, weddingId), eq(cakeBoxExtraOrders.cakeBoxTypeId, cakeBoxTypeId)))
  if (extraOrder) {
    throw createError({ statusCode: 409, statusMessage: '此款式仍有額外配發，無法移除' })
  }

  // 先清指派再刪款式，順序不可顛倒：cake_box_assignments 無 weddingId 欄位，租戶歸屬全靠
  // cakeBoxTypeId 反查（見 assignments.get.ts）。款式先沒了，這些列會永久失去婚禮歸屬、
  // 任何查詢都撈不到也無從清理。反過來最壞只是款式還在但指派被清空，使用者可重設。
  await db.delete(cakeBoxAssignments).where(eq(cakeBoxAssignments.cakeBoxTypeId, cakeBoxTypeId))
  await db.delete(cakeBoxTypes).where(eq(cakeBoxTypes.cakeBoxTypeId, cakeBoxTypeId))

  setResponseStatus(event, 204)
})
