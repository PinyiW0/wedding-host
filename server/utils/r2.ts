import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 直傳（issue #9）：presigned PUT 讓照片不經過 server function，
// 公開讀取走 NUXT_PUBLIC_R2_PUBLIC_URL。未設定＝圖片維持 dataURL-in-DB（本機 dev/e2e）。

let _client: S3Client | undefined

// AWS SDK ≥3.729 預設對 PutObject 計算 CRC32 checksum 並簽進 presigned URL（presign 時以空 body 算出）；
// 前端 PUT 真實圖片時 R2 驗 body checksum 與簽名不符而回 400，圖片一律上傳失敗。
// R2 直傳不需要此 checksum，改為 WHEN_REQUIRED（PutObject 非必要 → 不簽）。issue #50。
export const R2_CHECKSUM_CONFIG = { requestChecksumCalculation: 'WHEN_REQUIRED' } as const

export function isR2Configured(): boolean {
  const c = useRuntimeConfig()
  return !!(c.r2Endpoint && c.r2AccessKeyId && c.r2SecretAccessKey && c.r2Bucket && c.public.r2PublicUrl)
}

function r2Client(): S3Client {
  const c = useRuntimeConfig()
  _client ??= new S3Client({
    region: 'auto',
    endpoint: c.r2Endpoint,
    credentials: { accessKeyId: c.r2AccessKeyId, secretAccessKey: c.r2SecretAccessKey },
    ...R2_CHECKSUM_CONFIG,
  })
  return _client
}

// 產生 10 分鐘有效的 presigned PUT URL（key 由呼叫端組出，含 weddingId 前綴）
export async function presignUpload(key: string, contentType: string): Promise<string> {
  const c = useRuntimeConfig()
  return getSignedUrl(
    r2Client(),
    new PutObjectCommand({ Bucket: c.r2Bucket, Key: key, ContentType: contentType }),
    { expiresIn: 600 },
  )
}
