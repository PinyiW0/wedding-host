// 登入守衛（全端：SSR 與 client 都執行）
// 未登入訪問需登入頁 → 導向 /login（SSR 端直接 302，不渲染「未登入版」再由 client 修正——那是 hydration mismatch 的來源）。
// 賓客公開頁與認證頁不攔截。角色守衛：接待員只能進接待台，其餘後台一律導回接待台（API 層權限兜底）。

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
  /^\/schedule(\/|$)/, // 賓客版當日流程
]

// 接待員可進入的後台頁（其餘後台頁一律導回接待台）：接待台 + 投影祝福審核
const RECEPTIONIST_PATTERNS = [
  /^\/reception(\/|$)/,
  /^\/weddings\/[^/]+\/blessings(\/|$)/,
]

// 管理者限定頁（新人帳號管理）：非管理者一律導走（API 層 adminOnly 403 兜底）
const ADMIN_ONLY_PATTERNS = [/^\/users(\/|$)/]

// 擷取路徑中的 weddingId（新人守衛用；提至 module scope 避免每次重編譯）
const WEDDING_PATH_RE = /^\/weddings\/([^/]+)/

export default defineNuxtRouteMiddleware((to) => {
  // 登入狀態存在 cookie（pinia-plugin-persistedstate/nuxt 預設 storage），SSR 讀得到，
  // 因此守衛全端執行——兩端讀同一份狀態，SSR 不會渲染出與 client 不一致的畫面

  if (PUBLIC_PATTERNS.some(re => re.test(to.path)))
    return

  const auth = useAuthStore()

  // 根路由：依登入狀態與角色導向（SSR 直接 302——若留給 index.vue 在 client 導向，
  // 首屏會先渲染 default layout 空殼，hydration 中的 navigateTo 只換 URL 不換畫面，卡在空白頁）
  if (to.path === '/') {
    if (!auth.isAuthenticated)
      return navigateTo('/login', { replace: true })
    if (auth.isReceptionist)
      return navigateTo(`/reception?weddingId=${auth.weddingId ?? 'wedding-001'}`, { replace: true })
    if (auth.isCouple)
      return navigateTo(`/weddings/${auth.weddingId ?? 'wedding-001'}`, { replace: true })
    return navigateTo('/weddings', { replace: true })
  }

  if (!auth.isAuthenticated)
    return navigateTo('/login')

  // 接待員：只能進接待台與投影祝福審核（公開頁已於上方放行、根路由已於上方導向），其餘後台導回接待台
  if (auth.isReceptionist && !RECEPTIONIST_PATTERNS.some(re => re.test(to.path))) {
    const target = `/reception?weddingId=${auth.weddingId ?? 'wedding-001'}`
    if (to.fullPath !== target)
      return navigateTo(target)
  }

  // 管理者限定頁：新人導回自己的婚禮（接待員已在上方被導回接待台）
  if (!auth.isAdmin && ADMIN_ONLY_PATTERNS.some(re => re.test(to.path))) {
    return navigateTo(auth.isCouple && auth.weddingId ? `/weddings/${auth.weddingId}` : '/login')
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
