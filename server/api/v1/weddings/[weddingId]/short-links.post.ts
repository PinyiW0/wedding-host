import type { H3Event } from 'h3'
import type { CreateShortLinkBody, ShortLinkResponse } from '../../../../../app/types/api/links'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { guests, shortLinks } from '../../../../db/schema'

// 取得婚禮公開連結的短碼（管理端專用；由統一中介層限管理者／新人）
// 取得或建立：同一場婚禮（賓客層級再加同一位賓客）的同一種連結永遠回同一個短碼，
// 重複按「複製」不會一直長出新碼
export default defineEventHandler(async (event: H3Event): Promise<ShortLinkResponse> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateShortLinkBody>(event)
  assertEnum(body?.kind, SHORT_LINK_KINDS, '連結種類')
  const kind = body.kind

  const db = useDb()

  // 賓客層級四種才吃 guestId，而且必須是這場婚禮的賓客——只用 guestId 查會讓 A 場的新人
  // 拿到 B 場賓客的專屬連結（跨租戶 IDOR）。婚禮層級一律存空字串，不讓 body 帶的值進來
  let guestId = ''
  if (isGuestShortLinkKind(kind)) {
    if (typeof body.guestId !== 'string' || !body.guestId)
      throw createError({ statusCode: 400, statusMessage: '賓客不正確' })
    const [guest] = await db
      .select({ guestId: guests.guestId })
      .from(guests)
      .where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, body.guestId)))
      .limit(1)
    if (!guest)
      throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
    guestId = guest.guestId
  }

  const findExisting = () => db
    .select({ code: shortLinks.code })
    .from(shortLinks)
    .where(and(eq(shortLinks.weddingId, weddingId), eq(shortLinks.kind, kind), eq(shortLinks.guestId, guestId)))
    .limit(1)

  const [existing] = await findExisting()
  if (existing)
    return { code: existing.code }

  // 插不進去有兩種可能：短碼撞號（重抽即可）、或併發請求剛建好同一組（回查拿它）
  for (let attempt = 0; attempt < 5; attempt++) {
    const [inserted] = await db
      .insert(shortLinks)
      .values({ code: generateShortCode(kind), weddingId, kind, guestId, createdAt: new Date().toISOString() })
      .onConflictDoNothing()
      .returning({ code: shortLinks.code })
    if (inserted)
      return { code: inserted.code }

    const [raced] = await findExisting()
    if (raced)
      return { code: raced.code }
  }

  throw createError({ statusCode: 500, statusMessage: '短網址產生失敗，請再試一次' })
})
