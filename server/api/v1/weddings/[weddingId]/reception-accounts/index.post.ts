import type { H3Event } from 'h3'
import type { CreateReceptionAccountBody, ReceptionAccountCreatedEvent } from '../../../../../../app/types/api/accounts'

import { mockReceptionAccounts } from '../../../../../mock/data/accounts'

export default defineEventHandler(async (event: H3Event): Promise<ReceptionAccountCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateReceptionAccountBody>(event)

  if (!body?.username) {
    throw createError({ statusCode: 400, statusMessage: '請輸入帳號名稱' })
  }
  if (mockReceptionAccounts.some(a => a.weddingId === weddingId && a.username === body.username)) {
    throw createError({ statusCode: 409, statusMessage: '帳號名稱已存在' })
  }

  const accountId = `account-${crypto.randomUUID().slice(0, 8)}`
  mockReceptionAccounts.push({ accountId, weddingId, username: body.username })

  setResponseStatus(event, 201)
  return { accountId, weddingId, username: body.username }
})
