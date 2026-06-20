import { defineConfig } from '@playwright/test'

import baseConfig from './playwright.config'

// Vibe spec 專用設定：繼承主 config，只切換 testDir 到 test/e2e/vibe
// 主 config 一律不動（凍結合約），vibe 流程獨立跑於此 config
export default defineConfig({
  ...baseConfig,
  testDir: './test/e2e/vibe',
  outputDir: 'test/e2e/test-results-vibe',
})
