import type { H3Event } from 'h3'
import type { ConfigureRsvpFormBody, RsvpFormConfiguredEvent } from '../../../../../app/types/api/rsvp-config'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { rsvpFormConfigs, weddings } from '../../../../db/schema'
import { sanitizeRsvpBanners } from '../../../../mock/data/rsvp-config'

export default defineEventHandler(async (event: H3Event): Promise<RsvpFormConfiguredEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ConfigureRsvpFormBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // 逐組逐張驗過再存：超出上限截斷、照片網址限 http(s)／image dataURL、底色不合格式落回預設色
  const banners = sanitizeRsvpBanners(body.banners)
  // banner 是多組之前的單張欄位，一律跟著第一組的第一張走。
  // 舊版前端（只送 banner 不送 banners）也還能存，這時 banners 是空的、banner 原樣保留
  const banner = banners[0]?.photos[0] ?? body.banner ?? null

  // singleton upsert：先查有無設定，有則更新、無則新增
  const [existing] = await db.select().from(rsvpFormConfigs).where(eq(rsvpFormConfigs.weddingId, weddingId))
  if (existing) {
    await db.update(rsvpFormConfigs)
      .set({ theme: body.theme, banner, banners, questions: body.questions })
      .where(eq(rsvpFormConfigs.weddingId, weddingId))
  }
  else {
    await db.insert(rsvpFormConfigs).values({ weddingId, theme: body.theme, banner, banners, questions: body.questions })
  }

  return { weddingId, theme: body.theme, banner, banners, questions: body.questions }
})
