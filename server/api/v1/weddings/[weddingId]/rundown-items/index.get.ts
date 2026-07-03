import type { H3Event } from 'h3'
import type { RundownItemListItem } from '../../../../../../app/types/api/rundown'

import { mockRundownItems } from '../../../../../mock/data/rundown'

export default defineEventHandler((event: H3Event): RundownItemListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')!
  // 排序：time null（未定時段）置頂，其餘依 time 字串升冪
  return mockRundownItems
    .filter(i => i.weddingId === weddingId)
    .sort((a, b) => {
      if (a.time === null && b.time === null)
        return 0
      if (a.time === null)
        return -1
      if (b.time === null)
        return 1
      return a.time.localeCompare(b.time)
    })
})
