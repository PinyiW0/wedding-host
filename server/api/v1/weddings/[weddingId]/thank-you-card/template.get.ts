import type { H3Event } from 'h3'
import type { ThankYouTemplateDetail } from '../../../../../../app/types/api/thankyou'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { thankYouTemplates } from '../../../../../db/schema'

// 讀回該婚禮已設定的謝卡範本：尚未設定回 null（重整後仍能還原顯示）
export default defineEventHandler(async (event: H3Event): Promise<ThankYouTemplateDetail | null> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [template] = await db.select().from(thankYouTemplates).where(eq(thankYouTemplates.weddingId, weddingId))
  if (!template) {
    return null
  }
  return {
    weddingId: template.weddingId,
    templateContent: template.templateContent,
    templateImageUrl: template.templateImageUrl,
    greeting: template.greeting,
    signature: template.signature,
    signatureDate: template.signatureDate,
  }
})
