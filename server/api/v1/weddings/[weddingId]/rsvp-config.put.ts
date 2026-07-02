import type { H3Event } from 'h3'
import type { ConfigureRsvpFormBody, RsvpFormConfiguredEvent } from '../../../../../app/types/api/rsvp-config'

import { mockRsvpFormConfigs } from '../../../../mock/data/rsvp-config'
import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<RsvpFormConfiguredEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ConfigureRsvpFormBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const banner = body.banner ?? null
  const existing = mockRsvpFormConfigs.find(c => c.weddingId === weddingId)
  if (existing) {
    existing.theme = body.theme
    existing.banner = banner
    existing.questions = body.questions
  }
  else {
    mockRsvpFormConfigs.push({ weddingId, theme: body.theme, banner, questions: body.questions })
  }

  return { weddingId, theme: body.theme, banner, questions: body.questions }
})
