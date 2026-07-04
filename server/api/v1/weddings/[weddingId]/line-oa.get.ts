import type { H3Event } from 'h3'
import type { LineOaDetail } from '../../../../../app/types/api/line'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { lineOas } from '../../../../db/schema'

// 讀回該婚禮的 LINE OA 連結狀態：尚未連結回 null（重整後仍能還原顯示）
export default defineEventHandler(async (event: H3Event): Promise<LineOaDetail | null> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [oa] = await db.select().from(lineOas).where(eq(lineOas.weddingId, weddingId))
  if (!oa) {
    return null
  }
  // addFriendUrl 於 DB 可為 null，合約型別為 optional：以 undefined 落地讓 JSON 省略該鍵（同 mock 行為）
  return { weddingId: oa.weddingId, oaName: oa.oaName, channelId: oa.channelId, addFriendUrl: oa.addFriendUrl ?? undefined }
})
