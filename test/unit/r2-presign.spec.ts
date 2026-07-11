import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { describe, expect, it } from 'vitest'

import { R2_CHECKSUM_CONFIG } from '../../server/utils/r2'

// issue #50：AWS SDK ≥3.729 預設對 PutObject 加 CRC32 checksum，會被簽進 presigned URL，
// 前端直傳 R2 時 body checksum 與簽名不符而 400。R2_CHECKSUM_CONFIG 關掉它——
// 本測試守護該設定：若被還原成預設（WHEN_SUPPORTED），URL 會重新帶 checksum、測試轉紅。
describe('r2 presign checksum 設定（issue #50）', () => {
  it('presigned PUT URL 不含 x-amz-checksum 參數', async () => {
    const client = new S3Client({
      region: 'auto',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
      ...R2_CHECKSUM_CONFIG,
    })
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: 'bucket', Key: 'weddings/w-test/transport/x.jpg', ContentType: 'image/jpeg' }),
      { expiresIn: 600 },
    )
    expect(url).not.toContain('x-amz-checksum')
    expect(url).not.toContain('x-amz-sdk-checksum-algorithm')
  })
})
