import { defineConfig } from '@playwright/test'

import baseConfig from './playwright.config'

// 守門 config：主 spec + vibe spec 一次跑完（共用同一個 webServer，避免冷啟動兩次）
// 三個守門入口（/vibe-check、pre-push、未來 CI）都跑這份，確保合約一致
// vibe/unstable/ 為時序敏感 spec 隔離區，不進守門（手動 /vibe-e2e 時照跑）
export default defineConfig({
  ...baseConfig,
  testDir: './test/e2e',
  testMatch: ['specs/**/*.spec.ts', 'vibe/**/*.spec.ts'],
  testIgnore: ['vibe/unstable/**'],
})
