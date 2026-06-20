// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      // 統一 API domain，可由 NUXT_PUBLIC_API_BASE 覆蓋
      apiBase: '/api',
    },
  },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
  eslint: {
    config: {
      standalone: false,
    },
  },
  css: ['~/assets/css/main.css'],
  // Nuxt UI 配置
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'info', 'success', 'warning', 'error', 'neutral'],
    },
  },
})
