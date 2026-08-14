# E2E Setup — 測試基礎架構建立

## 目標

建立 Playwright E2E 測試環境，包含設定檔、helpers 和目錄結構。

> **首次執行**：專案尚未有 E2E 測試時執行。
> **已有架構時**：跳過，直接使用 `/test e2e spec` 生成測試。

---

## 前置條件

| 檢查項 | 說明 |
|--------|------|
| `spec/e2e-flows/_common.flow.md` | 由 `/feature-to-flow` Phase 1 產出（共用前置流程） |

> 不存在？提示「請先執行 `/feature-to-flow` 產出 `_common.flow.md`」

---

## 執行步驟

### Step 1：安裝依賴

```bash
npm i -D @playwright/test
npx playwright install chromium
```

### Step 2：確認 playwright.config.ts

檢查 `playwright.config.ts` 是否存在。若不存在，建立。

模板重點（測試環境隔離）：
- **per-worktree 確定性 port**：由 config 所在目錄 hash 出 3100–3499 的 port——同 worktree 每次同 port（`reuseExistingServer` 可安全重用），不同 worktree 不同 port（多 session 並行不互撞）。**不要寫死 port**
- **`E2E_BASE_URL` 外部 server 模式**：存在時整個不掛 webServer（Docker gate 等外部環境直接打該 URL）
- **webServer.env 強制 `NUXT_PUBLIC_API_BASE=/api`**：避免 `.env` 的絕對 URL 讓瀏覽器打錯 port

```typescript
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// === 測試環境隔離：per-worktree 確定性 port ===
// 以本 config 檔所在目錄（= worktree 根目錄）hash 出 port：
// - 同一 worktree 每次算出同一個 port → reuseExistingServer 可安全重用（green loop 快）
// - 不同 worktree（git worktree add 的平行目錄）→ 不同 port → 多 session 並行不互撞
// 純函式推導、無副作用，gate / vibe config 重複 import 本檔也冪等
const worktreeRoot = path.dirname(fileURLToPath(import.meta.url))
const portHash = createHash('md5').update(worktreeRoot).digest().readUInt16BE(0)
const devPort = 3100 + (portHash % 400) // 3100–3499，避開 dev 慣用的 3000

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
          command: `npx nuxt dev --port ${devPort}`,
          url: baseURL,
          // 同 worktree 永遠同 port，重用既有 dev server 是安全的（不會連到別的 worktree）
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
          // 測試時強制 API 走同源相對路徑：.env 若設了絕對 URL（固定 port）會讓瀏覽器打錯 server
          env: { NUXT_PUBLIC_API_BASE: '/api' },
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

### Step 4：建立 Mock Data Reset Endpoint

讓每個 spec 在 `test.beforeEach` 重設 mock 資料，確保測試獨立可執行。

```typescript
// server/api/__test__/reset.post.ts
import type { H3Event } from 'h3'
import { resetMockData } from '~/server/mock/data'

export default defineEventHandler(async (_event: H3Event) => {
  resetMockData()
  return { ok: true }
})
```

> 若 `server/mock/data/index.ts` 尚無 `resetMockData()`，需新增。
> 此函式將所有 mock store 重設為初始值（深拷貝原始資料）。

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
 * v2：表單欄位用 label、送出鈕用 role+name 定位（testid 是 fallback，此處語意 anchor 足夠）。
 * label／按鈕文案依該專案 login 頁調整——UI 側範本見 feature-to-ui/references/page-builder.md「登入表單」。
 *
 * ⚠️ getByLabel 用 `exact: true` 不用 regex：Playwright 的 getByLabel 對**任何**帶 aria-label 的元素
 * 都會回傳該值（不限 form control）。密碼欄內的「顯示/隱藏密碼」切換鈕 aria-label 含「密碼」，
 * 用 /密碼/ 會同時命中 input 與該按鈕 → strict mode violation（實測 count=2）。exact 匹配可避開；
 * UFormField required 的 `*` 是 CSS pseudo，不計入 accessible name，故 exact 安全。
 */
export async function login(page: Page, account: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByLabel('帳號', { exact: true }).fill(account)
  await page.getByLabel('密碼', { exact: true }).fill(password)
  await page.getByRole('button', { name: /登入/ }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))
}

/** USelect 操作：click 打開 → 選擇 option（testId 為 flow 授權的 fallback testid） */
export async function selectOption(page: Page, testId: string, optionName: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: optionName }).click()
}

/** 確認彈窗：等待出現 → 點擊確認（對應 _common.flow.md 確認彈窗 testid）
 * ⚠️ v2 預設用 `maybeConfirm`（dialog scope + 動詞 regex，見 spec.md）；
 * 本 helper 僅用於 flow 明示 testid 的 entity。
 */
export async function confirmDelete(page: Page) {
  await expect(page.getByTestId('confirm-modal')).toBeVisible()
  await page.getByTestId('confirm-ok').click()
}

/** 重設 mock 資料到初始全集（打 /api/__test__/reset 端點），spec 於 test.beforeEach 呼叫確保測試獨立 */
export async function resetMockData(page: Page) {
  await page.request.post('/api/__test__/reset')
}
```

#### fixtures.ts

從 `_common.flow.md` 提取測試帳號和路由：

```typescript
// test/e2e/helpers/fixtures.ts
export const TestUsers = {
  admin: { account: 'admin', password: 'admin888', role: '管理者' },
  observer: { account: 'observer1', password: 'pass123', role: '觀測員' },
  observer2: { account: 'observer2', password: 'pass123', role: '觀測員' },
  locked: { account: 'locked1', password: 'pass123', role: '觀測員' },
} as const

export const Routes = {
  analysis: '/analysis',
  home: '/',
  login: '/login',
  stations: '/stations',
  sites: '/sites',
  trainingHistory: '/trainings/history',
} as const
```

#### hydration.ts

Hydration 守門 fixture：spec 只要從 `../helpers` import `test`，每個測試自動監聽 console、結束時斷言無 hydration 警告。

```typescript
// test/e2e/helpers/hydration.ts
// ⚠️ Vue 只在 dev build 輸出 hydration 警告（webServer 是 nuxt dev 所以攔得到；
//    production build 會 strip，此守門對 prod 模式無效）
import type { ConsoleMessage } from '@playwright/test'
import { expect, test as base } from '@playwright/test'

// 只 match「hydration」：Vue 的 mismatch 警告全部含此字。
// 不單獨 match /mismatch/，避免誤殺應用層 log（如表單驗證訊息）。
const HYDRATION_RE = /hydration/i

interface HydrationFixtures {
  /** 單一 spec 關閉守門：test.use({ failOnHydration: false }) */
  failOnHydration: boolean
  hydrationGuard: void
}

export const test = base.extend<HydrationFixtures>({
  failOnHydration: [true, { option: true }],
  hydrationGuard: [
    async ({ page, failOnHydration }, use) => {
      const hits: string[] = []
      const onConsole = (msg: ConsoleMessage) => {
        if ((msg.type() === 'warning' || msg.type() === 'error') && HYDRATION_RE.test(msg.text()))
          hits.push(`[${msg.type()}] ${msg.text()}`)
      }
      page.on('console', onConsole)
      await use()
      page.off('console', onConsole)
      if (failOnHydration)
        expect(hits, `偵測到 hydration 警告：\n${hits.join('\n')}`).toHaveLength(0)
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
```

#### index.ts

```typescript
// test/e2e/helpers/index.ts
export * from './actions'
export * from './fixtures'
export { expect, test } from './hydration'
```

### Step 6：建立 hydration smoke spec

對每個 route 做**整頁載入**掃描。hydration 只發生在 hard load（`page.goto`）；client-side 導航不會重 hydrate，所以逐 route hard load 即可覆蓋全部 hydration 面。

```typescript
// test/e2e/specs/00-hydration.spec.ts
// ⚠️ 守門效力僅限 dev server（production build 會 strip hydration 警告）
// 此檔直接 import @playwright/test（不走 ../helpers 的 extended test，避免與 auto fixture 重複斷言）
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { login, Routes, TestUsers } from '../helpers'

// 依 Routes 補齊：新頁面上線時記得加進清單
const PUBLIC_PAGES: string[] = [Routes.login]
const AUTH_PAGES: string[] = [Routes.home]

function collectHydrationWarnings(page: Page): string[] {
  const hits: string[] = []
  page.on('console', (msg) => {
    if ((msg.type() === 'warning' || msg.type() === 'error') && /hydration/i.test(msg.text()))
      hits.push(msg.text())
  })
  return hits
}

test.describe('Hydration 守門', () => {
  for (const path of PUBLIC_PAGES) {
    test(`未登入整頁載入 ${path}`, async ({ page }) => {
      const hits = collectHydrationWarnings(page)
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(hits).toEqual([])
    })
  }
  for (const path of AUTH_PAGES) {
    test(`登入後整頁載入 ${path}`, async ({ page }) => {
      await login(page, TestUsers.admin.account, TestUsers.admin.password)
      const hits = collectHydrationWarnings(page)
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(hits).toEqual([])
    })
  }
})
```

### Step 6.5：建立 auth guard smoke spec（僅 `route-map.yaml` 有 `auth` 區塊時）

守衛（`auth.global.ts`）是生成物，沒有測試覆蓋時改壞抓不到（wedding-host 實戰：守衛無測試，重構後壞掉才人工發現）。`route-map.auth.required` 時必建：

```typescript
// test/e2e/specs/01-auth-guard.spec.ts
// 路徑值從 route-map.yaml > auth 讀取（login_path / home_path / public_paths），不寫死
import { expect, test } from '@playwright/test'
import { login, Routes, TestUsers } from '../helpers'

// 受保護路由挑代表頁即可（middleware 全域生效，不必逐頁）；公開頁列 public_paths 中 login 以外者（賓客端）
const PROTECTED_PAGES: string[] = [Routes.home]
const PUBLIC_PAGES: string[] = []

test.describe('Auth 守衛', () => {
  for (const path of PROTECTED_PAGES) {
    test(`未登入訪 ${path} → 導向 login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' })
      await expect(page).toHaveURL(/\/login/)
    })
  }
  for (const path of PUBLIC_PAGES) {
    test(`未登入訪公開頁 ${path} → 不被導去 login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' })
      await expect(page).not.toHaveURL(/\/login/)
    })
  }
  test('已登入訪 login → 導回而非停留', async ({ page }) => {
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(Routes.login, { waitUntil: 'networkidle' })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
```

> 防迴圈驗收（一次導向、無 redundant navigation error）見 feature-to-api `auth-scaffold.md` §5 checklist。

### Step 6.6：建立巢狀 scope smoke spec（僅 route-map endpoints 含 ≥2 個 path 參數的端點時；**不需 rbac**）

巢狀端點漏帶父層過濾是 IDOR（wedding-host 實戰：DELETE 漏帶父層參數，跨租戶可刪）。這層用 Playwright `request` 直打 API、不走 UI：拿「父 A ＋ 屬於父 B 的子」這種**兩者都真實存在、只是關係錯置**的組合——若查詢漏帶父層過濾，這一打就會 200。

```typescript
// test/e2e/specs/02-authz-scope.spec.ts
// 巢狀資源 scope 煙霧：錯誤父子組合必回 404（server-security.md 第 1、2 條的執行防線）
// WRONG_PAIRS 從 route-map.yaml > api_contract.endpoints（≥2 path 參數者）×  mock 種子組出，不寫死假 id
import { expect, test } from '@playwright/test'
import { TestUsers } from '../helpers'

// 有 auth 專案：直打 mock login 換 token——「登入者也不能跨父層」才證明過濾存在（而非只是被登入牆擋）
// 無 auth 專案：刪掉 beforeAll 與 headers。回應依 envelope 模式解包（模式 A 取 .data）
let headers: Record<string, string> = {}
test.beforeAll(async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: { account: TestUsers.admin.account, password: TestUsers.admin.password },
  })
  const data = await res.json()
  headers = { Authorization: `Bearer ${data.accessToken}` }
})

// 每個巢狀端點至少一組：projects/tasks 為假想端點，path 前綴與 id 用 route-map 與 mock 種子實際值
const WRONG_PAIRS = [
  { name: 'GET projects/tasks', method: 'get' as const, path: '/api/projects/proj-001/tasks/task-belongs-to-proj-002' },
  { name: 'DELETE projects/tasks', method: 'delete' as const, path: '/api/projects/proj-001/tasks/task-belongs-to-proj-002' },
]

test.describe('巢狀資源 scope（錯誤父子組合 → 404）', () => {
  for (const { name, method, path } of WRONG_PAIRS) {
    test(`${name}：跨父層存取被拒`, async ({ request }) => {
      const res = await request[method](path, { headers })
      expect(res.status()).toBe(404) // 404 而非 403：不洩漏資源存在性（server-security.md 第 8 條）
    })
  }
})
```

> ⚠️ **寫入端點（PATCH/DELETE）至少各一組**——wedding-host 的漏洞正是 DELETE 漏、GET/PATCH 有；只測 GET 抓不到。
> ⚠️ 之後 sync 新增巢狀端點時，`specs/` 屬凍結區——依 `rules/frozen-paths.md` 的上游變更程序補 WRONG_PAIRS，或另建新 spec 檔。

### Step 7：建立目錄結構

```bash
mkdir -p test/e2e/specs
mkdir -p test/e2e/screenshots
mkdir -p test/e2e/test-results
```

### Step 8：確認 .gitignore

確保測試產物不進 git：

```
# Playwright
test/e2e/test-results/
test/e2e/screenshots/
playwright-report/
```

### Step 9：驗證

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
│   ├── actions.ts                  # 共用操作（login, selectOption, confirmDelete, resetMockData）
│   ├── fixtures.ts                 # 測試資料（帳號、路由）
│   ├── hydration.ts                # Hydration 守門 fixture（auto，dev-only）
│   └── index.ts                    # 匯出
├── specs/                          # .spec.ts 檔案（由 /test e2e spec 產出）
│   ├── 00-hydration.spec.ts        # Hydration smoke（逐 route 整頁載入）
│   ├── 01-auth-guard.spec.ts       # Auth 守衛 smoke（僅 route-map 有 auth 時）
│   └── 02-authz-scope.spec.ts      # 巢狀 scope smoke（僅有 ≥2 path 參數端點時）
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
- test/e2e/helpers/actions.ts（login, selectOption, confirmDelete, resetMockData）
- test/e2e/helpers/fixtures.ts（N 個帳號、N 個路由）
- test/e2e/helpers/hydration.ts（hydration 守門 fixture）
- test/e2e/specs/00-hydration.spec.ts（逐 route hydration smoke）
- test/e2e/specs/01-auth-guard.spec.ts（auth 守衛 smoke；無 auth 專案略）
- test/e2e/specs/02-authz-scope.spec.ts（巢狀 scope smoke；無巢狀端點專案略）

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
- [ ] `actions.ts` 包含 login / selectOption / confirmDelete / resetMockData
- [ ] `fixtures.ts` 包含測試帳號和路由（與 `_common.flow.md` 一致）
- [ ] `hydration.ts` 存在且 `index.ts` re-export `{ expect, test }`
- [ ] `specs/00-hydration.spec.ts` 涵蓋所有 Routes（公開 + 登入後）
- [ ] `route-map.yaml` 有 `auth` 區塊時，`specs/01-auth-guard.spec.ts` 存在（未登入導 login／公開頁不被導走／已登入訪 login 導回）
- [ ] `route-map.yaml > api_contract.endpoints` 有 ≥2 個 path 參數的端點時，`specs/02-authz-scope.spec.ts` 存在且**含寫入端點**的錯誤父子組合
- [ ] `.gitignore` 排除測試產物
- [ ] `npx playwright test --list` 可執行
