import type { H3Event } from 'h3'
import type { BlessingProjectedEvent } from '../../../../../../../app/types/api/blessings'

import { mockBlessings } from '../../../../../../mock/data/blessings'

// 推到投影幕：將已通過審核的祝福標記為「已上牆」（避免重播）
export default defineEventHandler((event: H3Event): BlessingProjectedEvent => {
  const blessingId = getRouterParam(event, 'blessingId')
  const blessing = mockBlessings.find(b => b.blessingId === blessingId)
  if (!blessing) {
    throw createError({ statusCode: 404, statusMessage: '祝福不存在' })
  }
  if (blessing.status !== 'approved') {
    throw createError({ statusCode: 409, statusMessage: '祝福尚未通過審核' })
  }
  blessing.wallStatus = 'on_wall'

  return { blessingId: blessing.blessingId, wallStatus: 'on_wall' }
})
