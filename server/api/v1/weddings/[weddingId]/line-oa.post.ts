import type { H3Event } from 'h3'
import type { ConnectLineOaBody, LineOaConnectedEvent } from '../../../../../app/types/api/line'

import { mockLineOas } from '../../../../mock/data/line'
import { mockWeddings } from '../../../../mock/data/weddings'

export default defineEventHandler(async (event: H3Event): Promise<LineOaConnectedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ConnectLineOaBody>(event)

  if (!mockWeddings.some(w => w.weddingId === weddingId)) {
    throw createError({ statusCode: 404, statusMessage: '婚禮不存在' })
  }
  if (!body?.oaName || !body?.channelId) {
    throw createError({ statusCode: 400, statusMessage: '請輸入 OA 名稱與 Channel ID' })
  }

  const existing = mockLineOas.find(o => o.weddingId === weddingId)
  if (existing) {
    existing.oaName = body.oaName
    existing.channelId = body.channelId
  }
  else {
    mockLineOas.push({ weddingId, oaName: body.oaName, channelId: body.channelId })
  }

  setResponseStatus(event, 201)
  return { weddingId, oaName: body.oaName, channelId: body.channelId }
})
