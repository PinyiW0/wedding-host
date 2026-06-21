import type { H3Event } from 'h3'

import { mockReceptionAccounts } from '../../../../../mock/data/accounts'

export default defineEventHandler((event: H3Event) => {
  const accountId = getRouterParam(event, 'accountId')
  const index = mockReceptionAccounts.findIndex(a => a.accountId === accountId)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: '接待帳號不存在' })
  }
  mockReceptionAccounts.splice(index, 1)

  setResponseStatus(event, 204)
})
