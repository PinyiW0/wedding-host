import type { H3Event } from 'h3'
import type { BlessingProjectedEvent } from '../../../../../../../app/types/api/blessings'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { blessings } from '../../../../../../db/schema'

// 推到投影幕：將已通過審核的祝福標記為「已上牆」（避免重播）
export default defineEventHandler(async (event: H3Event): Promise<BlessingProjectedEvent> => {
  const blessingId = getRouterParam(event, 'blessingId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [blessing] = await db.select().from(blessings).where(and(eq(blessings.weddingId, weddingId), eq(blessings.blessingId, blessingId)))
  if (!blessing) {
    throw createError({ statusCode: 404, statusMessage: '祝福不存在' })
  }
  if (blessing.status !== 'approved') {
    throw createError({ statusCode: 409, statusMessage: '祝福尚未通過審核' })
  }
  await db.update(blessings)
    .set({ wallStatus: 'on_wall' })
    .where(eq(blessings.blessingId, blessingId))

  return { blessingId: blessing.blessingId, wallStatus: 'on_wall' }
})
