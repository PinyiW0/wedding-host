import type { H3Event } from 'h3'
import type { ThankYouTemplateDetail } from '../../../../../../app/types/api/thankyou'

import { mockThankYouTemplates } from '../../../../../mock/data/thankyou'

// 讀回該婚禮已設定的謝卡範本：尚未設定回 null（重整後仍能還原顯示）
export default defineEventHandler((event: H3Event): ThankYouTemplateDetail | null => {
  const weddingId = getRouterParam(event, 'weddingId')
  const template = mockThankYouTemplates.find(t => t.weddingId === weddingId)
  if (!template) {
    return null
  }
  return {
    weddingId: template.weddingId,
    templateContent: template.templateContent,
    templateImageUrl: template.templateImageUrl,
  }
})
