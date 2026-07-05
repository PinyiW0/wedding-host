import type { PresignUploadBody, PresignUploadResponse } from '~/types/api/uploads'

// 圖片直傳簽名（R2 啟用時由 useImageUpload 呼叫）
export function presignUpload(weddingId: string, body: PresignUploadBody) {
  const http = useHttp()
  return http.post<PresignUploadResponse>('/api/v1/weddings/:weddingId/uploads/presign', {
    pathParams: { weddingId },
    body,
  })
}
