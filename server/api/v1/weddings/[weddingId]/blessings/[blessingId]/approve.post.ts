import type { H3Event } from 'h3'
import type { BlessingApprovedEvent } from '../../../../../../../app/types/api/blessings'

import { mockBlessings } from '../../../../../../mock/data/blessings'

export default defineEventHandler((event: H3Event): BlessingApprovedEvent => {
  const blessingId = getRouterParam(event, 'blessingId')
  const blessing = mockBlessings.find(b => b.blessingId === blessingId)
  if (!blessing) {
    throw createError({ statusCode: 404, statusMessage: '祝福不存在' })
  }
  if (blessing.status !== 'submitted') {
    throw createError({ statusCode: 409, statusMessage: '祝福已審核' })
  }
  blessing.status = 'approved'

  setResponseStatus(event, 201)
  return { blessingId: blessing.blessingId, status: blessing.status }
})
