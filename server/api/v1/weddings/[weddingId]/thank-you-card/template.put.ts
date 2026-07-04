import type { H3Event } from 'h3'
import type { SetThankYouTemplateBody, ThankYouTemplateSetEvent } from '../../../../../../app/types/api/thankyou'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { thankYouTemplates, weddings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ThankYouTemplateSetEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SetThankYouTemplateBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const templateImageUrl = body.templateImageUrl ?? null
  const greeting = body.greeting ?? null
  const signature = body.signature ?? null
  const signatureDate = body.signatureDate ?? null

  // singleton upsert：先查有無範本，有則更新、無則新增
  const [existing] = await db.select().from(thankYouTemplates).where(eq(thankYouTemplates.weddingId, weddingId))
  if (existing) {
    await db.update(thankYouTemplates)
      .set({ templateContent: body.templateContent, templateImageUrl, greeting, signature, signatureDate })
      .where(eq(thankYouTemplates.weddingId, weddingId))
  }
  else {
    await db.insert(thankYouTemplates).values({
      weddingId,
      templateContent: body.templateContent,
      templateImageUrl,
      greeting,
      signature,
      signatureDate,
    })
  }

  return { weddingId, templateContent: body.templateContent, templateImageUrl, greeting, signature, signatureDate }
})
