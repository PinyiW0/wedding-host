import type { H3Event } from 'h3'
import type { LineOaDetail } from '../../../../../app/types/api/line'

import { mockLineOas } from '../../../../mock/data/line'

// 讀回該婚禮的 LINE OA 連結狀態：尚未連結回 null（重整後仍能還原顯示）
export default defineEventHandler((event: H3Event): LineOaDetail | null => {
  const weddingId = getRouterParam(event, 'weddingId')
  const oa = mockLineOas.find(o => o.weddingId === weddingId)
  if (!oa) {
    return null
  }
  return { weddingId: oa.weddingId, oaName: oa.oaName, channelId: oa.channelId }
})
