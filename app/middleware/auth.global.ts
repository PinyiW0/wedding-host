// 登入守衛（前端輕量版，mock 階段用；M0 真 auth 時改為以後端 session/token 驗證）
// 未登入訪問需登入頁 → 導向 /login。賓客公開頁與認證頁不攔截。

// 公開頁（不需登入）：認證頁 + 賓客端 LIFF 頁。提到 module scope 避免每次重編譯。
const PUBLIC_PATTERNS = [
  /^\/login/,
  /^\/register/,
  /^\/rsvp(\/|$)/, // 賓客提交 RSVP
  /^\/checkin(\/|$)/, // 賓客自助報到
  /^\/blessing(\/|$)/, // 賓客提交祝福
  /^\/guest(\/|$)/, // 賓客綁定 LINE
]

export default defineNuxtRouteMiddleware((to) => {
  // 守衛只在 client 執行：登入狀態存在 localStorage（persist），SSR 讀不到，避免 SSR 誤判而誤導
  if (import.meta.server)
    return

  // 根路由交給 index.vue 依登入狀態自行導向
  if (to.path === '/' || PUBLIC_PATTERNS.some(re => re.test(to.path)))
    return

  const auth = useAuthStore()
  if (!auth.isAuthenticated)
    return navigateTo('/login')
})
