import { defineVitestConfig } from '@nuxt/test-utils/config'

// 單元 / composable 測試走 Nuxt 環境；E2E（test/e2e）由 Playwright 跑，故 include 只收 test/unit
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['test/unit/**/*.{test,spec}.ts'],
    environmentOptions: {
      nuxt: {
        overrides: {
          // 本專案 apiBase 預設空字串（前綴內嵌於 *.api.ts 路徑），
          // useHttp 煙霧測試需驗證 baseURL 有套上，故測試環境固定給 /api
          runtimeConfig: {
            public: { apiBase: '/api' },
          },
        },
      },
    },
  },
})
