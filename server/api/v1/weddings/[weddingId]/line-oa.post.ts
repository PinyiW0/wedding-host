import type { H3Event } from 'h3'
import type { ConnectLineOaBody, LineOaConnectedEvent } from '../../../../../app/types/api/line'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { lineOas, weddings } from '../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<LineOaConnectedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ConnectLineOaBody>(event)

  const db = useDb()
  const [wedding] = await db.select().from(weddings).where(eq(weddings.weddingId, weddingId))
  if (!wedding) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  if (!body?.oaName || !body?.channelId) {
    throw createError({ statusCode: 400, statusMessage: '請輸入 OA 名稱與 Channel ID' })
  }

  // 未帶 addFriendUrl 視同清除（對齊 mock 直接覆寫的語意；set undefined 會被 drizzle 略過）
  const addFriendUrl = body.addFriendUrl ?? null

  // singleton upsert：先查有無連結，有則更新、無則新增
  const [existing] = await db.select().from(lineOas).where(eq(lineOas.weddingId, weddingId))
  if (existing) {
    await db.update(lineOas)
      .set({ oaName: body.oaName, channelId: body.channelId, addFriendUrl })
      .where(eq(lineOas.weddingId, weddingId))
  }
  else {
    await db.insert(lineOas).values({ weddingId, oaName: body.oaName, channelId: body.channelId, addFriendUrl })
  }

  setResponseStatus(event, 201)
  return { weddingId, oaName: body.oaName, channelId: body.channelId, addFriendUrl: body.addFriendUrl }
})
