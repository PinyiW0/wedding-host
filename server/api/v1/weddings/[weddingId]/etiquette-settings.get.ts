import type { H3Event } from 'h3'
import type { EtiquetteSettingsDetail } from '../../../../../app/types/api/seating'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { etiquetteSettings } from '../../../../db/schema'

// 讀回該婚禮的禮俗設定三開關：尚未設定回合理預設（重整後仍能還原 modal 既有值）
export default defineEventHandler(async (event: H3Event): Promise<EtiquetteSettingsDetail> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [settings] = await db.select().from(etiquetteSettings).where(eq(etiquetteSettings.weddingId, weddingId))
  if (!settings) {
    return {
      weddingId,
      elderNearMain: true,
      mainTableFull: true,
      sameCategoryTogether: false,
    }
  }
  return {
    weddingId: settings.weddingId,
    elderNearMain: settings.elderNearMain,
    mainTableFull: settings.mainTableFull,
    sameCategoryTogether: settings.sameCategoryTogether,
  }
})
