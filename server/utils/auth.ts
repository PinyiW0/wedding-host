import type { H3Event } from 'h3'
import type { MockUser } from '../mock/data/users'

import { getMockCurrentUser, mockUsers } from '../mock/data/users'

// 解析 mock-token-<userId>-<ts>（提至 module scope 避免每次重編譯）
const BEARER_TOKEN_RE = /^Bearer\s+mock-token-(.+)-\d+$/

// 從 Authorization: Bearer mock-token-<userId>-<ts> 解析登入者。
// 無 token 或解析不到時退回預設管理員——保持「模板無真 auth」的既有行為，
// 讓不帶 token 的直接 API 呼叫（含現有 e2e）行為不變；有登入的前端請求才走真實身分。
export function getRequestUser(event: H3Event): MockUser {
  const header = getHeader(event, 'authorization') || ''
  const match = header.match(BEARER_TOKEN_RE)
  if (match) {
    const userId = match[1]
    const user = mockUsers.find(u => u.userId === userId && !u.deletedAt)
    if (user)
      return user
  }
  return getMockCurrentUser()
}

// 新人僅能存取自己擁有的婚禮；非擁有者擲出 403。其餘角色（管理者／接待員／無 token）放行。
export function assertWeddingAccess(user: MockUser, ownerId: string | null | undefined): void {
  if (user.role === '新人' && ownerId !== user.userId) {
    throw createError({ statusCode: 403, statusMessage: '無權存取此婚禮' })
  }
}
