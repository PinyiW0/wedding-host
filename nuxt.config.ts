// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
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
