import type { H3Event } from 'h3'
import type { LoginBody, UserLoggedInEvent } from '../../../../app/types/api/auth'

import { mockUsers } from '../../../mock/data/users'

export default defineEventHandler(async (event: H3Event): Promise<UserLoggedInEvent> => {
  const body = await readBody<LoginBody>(event)

  if (!body?.username || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: '請輸入帳號與密碼' })
  }

  const user = mockUsers.find(u => u.username === body.username && !u.deletedAt)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: '帳號不存在' })
  }
  if (user.password !== body.password) {
    throw createError({ statusCode: 401, statusMessage: '帳號或密碼錯誤' })
  }

  setResponseStatus(event, 201)
  return {
    userId: user.userId,
    username: user.username,
    role: user.role,
    accessToken: `mock-token-${user.userId}-${Date.now()}`,
  }
})
