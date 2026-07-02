import type { H3Event } from 'h3'
import type { RsvpFormConfigDetail } from '../../../../../app/types/api/rsvp-config'

import { defaultRsvpFormConfig, mockRsvpFormConfigs } from '../../../../mock/data/rsvp-config'

// 讀回該婚禮的 RSVP 表單設定：未設定過回預設範本（不回 null），確保賓客表單一律有可用設定
export default defineEventHandler((event: H3Event): RsvpFormConfigDetail => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const config = mockRsvpFormConfigs.find(c => c.weddingId === weddingId)
  return config ?? defaultRsvpFormConfig(weddingId)
})
