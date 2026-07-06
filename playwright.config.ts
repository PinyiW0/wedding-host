import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// === 測試環境隔離（issue #12，自 Nuxt4-template-SDD 搬移）===
// 以本 config 檔所在目錄（= worktree 根目錄）hash 出確定性 port：
// - 同一 worktree 每次算出同一個 port → reuseExistingServer 可安全重用（green loop 快）
// - 不同 worktree（git worktree add 的平行目錄）→ 不同 port → 多 session 並行不互撞
// - 與 dev 慣用的 3000/3001 分離 → 殘留／hang 住的 dev server 不再讓 gate 假紅
// 已知限制：本機模式的 Postgres 仍共用 docker compose 的 5433，多 worktree「同時」跑
// e2e 會互踩 reset；需要完全隔離時走 Docker gate（scripts/docker-gate.sh，ephemeral DB）
const worktreeRoot = path.dirname(fileURLToPath(import.meta.url))
const portHash = createHash('md5').update(worktreeRoot).digest().readUInt16BE(0)
const devPort = 3100 + (portHash % 400) // 3100–3499

// E2E_BASE_URL 存在（Docker gate / 外部 server 模式）→ 直接打該 URL，不啟本機 dev server
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${devPort}`

export default defineConfig({
  testDir: './test/e2e/specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'zh-TW',
    viewport: { width: 1280, height: 720 },
  },
  outputDir: 'test/e2e/test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Docker gate 模式（E2E_BASE_URL）不掛 webServer，由外部 container 提供受測 server
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          // 走 npm run dev 讓 predev 自動拉起 docker postgres（-- 後的 args 附加到 dev script 尾端）
          command: `npm run dev -- --port ${devPort}`,
          url: baseURL,
          // 同 worktree 永遠同 port，重用既有 e2e server 是安全的（不會連到別的 worktree）
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
          // 顯式指定認證相容模式（dev 預設即 open，此處防環境變數污染）：
          // 凍結 spec 以裸 URL／無 token 直打 API，需 open 模式的簽名不強制與預設管理員 fallback
          // NUXT_PUBLIC_API_BASE 強制同源相對路徑：.env 若設了絕對 URL（固定 port）會讓瀏覽器打錯 server
          // （本專案 apiBase 是 ofetch baseURL、路徑自帶 /api 前綴，同源值為空字串而非 '/api'）
          env: { NUXT_AUTH_MODE: 'open', NUXT_PUBLIC_API_BASE: '' },
        },
      }),
})
