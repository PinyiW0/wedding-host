// 登入守衛（前端輕量版，mock 階段用；M0 真 auth 時改為以後端 session/token 驗證）
// 未登入訪問需登入頁 → 導向 /login。賓客公開頁與認證頁不攔截。
// 角色守衛：接待員只能進接待台，其餘後台一律導回接待台（API 層權限留待 M0 真 auth）。

// 公開頁（不需登入）：認證頁 + 賓客端 LIFF 頁。提到 module scope 避免每次重編譯。
const PUBLIC_PATTERNS = [
  /^\/login/,
  /^\/register/,
  /^\/rsvp(\/|$)/, // 賓客提交 RSVP
  /^\/checkin(\/|$)/, // 賓客自助報到
  /^\/blessing(\/|$)/, // 賓客提交祝福
  /^\/guest(\/|$)/, // 賓客綁定 LINE
  /^\/flowers(\/|$)/, // 賓客花田 landing
  /^\/thankyou(\/|$)/, // 賓客公開謝卡
  /^\/projection(\/|$)/, // 投影即時牆
  /^\/rundown(\/|$)/, // 工作人員公開流程表
]

// 接待員可進入的後台頁（其餘後台頁一律導回接待台）：接待台 + 投影祝福審核
const RECEPTIONIST_PATTERNS = [
  /^\/reception(\/|$)/,
  /^\/weddings\/[^/]+\/blessings(\/|$)/,
]

// 擷取路徑中的 weddingId（新人守衛用；提至 module scope 避免每次重編譯）
const WEDDING_PATH_RE = /^\/weddings\/([^/]+)/

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

  // 接待員：只能進接待台與投影祝福審核（公開頁與根路由已於上方放行），其餘後台導回接待台
  if (auth.isReceptionist && !RECEPTIONIST_PATTERNS.some(re => re.test(to.path))) {
    const target = `/reception?weddingId=${auth.weddingId ?? 'wedding-001'}`
    if (to.fullPath !== target)
      return navigateTo(target)
  }

  // 新人：只能進自己的婚禮；存取全部婚禮列表或他人婚禮時導回自己的婚禮
  if (auth.isCouple && auth.weddingId) {
    const matched = to.path.match(WEDDING_PATH_RE)
    const isOtherWedding = matched && matched[1] !== auth.weddingId
    const isWeddingsList = to.path === '/weddings'
    if (isWeddingsList || isOtherWedding) {
      const target = `/weddings/${auth.weddingId}`
      if (to.fullPath !== target)
        return navigateTo(target)
    }
  }
})
