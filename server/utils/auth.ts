import type { H3Event } from 'h3'
import type { MockUser } from '../mock/data/users'

import { getMockCurrentUser } from '../mock/data/users'

declare module 'h3' {
  interface H3EventContext {
    // 由 server/middleware/auth.ts 驗證 JWT 後掛上
    authUser?: MockUser
  }
}

// 取得當前請求的使用者。JWT 驗證與授權（RBAC／婚禮範圍）由統一中介層完成；
// 無使用者時退回預設管理員——僅發生於分享/賓客簽名的匿名請求與 open 模式，
// enforced 模式的管理端路由在中介層即被 401 擋下，不會走到 fallback。
export function getRequestUser(event: H3Event): MockUser {
  return event.context.authUser ?? getMockCurrentUser()
}

// 新人僅能存取自己擁有的婚禮；非擁有者擲出 403。
// 中介層已對 /weddings/[weddingId]/** 做過相同檢查，此函式保留給
// handler 內對「非路徑上的 weddingId」（如查詢結果的關聯資源）做二次確認。
export function assertWeddingAccess(user: MockUser, ownerId: string | null | undefined): void {
  if (user.role === '新人' && ownerId !== user.userId) {
    throw createError({ statusCode: 403, statusMessage: '無權存取此婚禮' })
  }
}
