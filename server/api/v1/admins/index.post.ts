import type { H3Event } from 'h3'
import type { AdminRegisteredEvent, RegisterAdminBody } from '../../../../app/types/api/auth'

import { mockUsers } from '../../../mock/data/users'

export default defineEventHandler(async (event: H3Event): Promise<AdminRegisteredEvent> => {
  const body = await readBody<RegisterAdminBody>(event)

  if (!body?.email || !body?.displayName) {
    throw createError({ statusCode: 400, statusMessage: '請輸入電子郵件與顯示名稱' })
  }
  if (mockUsers.some(u => u.email === body.email && !u.deletedAt)) {
    throw createError({ statusCode: 409, statusMessage: '此電子郵件已被註冊' })
  }

  const userId = `user-${crypto.randomUUID().slice(0, 8)}`
  mockUsers.push({
    userId,
    username: body.email,
    email: body.email,
    password: '',
    displayName: body.displayName,
    role: '管理者',
    deletedAt: null,
  })

  setResponseStatus(event, 201)
  return { userId, email: body.email, displayName: body.displayName }
})
