import type { H3Event } from 'h3'
import type { BlessingRejectedEvent, RejectBlessingBody } from '../../../../../../../app/types/api/blessings'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { blessings } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<BlessingRejectedEvent> => {
  const blessingId = getRouterParam(event, 'blessingId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<RejectBlessingBody>(event)

  const db = useDb()
  const [blessing] = await db.select().from(blessings).where(and(eq(blessings.weddingId, weddingId), eq(blessings.blessingId, blessingId)))
  if (!blessing) {
    throw createError({ statusCode: 404, statusMessage: '祝福不存在' })
  }
  if (blessing.status !== 'submitted') {
    throw createError({ statusCode: 409, statusMessage: '祝福已審核' })
  }
  const [updated] = await db.update(blessings)
    .set({ status: 'rejected', rejectReason: body?.reason ?? null })
    .where(eq(blessings.blessingId, blessingId))
    .returning()

  setResponseStatus(event, 201)
  return { blessingId: updated!.blessingId, status: updated!.status, reason: body?.reason ?? '' }
})
