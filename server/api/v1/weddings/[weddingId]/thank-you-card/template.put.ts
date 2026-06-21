import type { H3Event } from 'h3'
import type { SetThankYouTemplateBody, ThankYouTemplateSetEvent } from '../../../../../../app/types/api/thankyou'

import { mockThankYouTemplates } from '../../../../../mock/data/thankyou'
import { mockWeddings } from '../../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouTemplateSetEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SetThankYouTemplateBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const templateImageUrl = body.templateImageUrl ?? null
  const existing = mockThankYouTemplates.find(t => t.weddingId === weddingId)
  if (existing) {
    existing.templateContent = body.templateContent
    existing.templateImageUrl = templateImageUrl
  }
  else {
    mockThankYouTemplates.push({ weddingId, templateContent: body.templateContent, templateImageUrl })
  }

  return { weddingId, templateContent: body.templateContent, templateImageUrl }
})
