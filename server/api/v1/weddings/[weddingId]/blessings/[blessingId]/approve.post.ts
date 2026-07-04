import type { H3Event } from 'h3'
import type { BlessingApprovedEvent } from '../../../../../../../app/types/api/blessings'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { blessings } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<BlessingApprovedEvent> => {
  const blessingId = getRouterParam(event, 'blessingId')!
  const db = useDb()
  const [blessing] = await db.select().from(blessings).where(eq(blessings.blessingId, blessingId))
  if (!blessing) {
    throw createError({ statusCode: 404, statusMessage: '祝福不存在' })
  }
  if (blessing.status !== 'submitted') {
    throw createError({ statusCode: 409, statusMessage: '祝福已審核' })
  }
  // 通過審核即進入「待上牆」，待管理員推到投影幕
  const [updated] = await db.update(blessings)
    .set({ status: 'approved', wallStatus: 'pending_wall' })
    .where(eq(blessings.blessingId, blessingId))
    .returning()

  setResponseStatus(event, 201)
  return { blessingId: updated!.blessingId, status: updated!.status }
})
