// 投影設定：投影牆中央媒體（照片上傳 / 影片 URL）與新人自訂花朵圖

export type ProjectionMediaType = 'none' | 'photo' | 'video'

export interface ProjectionSettings {
  weddingId: string
  mediaType: ProjectionMediaType
  // 上傳照片（dataURL，同 banner / 謝卡圖慣例）；未設定為 null
  photoDataUrl: string | null
  // 影片連結（YouTube → iframe 內嵌；其他 → <video> 播放）；未設定為 null
  videoUrl: string | null
  // 新人自行上傳的花朵圖（dataURL 陣列），與賓客手繪花共同做投影裝飾
  customFlowers: string[]
}

export type UpdateProjectionSettingsBody = Omit<ProjectionSettings, 'weddingId'>

export type ProjectionSettingsUpdatedEvent = ProjectionSettings
