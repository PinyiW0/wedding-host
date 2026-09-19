import type { H3Event } from 'h3'
import type { CreateShortLinkBody, ShortLinkResponse } from '../../../../../app/types/api/links'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { shortLinks } from '../../../../db/schema'

// 取得婚禮公開連結的短碼（管理端專用；由統一中介層限管理者／新人）
// 取得或建立：同一場婚禮的同一種連結永遠回同一個短碼，重複按「複製」不會一直長出新碼
export default defineEventHandler(async (event: H3Event): Promise<ShortLinkResponse> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateShortLinkBody>(event)
  assertEnum(body?.kind, SHORT_LINK_KINDS, '連結種類')
  const kind = body.kind

  const db = useDb()
  const findExisting = () => db
    .select({ code: shortLinks.code })
    .from(shortLinks)
    .where(and(eq(shortLinks.weddingId, weddingId), eq(shortLinks.kind, kind)))
    .limit(1)

  const [existing] = await findExisting()
  if (existing)
    return { code: existing.code }

  // 插不進去有兩種可能：短碼撞號（重抽即可）、或併發請求剛建好同一組（回查拿它）
  for (let attempt = 0; attempt < 5; attempt++) {
    const [inserted] = await db
      .insert(shortLinks)
      .values({ code: generateShortCode(), weddingId, kind, createdAt: new Date().toISOString() })
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
