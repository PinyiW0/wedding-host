import type { H3Event } from 'h3'

import { eq } from 'drizzle-orm'

import { ensureDbReady, useDb } from '../../db'
import { shortLinks } from '../../db/schema'

// 公開連結短網址轉址（issue #170、賓客層級為 #176）：/s/<code> → 對應公開頁，簽章在這裡現算補上。
// 簽章不出現在新人發出去的網址上，賓客轉傳時也就不會把存取憑證一起貼出去。
// 302（非 301）：短碼的目標日後若要調整，瀏覽器不會拿永久快取擋住。
// 這條路由不在 /api/ 底下，不經認證中介層——短碼本身不帶授權，找不到就 404。
export default defineEventHandler(async (event: H3Event) => {
  const code = getRouterParam(event, 'code')!
  await ensureDbReady()

  const [link] = await useDb()
    .select({ weddingId: shortLinks.weddingId, kind: shortLinks.kind, guestId: shortLinks.guestId })
    .from(shortLinks)
    .where(eq(shortLinks.code, code))
    .limit(1)

  if (!link)
    throw createError({ statusCode: 404, statusMessage: '連結不存在或已失效' })

  // 賓客層級的四類公開頁認的是賓客簽章（g.<guestId>.<digest>），婚禮分享簽章過不了
  const sig = isGuestShortLinkKind(link.kind)
    ? signGuestLink(link.weddingId, link.guestId)
    : signWeddingLink(link.weddingId)
  // 賓客層級的目標路徑自帶 query（weddingId／guestId），簽章要用 & 接上去
  const target = shortLinkTarget(link.kind, link.weddingId, link.guestId)
  const separator = target.includes('?') ? '&' : '?'
  return sendRedirect(event, `${target}${separator}sig=${encodeURIComponent(sig)}`, 302)
})
