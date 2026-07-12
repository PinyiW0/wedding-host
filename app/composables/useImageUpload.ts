import { presignUpload } from '~/api'

// 統一圖片上傳：
//   R2 已設定（NUXT_PUBLIC_R2_PUBLIC_URL 有值）→ presigned 直傳 R2，回公開 URL
//   未設定（本機 dev / e2e）→ 維持 dataURL（原行為，離線可用）
// 兩種回傳值都是字串，存進同一個 API 欄位、<img :src> 皆可直接顯示
export function useImageUpload() {
  const r2Enabled = !!useRuntimeConfig().public.r2PublicUrl

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  async function toBlob(source: File | string): Promise<Blob> {
    if (typeof source !== 'string')
      return source
    // dataURL → Blob（canvas 縮圖流程的來源是 dataURL）
    const res = await fetch(source)
    return res.blob()
  }

  // 上傳前壓縮：最長邊 1600px 足敷投影／交通圖顯示，避免手機原圖（數 MB）直傳
  const MAX_EDGE = 1600
  const JPEG_QUALITY = 0.85
  // GIF（動圖）與 SVG（向量）重編碼會壞，跳過
  const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml'])

  async function compressImage(blob: Blob): Promise<Blob> {
    if (!blob.type.startsWith('image/') || SKIP_TYPES.has(blob.type))
      return blob
    try {
      const bitmap = await createImageBitmap(blob)
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
      // 未超限不重編碼（避免無謂畫質損失）
      if (scale === 1) {
        bitmap.close()
        return blob
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      // PNG 保留格式（透明底），其餘統一輸出 JPEG
      const isPng = blob.type === 'image/png'
      const out = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, isPng ? 'image/png' : 'image/jpeg', JPEG_QUALITY),
      )
      // 編碼失敗或壓完反而更大 → 用原檔
      return out && out.size < blob.size ? out : blob
    }
    catch {
      // 解碼失敗（損壞檔等）→ 交由原流程上傳原檔
      return blob
    }
  }

  /**
   * 上傳單張圖片。source 可為 File（檔案選取）或 dataURL 字串（canvas 產物）。
   * kind 僅作 R2 物件 key 的資料夾分類（blessing／cake-box／gift…）。
   */
  async function uploadImage(source: File | string, weddingId: string, kind: string): Promise<string> {
    // 已是 URL（編輯既有資料未換圖）→ 原樣返回，避免重複上傳
    if (typeof source === 'string' && !source.startsWith('data:'))
      return source
    if (!r2Enabled)
      return typeof source === 'string' ? source : fileToDataUrl(source)

    const blob = await compressImage(await toBlob(source))
    const contentType = blob.type || 'image/jpeg'
    const { uploadUrl, publicUrl } = await presignUpload(weddingId, { contentType, kind })
    // 直傳 R2：用原生 fetch（外部 URL，不可帶站內 Authorization/簽名 header）
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': contentType },
    })
    if (!res.ok)
      throw new Error(`圖片上傳失敗（${res.status}）`)
    return publicUrl
  }

  return { uploadImage, r2Enabled }
}
