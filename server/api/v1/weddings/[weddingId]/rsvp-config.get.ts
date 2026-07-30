import type { H3Event } from 'h3'
import type { RsvpFormConfigDetail } from '../../../../../app/types/api/rsvp-config'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { rsvpFormConfigs } from '../../../../db/schema'
import { defaultRsvpFormConfig, normalizeRsvpQuestions } from '../../../../mock/data/rsvp-config'

// 讀回該婚禮的 RSVP 表單設定：未設定過回預設範本（不回 null），確保賓客表單一律有可用設定
export default defineEventHandler(async (event: H3Event): Promise<RsvpFormConfigDetail> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [config] = await db.select().from(rsvpFormConfigs).where(eq(rsvpFormConfigs.weddingId, weddingId))
  if (!config) {
    return defaultRsvpFormConfig(weddingId)
  }
  return {
    weddingId: config.weddingId,
    theme: config.theme,
    banner: config.banner,
    // 舊版存檔可能缺少後來新增的系統題，補回後新人不必手動重設
    questions: normalizeRsvpQuestions(config.questions),
  }
})
