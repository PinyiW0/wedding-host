import type { H3Event } from 'h3'
import type { CakeBoxDistributionCancelledEvent } from '../../../../../../../app/types/api/reception'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

// 取消喜餅發放：後台由新人／管理者操作（接待員 DELETE 不在白名單 → 403，見 server/utils/route-auth.ts）。
// 把已發放款式清回 null，reception-status 隨即回報未發放、接待台「已發放」標記消失。
export default defineEventHandler(async (event: H3Event): Promise<CakeBoxDistributionCancelledEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (!guest.cakeBoxDistributedTypeId) {
    throw createError({ statusCode: 409, statusMessage: '尚未發放喜餅' })
  }
  await db.update(guests).set({ cakeBoxDistributedTypeId: null }).where(eq(guests.guestId, guest.guestId))

  return { guestId: guest.guestId }
})
