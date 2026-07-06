# E2E Setup — 測試基礎架構建立

## 目標

建立 Playwright E2E 測試環境，包含設定檔、helpers 和目錄結構。

> **首次執行**：專案尚未有 E2E 測試時執行。
> **已有架構時**：跳過，直接使用 `/test e2e spec` 生成測試。

---

## 前置條件

| 檢查項 | 說明 |
|--------|------|
| `spec/e2e-flows/_common.flow.md` | 外部產出，手動放入 |

> 不存在？提示「請先將 `_common.flow.md` 放入 `spec/e2e-flows/`」

---

## 執行步驟

### Step 1：安裝依賴

```bash
npm i -D @playwright/test
npx playwright install chromium
```

### Step 2：確認 playwright.config.ts

檢查 `playwright.config.ts` 是否存在。若不存在，建立。

模板重點（測試環境隔離，issue #12）：
- **per-worktree 確定性 port**：由 config 所在目錄 hash 出 3100–3499 的 port——同 worktree 每次同 port（`reuseExistingServer` 可安全重用），不同 worktree 不同 port（多 session 並行不互撞）。**不要寫死 port**
- **`E2E_BASE_URL` 外部 server 模式**：存在時整個不掛 webServer（Docker gate 等外部環境直接打該 URL）
- **本專案 webServer 走 `npm run dev`**（predev 自動拉 docker postgres），不可用 `npx nuxt dev`
- **webServer.env 強制 `NUXT_PUBLIC_API_BASE=''`**：避免 `.env` 的絕對 URL 讓瀏覽器打錯 port（本專案 apiBase 是 ofetch baseURL、路徑自帶 /api 前綴，同源值為空字串）

```typescript
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// === 測試環境隔離：per-worktree 確定性 port ===
const worktreeRoot = path.dirname(fileURLToPath(import.meta.url))
const portHash = createHash('md5').update(worktreeRoot).digest().readUInt16BE(0)
const devPort = 3100 + (portHash % 400) // 3100–3499，避開 dev 慣用的 3000/3001

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
          command: `npm run dev -- --port ${devPort}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
          env: { NUXT_AUTH_MODE: 'open', NUXT_PUBLIC_API_BASE: '' },
        },
      }),
})
```

### Step 3：確認 package.json 指令

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### Step 4：建立 Reset Endpoint

讓每個 spec 在 `test.beforeEach` 重設資料，確保測試獨立可執行。

本專案（M0-b 之後）為真 DB 版：truncate 全表後回填 seed（mock 陣列為唯一 seed 源）。

```typescript
// server/api/__test__/reset.post.ts
import type { H3Event } from 'h3'

import { useDb } from '../../db'
import { resetDb } from '../../db/seed'

export default defineEventHandler(async (_event: H3Event) => {
  await resetDb(useDb())
  return { ok: true }
})
```

> enforced 模式（production 預設）下此端點被 auth middleware 直接 404；
> e2e／Docker gate 以 `NUXT_AUTH_MODE=open` 執行，端點才可用。

### Step 5：建立 helpers

#### actions.ts

從 `_common.flow.md` 的共用步驟提取為 Playwright helper：

```typescript
// test/e2e/helpers/actions.ts
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * 登入操作（對應 _common.flow.md「{role} "{account}" 已登入」）
 * ⚠️ 等待條件：離開 /login 頁面（不寫死目標 URL，因為根路由可能 redirect）
 */
export async function login(page: Page, account: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByTestId('login-account').fill(account)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))
}

/** USelect 操作：click 打開 → 選擇 option */
export async function selectOption(page: Page, testId: string, optionName: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: optionName }).click()
}

/** 確認彈窗：等待出現 → 點擊確認（對應 _common.flow.md 確認彈窗 testid） */
export async function confirmDelete(page: Page) {
  await expect(page.getByTestId('confirm-modal')).toBeVisible()
  await page.getByTestId('confirm-ok').click()
}
```

#### fixtures.ts

從 `_common.flow.md` 提取測試帳號和路由：

```typescript
// test/e2e/helpers/fixtures.ts
export const TestUsers = {
  admin: { account: 'admin', password: 'pass123', role: '管理者' },
  coach: { account: 'coach1', password: 'pass123', role: '教練' },
  coach2: { account: 'coach2', password: 'pass123', role: '教練' },
  locked: { account: 'locked1', password: 'pass123', role: '教練' },
} as const

export const Routes = {
  analysis: '/analysis',
  home: '/',
  login: '/login',
  players: '/players',
  teams: '/teams',
  trainingHistory: '/trainings/history',
} as const
```

#### index.ts

```typescript
// test/e2e/helpers/index.ts
export * from './actions'
export * from './fixtures'
```

### Step 6：建立目錄結構

```bash
mkdir -p test/e2e/specs
mkdir -p test/e2e/screenshots
mkdir -p test/e2e/test-results
```

### Step 7：確認 .gitignore

確保測試產物不進 git：

```
# Playwright
test/e2e/test-results/
test/e2e/screenshots/
playwright-report/
```

### Step 8：驗證

```bash
# 確認 Playwright 可執行
npx playwright test --list
```

---

## 產出結構

```
playwright.config.ts                # Playwright 設定
server/api/__test__/reset.post.ts   # Mock data reset endpoint
test/e2e/
├── helpers/
│   ├── actions.ts                  # 共用操作（login, selectOption, confirmDelete）
│   ├── fixtures.ts                 # 測試資料（帳號、路由）
│   └── index.ts                    # 匯出
├── specs/                          # .spec.ts 檔案（由 /test e2e spec 產出）
├── test-results/                   # Playwright 測試結果
└── screenshots/                    # 測試失敗截圖
```

---

## 完成摘要格式

```
E2E Setup 完成

已建立/確認：
- playwright.config.ts ✅
- package.json scripts ✅
- server/api/__test__/reset.post.ts ✅
- test/e2e/helpers/actions.ts（login, selectOption, confirmDelete）
- test/e2e/helpers/fixtures.ts（N 個帳號、N 個路由）

下一步：
- 執行 /test e2e spec <feature> 生成測試檔案
- 執行 npm run test:e2e 跑測試
```

---

## 檢查清單

- [ ] `@playwright/test` 已安裝
- [ ] `playwright.config.ts` 存在且指向 `test/e2e/specs`
- [ ] `package.json` 有 `test:e2e` / `test:e2e:headed` / `test:e2e:ui` 指令
- [ ] `server/api/__test__/reset.post.ts` 存在且 `resetMockData()` 可用
- [ ] `actions.ts` 包含 login / selectOption / confirmDelete
- [ ] `fixtures.ts` 包含測試帳號和路由（與 `_common.flow.md` 一致）
- [ ] `.gitignore` 排除測試產物
- [ ] `npx playwright test --list` 可執行
