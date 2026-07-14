import process from 'node:process'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    // 認證模式（NUXT_AUTH_MODE 覆蓋）：
    //   enforced＝無 token 401、賓客連結需 HMAC 簽名（production build 預設）
    //   open    ＝無 token 退回預設管理員、簽名不強制（dev / e2e 相容模式；有 token 仍走完整驗證）
    authMode: process.env.NODE_ENV === 'production' ? 'enforced' : 'open',
    // 以下 secrets 上線前必須以環境變數覆蓋（NUXT_JWT_SECRET / NUXT_GUEST_LINK_SECRET）
    jwtSecret: 'dev-only-jwt-secret-change-me',
    jwtExpiresIn: '7d',
    guestLinkSecret: 'dev-only-guest-link-secret-change-me',
    // Postgres 連線字串（NUXT_DATABASE_URL 覆蓋；正式環境填 Neon pooled URL）
    // 預設值＝docker-compose 的本機 db 服務，與 drizzle.config.ts 一致
    databaseUrl: 'postgresql://wedding:wedding@localhost:5433/wedding',
    // LINE Messaging API（M4 基礎建設：留空＝維持 mock 行為，填入後 batch-send 走真發送）
    lineChannelAccessToken: '',
    // LINE Login OAuth（M4 賓客綁定）：ID + secret 留空＝bind 頁維持 mock 綁定
    // redirectUri 未設定時以請求 origin 推導（本機開發），正式環境建議明確指定
    lineLoginChannelId: '',
    lineLoginChannelSecret: '',
    lineLoginRedirectUri: '',
    // Cloudflare R2（issue #9）：四項全填＝啟用 presigned 直傳；留空＝圖片維持 dataURL 模式（本機 dev/e2e）
    r2Endpoint: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2Bucket: '',
    public: {
      // R2 公開讀取前綴（NUXT_PUBLIC_R2_PUBLIC_URL）：有值＝前端上傳走 R2、圖片存公開 URL
      r2PublicUrl: '',
      // 統一 API domain，可由 NUXT_PUBLIC_API_BASE 覆蓋
      // 預設空字串：path_prefix（/api/v1）已內嵌在各 *.api.ts 的路徑字串中
      apiBase: '',
      // Sentry 錯誤監控（issue #26）：NUXT_PUBLIC_SENTRY_DSN 有值＝啟用；留空＝完全停用（本機 dev / e2e）
      sentry: {
        dsn: '',
      },
    },
  },
  // Sentry 模組條件載入（issue #26）：DSN 環境變數存在（正式 build）才掛——
  // 模組本身的 build instrumentation 會把本機 dev / e2e gate 拖慢數倍，未啟用時不該付這成本
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    ...(process.env.NUXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN ? ['@sentry/nuxt/module'] : []),
  ],
  // 共用元件不加目錄前綴：app/components/common 下以原檔名 auto-import
  // （頁面以 <PageHeader>/<ConfirmModal>/<EmptyState> 直接引用，不需 Common 前綴）
  components: [{ path: '~/components', pathPrefix: false }],
  eslint: {
    config: {
      standalone: false,
    },
  },
  css: ['~/assets/css/main.css'],
  // 全站安全標頭（issue #70 / M7）：防點擊劫持與 MIME sniff；
  // 嚴格 CSP 因可能影響現有 inline 樣式暫緩，列後續（見 docs/security.md）
  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  },
  // SEO / Meta（來源：spec/ui-config/ui-config.yaml）
  app: {
    head: {
      htmlAttrs: { lang: 'zh-TW' },
      title: 'EverAfter',
      meta: [
        {
          name: 'description',
          content:
            'Every love story deserves a beautiful EverAfter.每段愛情，都值得擁有美好的幸福結局',
        },
        {
          name: 'keywords',
          content:
            'wedding, wedding planning, wedding venue, bridal gown, wedding photographer,wedding invitation, wedding checklist, wedding inspiration, wedding vendors,wedding services',
        },
        { name: 'author', content: 'Andrea' },
        { property: 'og:title', content: 'EverAfter' },
        {
          property: 'og:description',
          content:
            'Every love story deserves a beautiful EverAfter.每段愛情，都值得擁有美好的幸福結局',
        },
        { property: 'og:image', content: '/og-image.png' },
        { property: 'og:type', content: 'website' },
      ],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },
  // Nuxt UI 配置
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'info', 'success', 'warning', 'error', 'neutral'],
    },
    // 整站鎖定 light 模式（issue #82）：不掛 @nuxtjs/color-mode，
    // 瀏覽器 dark 模式不會在 <html> 加 .dark class，dark: 樣式永不生效
    colorMode: false,
  },
  // 字體（Editorial Luxe）：build 期由 @nuxt/fonts 下載自我托管，離線穩定
  // 名稱須與 main.css @theme 的 --font-* 完全一致
  fonts: {
    families: [
      { name: 'Cormorant', provider: 'google', weights: [500, 600, 700] },
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Noto Sans TC', provider: 'google', weights: [400, 500, 700] },
    ],
  },
})
