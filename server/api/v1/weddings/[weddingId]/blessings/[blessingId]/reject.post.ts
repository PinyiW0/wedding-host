import type { H3Event } from 'h3'
import type { BlessingRejectedEvent, RejectBlessingBody } from '../../../../../../../app/types/api/blessings'

import { mockBlessings } from '../../../../../../mock/data/blessings'

export default defineEventHandler(async (event: H3Event): Promise<BlessingRejectedEvent> => {
  const blessingId = getRouterParam(event, 'blessingId')
  const body = await readBody<RejectBlessingBody>(event)

  const blessing = mockBlessings.find(b => b.blessingId === blessingId)
  if (!blessing) {
    throw createError({ statusCode: 404, statusMessage: '祝福不存在' })
  }
  if (blessing.status !== 'submitted') {
    throw createError({ statusCode: 409, statusMessage: '祝福已審核' })
  }
  blessing.status = 'rejected'
  blessing.rejectReason = body?.reason ?? null

  setResponseStatus(event, 201)
  return { blessingId: blessing.blessingId, status: blessing.status, reason: body?.reason ?? '' }
})
