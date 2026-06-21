import type { H3Event } from 'h3'
import type { EtiquetteSettingsDetail } from '../../../../../app/types/api/seating'

import { mockEtiquetteSettings } from '../../../../mock/data/seating'

// 讀回該婚禮的禮俗設定五開關：尚未設定回合理預設（重整後仍能還原 modal 既有值）
export default defineEventHandler((event: H3Event): EtiquetteSettingsDetail => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const settings = mockEtiquetteSettings.find(s => s.weddingId === weddingId)
  if (!settings) {
    return {
      weddingId,
      elderNearMain: true,
      conflictWarning: true,
      genderSeparation: true,
      mainTableNearStage: true,
      sameCategoryTogether: false,
    }
  }
  return {
    weddingId: settings.weddingId,
    elderNearMain: settings.elderNearMain,
    conflictWarning: settings.conflictWarning,
    genderSeparation: settings.genderSeparation,
    mainTableNearStage: settings.mainTableNearStage,
    sameCategoryTogether: settings.sameCategoryTogether,
  }
})
