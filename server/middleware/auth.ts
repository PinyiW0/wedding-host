// 統一認證中介層：/api/v1/** 的 JWT 驗證、RBAC、婚禮資源授權、賓客連結簽名
// authMode（runtimeConfig）：
//   enforced＝無 token 401、賓客連結需簽名（production 預設）
//   open    ＝無 token 退回預設管理員、簽名不強制（dev／e2e 相容；有 token 仍完整驗證）
import type { MockUser } from '../mock/data/users'
import type { AuthTokenPayload } from '../utils/jwt'
import type { RouteAccess } from '../utils/route-auth'

import { mockReceptionAccounts } from '../mock/data/accounts'
import { getMockCurrentUser, mockUsers } from '../mock/data/users'
import { mockWeddings } from '../mock/data/weddings'

// JWT 主體回查為完整使用者（帳號已刪除則視為無效）
function resolveAuthUser(payload: AuthTokenPayload): MockUser | null {
  const user = mockUsers.find(u => u.userId === payload.userId && !u.deletedAt)
  if (user)
    return user
  const account = mockReceptionAccounts.find(a => a.accountId === payload.userId)
  if (account) {
    return {
      userId: account.accountId,
      username: account.username,
      email: '',
      passwordHash: '',
      displayName: account.username,
      role: '接待員',
      weddingId: account.weddingId,
      deletedAt: null,
    }
  }
  return null
}

// 婚禮範圍授權：新人限自有婚禮、接待員限綁定婚禮、管理者跨場放行
// 婚禮不存在時放行給 handler 回 404（保留 not-found 語意）
function assertWeddingScope(user: MockUser, weddingId: string): void {
  if (user.role === '新人') {
    const wedding = mockWeddings.find(w => w.weddingId === weddingId)
    if (wedding && wedding.ownerId !== user.userId)
      throw createError({ statusCode: 403, statusMessage: '無權存取此婚禮' })
  }
  if (user.role === '接待員' && user.weddingId !== weddingId) {
    throw createError({ statusCode: 403, statusMessage: '無權存取此婚禮' })
  }
}

// 角色授權：管理者一律放行；adminOnly 擋新人；接待員僅白名單
function assertRouteRole(route: RouteAccess, user: MockUser): void {
  if (user.role === '管理者' || route.kind !== 'auth')
    return
  if (route.adminOnly)
    throw createError({ statusCode: 403, statusMessage: '只有管理者可以執行此操作' })
  if (user.role === '接待員' && !route.receptionist)
    throw createError({ statusCode: 403, statusMessage: '接待帳號無權執行此操作' })
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  if (!pathname.startsWith('/api/'))
    return

  const enforced = useRuntimeConfig().authMode === 'enforced'

  // 測試專用端點（reset）僅存在於 open 模式，正式環境 404
  if (pathname.startsWith('/api/__test__')) {
    if (enforced)
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    return
  }

  if (!pathname.startsWith('/api/v1/'))
    return

  const route = classifyRoute(event.method, pathname)
  if (route.kind === 'public')
    return

  // 解析 Bearer token：有效即掛上 context；enforced 下無效 token 直接 401
  const header = getHeader(event, 'authorization')
  let user: MockUser | null = null
  if (header?.startsWith('Bearer ')) {
    const payload = await verifyAuthToken(header.slice(7))
    if (payload)
      user = resolveAuthUser(payload)
    if (!user && enforced)
      throw createError({ statusCode: 401, statusMessage: '登入已過期，請重新登入' })
  }

  const weddingId = 'weddingId' in route ? route.weddingId : null

  if (user) {
    event.context.authUser = user
    if (weddingId)
      assertWeddingScope(user, weddingId)
    assertRouteRole(route, user)
    return
  }

  // 未登入 × 分享／賓客連結：驗 HMAC 簽名（open 模式不強制，凍結 e2e 用裸 URL）
  if (route.kind === 'share' || route.kind === 'guest') {
    if (!enforced)
      return
    const query = getQuery(event)
    const sig = getHeader(event, 'x-guest-sig') || (typeof query.sig === 'string' ? query.sig : undefined)
    const valid = !!sig && !!weddingId
      && verifyLinkSig(sig, weddingId, route.kind === 'guest' ? route.guestId : undefined)
    if (!valid)
      throw createError({ statusCode: 403, statusMessage: '連結無效或已失效' })
    return
  }

  // 未登入 × 管理端路由
  if (enforced)
    throw createError({ statusCode: 401, statusMessage: '請先登入' })
  // open 模式相容行為：退回預設管理員（凍結 e2e 直打 API 依賴此行為）
  event.context.authUser = getMockCurrentUser()
})
