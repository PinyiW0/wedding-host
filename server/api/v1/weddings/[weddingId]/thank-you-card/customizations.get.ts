import type { H3Event } from 'h3'
import type { ThankYouCustomizationListItem } from '../../../../../../app/types/api/thankyou'

import { mockThankYouCustomizations } from '../../../../../mock/data/thankyou'

// 讀回該婚禮的個別客製謝卡清單（重整後仍能還原顯示）
export default defineEventHandler((event: H3Event): ThankYouCustomizationListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  return mockThankYouCustomizations
    .filter(c => c.weddingId === weddingId)
    .map(c => ({
      weddingId: c.weddingId,
      guestId: c.guestId,
      customContent: c.customContent,
    }))
})
