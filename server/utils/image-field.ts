import type { H3Event } from 'h3'

import { Buffer } from 'node:buffer'

// 圖片欄位的落庫規則（issue #226）：資料庫只存網址，不存 base64。
// 2026-11-22 正式站就是因為花圖以 base64 存在賓客表、被輪詢整列讀出，Neon 傳輸量超過額度。
// 例外：未設定 R2 的非 enforced 環境（本機 dev／E2E）維持 dataURL，離線可用。

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
// 正式站花圖平均 25KB；300KB 已是十倍以上
export const FLOWER_MAX_BYTES = 300 * 1024
const FLOWER_MAX_BASE64_CHARS = Math.ceil(FLOWER_MAX_BYTES / 3) * 4
// 未設定 R2 時 dataURL 直接落庫的長度上限（本機 dev／E2E）
const DATA_URL_FALLBACK_MAX_CHARS = 1_000_000
export const IMAGE_URL_MAX_CHARS = 2048
const HTTPS_URL_RE = /^https:\/\//i

function isEnforced(): boolean {
  return useRuntimeConfig().authMode === 'enforced'
}

export function decodeFlowerPng(value: string): Uint8Array {
  if (!value.startsWith(PNG_DATA_URL_PREFIX)) {
    throw createError({ statusCode: 400, statusMessage: '手繪花圖格式不正確' })
  }
  const base64 = value.slice(PNG_DATA_URL_PREFIX.length)
  if (base64.length > FLOWER_MAX_BASE64_CHARS) {
    throw createError({ statusCode: 400, statusMessage: '手繪花圖過大' })
  }
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length < PNG_MAGIC.length || PNG_MAGIC.some((b, i) => bytes[i] !== b)) {
    throw createError({ statusCode: 400, statusMessage: '手繪花圖格式不正確' })
  }
  return bytes
}

/**
 * 賓客手繪花落庫前的轉存：R2 已設定 → 把 PNG 寫進 R2，回傳公開網址；
 * 未設定 → enforced 環境拒收（不讓 base64 再進正式庫），其餘環境原樣回傳。
 * undefined／null／空字串原樣回傳（維持「有填才動」的既有語意）。
 * 呼叫端要先確認婚禮／賓客存在再呼叫，避免替不存在的對象寫入 R2。
 */
export async function storeFlowerDrawing<T extends string | null | undefined>(event: H3Event, weddingId: string, value: T): Promise<T | string> {
  if (value == null || value === '')
    return value
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '手繪花圖格式不正確' })
  }

  if (!isR2Configured()) {
    if (isEnforced()) {
      throw createError({ statusCode: 503, statusMessage: '圖片儲存服務未設定' })
    }
    if (value.length > DATA_URL_FALLBACK_MAX_CHARS) {
      throw createError({ statusCode: 400, statusMessage: '手繪花圖過大' })
    }
    return value
  }

  const bytes = decodeFlowerPng(value)
  // 公開回覆端點不需登入：限每 IP＋婚禮每分鐘的轉存次數，防灌爆 bucket
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!consumeRateLimit(`flower:${ip}:${weddingId}`, 20, 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: '送出過於頻繁，請稍後再試' })
  }

  const key = `weddings/${weddingId}/flower/${crypto.randomUUID()}.png`
  try {
    await putR2Object(key, bytes, 'image/png')
  }
  catch (error) {
    console.error('[flower] R2 轉存失敗', error)
    throw createError({ statusCode: 502, statusMessage: '花圖儲存失敗，請再送出一次' })
  }
  return `${useRuntimeConfig().public.r2PublicUrl}/${key}`
}

/**
 * 管理端圖片欄位（投影照片、自訂花）：前端先經 useImageUpload 直傳 R2，送來的應是網址。
 * enforced 環境只收 https 網址（拒收 data: 內容、其他協定與過長字串）；其餘環境（未設定 R2）不檢查。
 */
export function assertImageRef(value: unknown, label: string): void {
  if (value == null || value === '' || !isEnforced())
    return
  // 只收 https 網址：data:、javascript:、http 外站圖一律擋
  if (typeof value !== 'string' || value.length > IMAGE_URL_MAX_CHARS || !HTTPS_URL_RE.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `${label}必須是已上傳圖片的網址` })
  }
}
