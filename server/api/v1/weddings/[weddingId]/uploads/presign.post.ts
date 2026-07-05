import type { H3Event } from 'h3'
import type { PresignUploadBody, PresignUploadResponse } from '../../../../../../app/types/api/uploads'

// 圖片直傳簽名：回傳 R2 presigned PUT URL 與上傳後的公開讀取 URL
// R2 未設定（本機 dev/e2e）時回 503——前端在 r2PublicUrl 為空時本就不會呼叫此端點
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// kind 僅允許小寫英數與連字號（作 R2 物件 key 的資料夾分類，防路徑跳脫）
const KIND_RE = /^[a-z0-9-]{1,32}$/

export default defineEventHandler(async (event: H3Event): Promise<PresignUploadResponse> => {
  const weddingId = getRouterParam(event, 'weddingId')!

  if (!isR2Configured()) {
    throw createError({ statusCode: 503, statusMessage: '圖片儲存服務未設定' })
  }

  const body = await readBody<PresignUploadBody>(event)
  const ext = body?.contentType ? EXT_BY_TYPE[body.contentType] : undefined
  if (!ext) {
    throw createError({ statusCode: 400, statusMessage: '不支援的圖片格式' })
  }

  const kind = KIND_RE.test(body.kind ?? '') ? body.kind! : 'images'
  const key = `weddings/${weddingId}/${kind}/${crypto.randomUUID()}.${ext}`
  const uploadUrl = await presignUpload(key, body.contentType)

  return {
    uploadUrl,
    publicUrl: `${useRuntimeConfig().public.r2PublicUrl}/${key}`,
  }
})
