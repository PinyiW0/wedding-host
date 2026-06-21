import type { H3Event } from 'h3'
import type { VenueLayoutDetail } from '../../../../../app/types/api/seating'

import { mockVenueLayouts } from '../../../../mock/data/seating'

// 讀回該婚禮的場地佈局：尚未設定回 null（重整後仍能還原 modal 既有值）
export default defineEventHandler((event: H3Event): VenueLayoutDetail | null => {
  const weddingId = getRouterParam(event, 'weddingId')
  const layout = mockVenueLayouts.find(l => l.weddingId === weddingId)
  if (!layout) {
    return null
  }
  return {
    weddingId: layout.weddingId,
    stageWidth: layout.stageWidth,
    stageHeight: layout.stageHeight,
    stagePositionX: layout.stagePositionX,
    stagePositionY: layout.stagePositionY,
  }
})
