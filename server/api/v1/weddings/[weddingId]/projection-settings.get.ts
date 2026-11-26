import type { H3Event } from 'h3'
import type { ProjectionSettings } from '../../../../../app/types/api/projection'

import { eq, sql } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { projectionSettings, weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<ProjectionSettings> => {
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [wedding] = await db.select({ weddingId: weddings.weddingId }).from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }

  // 投影頁每 5 秒輪詢本端點，而照片與自訂花是整張圖的 dataURL（數百 KB）。
  // 先請資料庫只回內容指紋（32 字元），瀏覽器帶來的 If-None-Match 相同就回 304，大欄位完全不出資料庫（issue #224）。
  // 回應格式不變：瀏覽器收到 304 會沿用自己快取的那份完整內容。
  const [version] = await db.select({
    // 每欄包 coalesce：concat_ws 會跳過 NULL，不固定欄位位置的話「照片有值、影片空」與「照片空、影片有值」會算成同一個指紋
    tag: sql<string>`md5(concat_ws('|', ${projectionSettings.mediaType}, coalesce(${projectionSettings.photoDataUrl}, ''), coalesce(${projectionSettings.videoUrl}, ''), ${projectionSettings.customFlowers}::text))`,
  }).from(projectionSettings).where(eq(projectionSettings.weddingId, weddingId))
  const etag = `"${version?.tag ?? 'unset'}"`
  setResponseHeader(event, 'ETag', etag)
  // no-cache＝可以存，但每次用之前要先問伺服器有沒有變；private＝只存在這台瀏覽器
  setResponseHeader(event, 'Cache-Control', 'private, no-cache')
  if (matchesEtag(getRequestHeader(event, 'if-none-match'), etag)) {
    setResponseStatus(event, 304)
    return null as unknown as ProjectionSettings
  }

  // 未設定回預設值（對齊 rsvp-config「未設定回預設」慣例）
  const [existing] = await db.select().from(projectionSettings).where(eq(projectionSettings.weddingId, weddingId))
  return existing
    ? {
        weddingId: existing.weddingId,
        mediaType: existing.mediaType,
        photoDataUrl: existing.photoDataUrl,
        videoUrl: existing.videoUrl,
        customFlowers: existing.customFlowers,
      }
    : { weddingId, mediaType: 'none', photoDataUrl: null, videoUrl: null, customFlowers: [] }
})

const WEAK_PREFIX_RE = /^W\//

// If-None-Match 比對：中間層壓縮回應時會把 ETag 改成弱式（W/"..."），瀏覽器也可能一次帶多個值；
// 只做字串全等的話，正式站會永遠比不中、每一輪都把整張照片讀出來
function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header)
    return false
  return header.split(',').some((value) => {
    const candidate = value.trim().replace(WEAK_PREFIX_RE, '')
    return candidate === etag || candidate === '*'
  })
}
