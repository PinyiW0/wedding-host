import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 直傳（issue #9）：presigned PUT 讓照片不經過 server function，
// 公開讀取走 NUXT_PUBLIC_R2_PUBLIC_URL。未設定＝圖片維持 dataURL-in-DB（本機 dev/e2e）。

let _client: S3Client | undefined

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
