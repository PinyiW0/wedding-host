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
    // LINE Messaging API（M4 基礎建設：留空＝維持 mock 行為，填入後 batch-send 走真發送）
    lineChannelAccessToken: '',
    public: {
      // 統一 API domain，可由 NUXT_PUBLIC_API_BASE 覆蓋
      // 預設空字串：path_prefix（/api/v1）已內嵌在各 *.api.ts 的路徑字串中
      apiBase: '',
    },
  },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
  // 共用元件不加目錄前綴：app/components/common 下以原檔名 auto-import
  // （頁面以 <PageHeader>/<ConfirmModal>/<EmptyState> 直接引用，不需 Common 前綴）
  components: [{ path: '~/components', pathPrefix: false }],
  eslint: {
    config: {
      standalone: false,
    },
  },
  css: ['~/assets/css/main.css'],
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
