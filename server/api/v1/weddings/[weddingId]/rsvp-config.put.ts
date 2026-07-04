import type { H3Event } from 'h3'
import type { ConfigureRsvpFormBody, RsvpFormConfiguredEvent } from '../../../../../app/types/api/rsvp-config'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { rsvpFormConfigs, weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RsvpFormConfiguredEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ConfigureRsvpFormBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  const banner = body.banner ?? null
  // singleton upsert：先查有無設定，有則更新、無則新增
  const [existing] = await db.select().from(rsvpFormConfigs).where(eq(rsvpFormConfigs.weddingId, weddingId))
  if (existing) {
    await db.update(rsvpFormConfigs)
      .set({ theme: body.theme, banner, questions: body.questions })
      .where(eq(rsvpFormConfigs.weddingId, weddingId))
  }
  else {
    await db.insert(rsvpFormConfigs).values({ weddingId, theme: body.theme, banner, questions: body.questions })
  }

  return { weddingId, theme: body.theme, banner, questions: body.questions }
})
