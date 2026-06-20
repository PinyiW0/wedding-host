import { defineVitestConfig } from '@nuxt/test-utils/config'

// 單元 / composable 測試走 Nuxt 環境；E2E（test/e2e）由 Playwright 跑，故 include 只收 test/unit
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['test/unit/**/*.{test,spec}.ts'],
  },
})
