// 圖片直傳（R2 presigned upload）合約

export interface PresignUploadBody {
  /** 圖片 MIME type（image/jpeg | image/png | image/webp | image/gif） */
  contentType: string
  /** 物件 key 的資料夾分類（如 blessing、cake-box），選填 */
  kind?: string
}

export interface PresignUploadResponse {
  /** presigned PUT URL：前端以原始檔案 PUT 上傳（10 分鐘有效） */
  uploadUrl: string
  /** 上傳完成後的公開讀取 URL（存進資料欄位） */
  publicUrl: string
}
