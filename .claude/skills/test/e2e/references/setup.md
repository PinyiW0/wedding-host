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
- **`E2E_BASE_URL` 外部 server 模式**：存在時整個不掛 webServer（CI 的 e2e job、`scripts/docker-gate.sh` 等外部起好的 production server 直接打該 URL）
- **webServer.env 強制 API base 變數為 nuxt.config 的預設值**（本模板為 `/api`；怎麼推導見下方）：避免 `.env` 的絕對 URL 讓瀏覽器打錯 port，或讓 E2E 打到真後端

**API base 變數名要從專案推導，不照抄**。先讀 `nuxt.config.ts` 的 `runtimeConfig.public`，找出存 API 網址的那個鍵（`useHttp` 或 `$fetch` 的 `baseURL` 讀的那個）。再依 Nuxt 慣例換成環境變數名：加 `NUXT_PUBLIC_` 前綴，駝峰拆成底線、全大寫。

| `runtimeConfig.public` 的鍵 | 環境變數名 |
|------|------|
| `apiBase`（本模板） | `NUXT_PUBLIC_API_BASE` |
| `baseApiUrl` | `NUXT_PUBLIC_BASE_API_URL` |

下方範本的 `<API_BASE_ENV>` 換成推導出的名字。找不到這種鍵、或有多個候選時，停下來問使用者，不要猜。

**強制的值也要從專案推導，不照抄 `/api`**。值 ＝ `nuxt.config.ts` 裡那個鍵的**預設值**，也就是「接本地 Nitro mock」的值；`.env` 才是把它覆寫成真後端網址的地方。E2E 打的是 mock，所以強制回預設值就對了。

| 專案 | `nuxt.config.ts` 預設值 | 強制的值 `<MOCK_API_BASE>` |
|------|------|------|
| 本模板（`apiBase: '/api'`，client 寫 `/notes`） | `/api` | `'/api'` |
| 下游專案例（非本模板）：client 已寫完整路徑 `/api/v1/...`、預設 `baseApiUrl: ''`（空字串＝接內建 mock） | `''` | `''` |

預設值若是絕對網址（`http://...`），代表該專案沒有「同源 mock」這條路，停下來問使用者，不要猜。

值是空字串時，三處要照各自語法寫出「空字串」，不能留成「沒有值」：playwright.config.ts 寫 `''`；workflow 的 YAML 寫 `KEY: ''`（寫成 `KEY:` 會被解析成 null）；docker-gate.sh 寫 `-e KEY=`（等號後直接接空白）。

同一個變數名與同一個值還寫在另外兩處，要跟著換成同一個名字、同一個值（這兩處是 `E2E_BASE_URL` 模式的保險，那時不掛 webServer，上面的 env 套不到）：
- `scripts/docker-gate.sh`：`docker run` 那行的 `-e <API_BASE_ENV>=<MOCK_API_BASE>`（本模板為 `-e NUXT_PUBLIC_API_BASE=/api`）
- `.github/workflows/pull_request.yml`：`Start production server` step 的 `env:` 裡的 `<API_BASE_ENV>: <MOCK_API_BASE>`（本模板為 `NUXT_PUBLIC_API_BASE: /api`）

三處名字或值不一致時，被漏掉的那條路徑會照 `.env` 打出去，或鎖到錯的 API 模式。

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
          // 測試時強制 API 走本地 mock：.env 若設了絕對 URL（固定 port）會讓瀏覽器打錯 server
          // <API_BASE_ENV> 換成從 runtimeConfig.public 推導的變數名（本模板為 NUXT_PUBLIC_API_BASE）
          // <MOCK_API_BASE> 換成 nuxt.config.ts 該鍵的預設值（本模板為 '/api'；預設 '' 的專案就填 ''）
          env: { <API_BASE_ENV>: <MOCK_API_BASE> },
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

body 可選 `{ empty?: string[] }`：`empty` 內列出的集合，重設回初始值後**再清空**。
空狀態 Scenario 中沒有刪除端點的資源，靠這條通道構造初始狀態，優於憑空新增業務刪除 API；
也順帶解掉種子與建立類 Scenario 撞號——先清空集合再照 flow 原字面值建立，不必改名遷就種子。

```typescript
// server/api/__test__/reset.post.ts
// defineEventHandler／readBody／createError／useRuntimeConfig 是 Nitro server 端 auto-import，不必手動 import
import type { H3Event } from 'h3'
import { z } from 'zod'
// ⚠️ 用 ~~（root alias）不用 ~：server 端的 ~ 對應 app/，~/server/... 解析不到（issue #137 實測）
import { resetMockData } from '~~/server/mock/data'

// 集合名白名單：z.enum 只認真實存在的 mock 集合名，任意鍵（含 __proto__）一律 400。
// notes／tags 為示意集合名，依專案實際 mock store 名稱調整（不要照抄成真實端點名）。
const resetBodySchema = z.object({
  empty: z.array(z.enum(['notes', 'tags'])).optional(),
}).strict()

// 測試專用端點：dev 模式存在；production build 預設 404，不隨 app 上生產。
// 唯一例外是 runtimeConfig.e2eReset（env NUXT_E2E_RESET=true，Nitro 用 destr 轉布林）：
// CI 的 e2e job 與 scripts/docker-gate.sh 跑 production build 全量時靠它開門——
// 沒有這個例外，production 下每支 spec 的 beforeEach → resetMockData 會先拿到 404 而炸（#150）。
// 部署環境不得設此變數；不直讀 process.env（rules/server-security.md：env 一律走 runtimeConfig）。
export default defineEventHandler(async (event: H3Event) => {
  if (!import.meta.dev && !useRuntimeConfig(event).e2eReset)
    throw createError({ statusCode: 404 })

  // 不吞掉解析失敗：非法 JSON 明確回 400，不要讓壞 body 被當成空 body 而通過
  const body = await readBody(event).catch(() => {
    throw createError({ statusCode: 400, message: '輸入格式錯誤' })
  })
  const parsed = resetBodySchema.safeParse(body ?? {})
  if (!parsed.success)
    throw createError({ statusCode: 400, message: '輸入格式錯誤' })

  resetMockData({ empty: parsed.data.empty })
  return { ok: true }
})
```

`nuxt.config.ts` 要有私有鍵 `runtimeConfig.e2eReset: false`（模板已內建；專案的 nuxt.config 缺這個鍵就補上，否則 `useRuntimeConfig(event).e2eReset` 型別推不出來）。
型別由 Nuxt 從 nuxt.config 推導，端點內直接是 boolean，不必自己轉。

> 若 `server/mock/data/index.ts` 尚無 `resetMockData()`，需新增，並支援 `{ empty?: string[] }`：
>
> ```typescript
> // server/mock/data/index.ts（示意）
> export function resetMockData(options?: { empty?: string[] }) {
>   // 先深拷貝回初始資料，避免前次測試殘留污染
>   mockNotes.length = 0
>   mockNotes.push(...structuredClone(initialNotes))
>   mockTags.length = 0
>   mockTags.push(...structuredClone(initialTags))
>
>   // 空狀態 Scenario 用：初始化之後再清空指定集合
>   for (const name of options?.empty ?? []) {
>     if (name === 'notes')
>       mockNotes.length = 0
>     if (name === 'tags')
>       mockTags.length = 0
>   }
> }
> ```
>
> **本專案差異**：reset 端點不讀 `runtimeConfig.e2eReset`，改由 `server/middleware/auth.ts` 把關：只在 `authMode=open` 放行，enforced 一律 404。
> 端點內容是 truncate 全表後回填 seed（`server/db/seed` 的 `resetDb`），不是 mock store。
> production build 跑 gate 時（CI e2e job、`scripts/docker-gate.sh`）靠 `NUXT_AUTH_MODE=open` 開門，部署環境不得設。

### Step 5：建立 helpers

#### actions.ts

從 `_common.flow.md` 的共用步驟提取為 Playwright helper：

```typescript
// test/e2e/helpers/actions.ts
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { matchesRoutePattern } from './route-match'

// 送出鈕文案：提到 module 層（不寫在 login() 內）——inline regex literal 每次呼叫都重新編譯，
// 觸發 eslint e18e/prefer-static-regex
const LOGIN_BUTTON = /登入/

/**
 * 登入操作（對應 _common.flow.md「{role} "{account}" 已登入」）
 * ⚠️ 等待條件：離開 /login 頁面（不寫死目標 URL，因為根路由可能 redirect）
 * 表單欄位用 label、送出鈕用 role+name 定位（testid 是 fallback，此處語意 anchor 足夠）。
 * label／按鈕文案依該專案 login 頁調整——UI 側範本見 feature-to-ui/references/page-builder.md「登入表單」。
 *
 * ⚠️ getByLabel 用 `exact: true` 不用 regex：Playwright 的 getByLabel 對**任何**帶 aria-label 的元素
 * 都會回傳該值（不限 form control）。密碼欄內顯示／隱藏密碼的切換鈕 aria-label 是「顯示密碼」／
 * 「隱藏密碼」（page-builder 範本刻意保留，為了 a11y 可讀性），含「密碼」這個欄位名子字串——
 * 用 regex `/密碼/` 會同時命中 input 與切換鈕（strict mode violation，實測 count=2）；exact: true
 * 只精確匹配「密碼」二字，才能跟「顯示密碼」／「隱藏密碼」分開，這裡是必要寫法，不是防禦性保留。
 * UFormField required 的 `*` 是 CSS pseudo，不計入 accessible name，故 exact 安全。
 *
 * ⚠️ 離開判斷用 `matchesRoutePattern`（見 `route-match.ts`）不用 `startsWith('/login')`：
 * startsWith 是字面前綴比對，會誤中同前綴的兄弟路由（如 `/login-recovery`），
 * 導致登入後仍被判定「還在 login 頁」而卡住等待（issue #137）。
 */
export async function login(page: Page, account: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByLabel('帳號', { exact: true }).fill(account)
  await page.getByLabel('密碼', { exact: true }).fill(password)
  await page.getByRole('button', { name: LOGIN_BUTTON }).click()
  await page.waitForURL(url => !matchesRoutePattern('/login', url.pathname))
}

/** USelect 操作：click 打開 → 選擇 option（testId 為 flow 授權的 fallback testid） */
export async function selectOption(page: Page, testId: string, optionName: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: optionName }).click()
}

/** 確認彈窗：等待出現 → 點擊確認（對應 _common.flow.md 確認彈窗 testid）
 * ⚠️ 預設用 `maybeConfirm`（dialog scope + 動詞 regex，見 spec.md）；
 * 本 helper 僅用於 flow 明示 testid 的 entity。
 */
export async function confirmDelete(page: Page) {
  await expect(page.getByTestId('confirm-modal')).toBeVisible()
  await page.getByTestId('confirm-ok').click()
}

/**
 * 重設 mock 資料到初始全集（打 /api/__test__/reset 端點），spec 於 test.beforeEach 呼叫確保測試獨立。
 * `empty` 透傳給端點：列出的集合重設後再清空，供「空狀態」Scenario 構造初始狀態（見 Step 4）。
 */
export async function resetMockData(page: Page, options?: { empty?: string[] }) {
  // 一律送物件（options 為 undefined 時送 {}），避免 { data: undefined } 在不同實作下的序列化差異
  const response = await page.request.post('/api/__test__/reset', { data: options ?? {} })
  // page.request.post() 對 4xx 預設不會 throw，只回傳一個 ok()=false 的 APIResponse；
  // 不檢查的話，empty 傳錯集合名這類重設失敗會被吞掉，測試拿著沒清空的舊資料繼續跑出假綠
  expect(response.ok(), `重設 mock 資料失敗：${response.status()} ${await response.text()}`).toBeTruthy()
}
```

#### route-match.ts

路由 pattern（含 `[id]` 或 `:id` 動態段）與真實路徑的比對 helper。抽出獨立檔案，`login`
（離開 `/login` 判斷）與 `01-auth-guard.spec.ts`（PUBLIC_PATTERNS／PROTECTED_PATTERNS 比對）共用，避免各自重寫
一份 `startsWith` 誤判。

**判準與 `auth.global.ts` 相同**：`matchesRoutePattern` 與 feature-to-ui [phase-2-skeleton.md](../../../feature-to-ui/references/phase-2-skeleton.md)
的 `app/utils/route-match.ts` 是同一份程式碼。E2E 骨架先於 UI 產生、import 不到那個檔，所以各存一份；改判準要兩邊一起改，
否則測試綠燈就不代表 middleware 的行為。`patternsOverlap` 只有測試端用得到（自檢兩份清單是否重疊），app 端沒有對應。

```typescript
// test/e2e/helpers/route-match.ts
// 與 app/utils/route-match.ts 的 matchesRoutePattern 同一份判準（見上方說明），改一邊要同步另一邊。
// 不用 startsWith：它對 `/users/[id]` 這類樣板永遠比不中真實路徑（`/users/42`），
// 且會誤中同前綴的兄弟路由（`/login` 誤中 `/login-recovery`）。
// 只支援具體段、`[id]`、`:id`。catch-all（`[...slug]`）、選填段（`[[id]]`）、正規式參數（`:id(\d+)`）
// 會被當成單一動態段而算錯——route-map 推導表不產生這些語法，手動加入時由 Step 6.5 在產出前擋下。

// 動態段：`[id]`（route-map 推導表的寫法）或 `:id`，吃任意非空值
function isDynamicSegment(segment: string): boolean {
  return segment.startsWith(':') || (segment.startsWith('[') && segment.endsWith(']'))
}

function toSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

// pattern 的每一段都對得上 path 同位置的段（只比到 pattern 的長度）
function leadingSegmentsMatch(patternSegments: string[], pathSegments: string[]): boolean {
  return patternSegments.every((segment, index) => {
    const pathSegment = pathSegments[index] ?? ''
    return isDynamicSegment(segment) ? pathSegment.length > 0 : segment === pathSegment
  })
}

// 整條命中：段數相同且逐段對上（公開頁不連帶放行子頁，與 auth.global.ts 一致）
export function matchesRoutePattern(pattern: string, path: string): boolean {
  const patternSegments = toSegments(pattern)
  const pathSegments = toSegments(path)
  return patternSegments.length === pathSegments.length && leadingSegmentsMatch(patternSegments, pathSegments)
}

// 兩個 pattern 能不能命中同一個具體路徑：段數相同，且每段至少一邊是動態段、或兩邊逐字相等。
// 自檢重疊不能拿一邊當路徑去比另一邊——兩邊都含動態段時雙向都會漏
// （`/files/[id]/preview` 與 `/files/admin/[id]` 雙向比都不中，卻都命中 `/files/admin/preview`）
export function patternsOverlap(a: string, b: string): boolean {
  const aSegments = toSegments(a)
  const bSegments = toSegments(b)
  return aSegments.length === bSegments.length
    && aSegments.every((segment, index) => {
      const other = bSegments[index] ?? ''
      return isDynamicSegment(segment) || isDynamicSegment(other) || segment === other
    })
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
export * from './route-match'
```

### Step 6：建立 hydration smoke spec

> **煙霧集合由 `.husky/pre-push` 的 `SMOKE_PATTERN` 一行定義**，本專案是 `specs/(00-auth|00-hydration)`。
> `.husky/pre-push`（只跑煙霧）與 `/vibe-check` 的定向模式都用 sed 抽同一行，**用完整檔名不用 `00`–`02` 前綴**——feature spec 的編號可以從 `01` 起，前綴會誤收。
> 之後若依 Step 6.5／6.6 新產出 `01-auth-guard`、`02-authz-scope`，把檔名加進那一行，不要改檔名遷就 pattern。

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

守衛（`auth.global.ts`）是生成物，沒有測試覆蓋時改壞抓不到（wedding-host 實戰：守衛無測試，重構後壞掉才人工發現）。`route-map.auth.required` 時必建。

產出前先檢查 `auth.public_paths` 的路徑段只能是具體字串、`[id]` 或 `:id`：出現 catch-all（`[...slug]`）、選填段（`[[id]]`）、帶正規式或修飾符的參數（`:id(\d+)`、`:id?`）就停下回報，不產出本檔——`route-match.ts` 不支援這些語法，互斥自檢與導向斷言都會靜默算錯。本步驟比 feature-to-ui Phase 2 早跑，所以兩邊各擋一次。

```typescript
// test/e2e/specs/01-auth-guard.spec.ts
// 路徑值從 route-map.yaml > auth 讀取（login_path / home_path / public_paths），不寫死
import { expect, test } from '@playwright/test'
import { login, matchesRoutePattern, patternsOverlap, Routes, TestUsers } from '../helpers'

// 自檢用（只做字串比對、不導航）：原樣抄 route-map 的 pattern。
// PUBLIC_PATTERNS = auth.public_paths 中 login 以外者；PROTECTED_PATTERNS = routes[].path 中不在 public_paths 的「全部」路徑。
// 不能只放代表頁：公開的 /users/[id] 會蓋掉受保護的 /users/me，只比代表頁抓不到。
const PUBLIC_PATTERNS: string[] = []
const PROTECTED_PATTERNS: string[] = [Routes.home]
// 導航用（page.goto）：只能放具體路徑，動態段換成種子資料裡真實存在的值——page.goto 不會把 /users/[id] 展開成真實頁面。
// 受保護頁挑代表頁即可（middleware 全域生效，不必逐頁）；公開頁每條 PUBLIC_PATTERNS 各給一個具體值。
const PROTECTED_PAGES: string[] = [Routes.home]
const PUBLIC_PAGES: string[] = []

test.describe('Auth 守衛', () => {
  // 設定自檢：兩份清單若有 pattern 重疊，代表同一路由被同時判定「需登入」與「免登入」，設定本身矛盾。
  // 用 patternsOverlap（逐段比對）不用 startsWith——pattern 含動態段時字面值比對永遠比不中，
  // 純字面 pattern 又會誤判同前綴的兄弟路由（issue #137）。
  // patternsOverlap 與 auth.global.ts 的 matchesRoutePattern 同一套逐段規則（段數不同不重疊，公開頁不連帶
  // 放行子頁），所以這裡的綠燈等於沒有任何具體路徑會同時落在兩份清單（issue #143）。
  // ⚠️ PUBLIC_PATTERNS 為空時，下面的 test.skip 會把這個自檢標成 skipped（不是零斷言空跑後顯示通過）；
  // 專案有公開頁、把 PUBLIC_PATTERNS 填值後，這個自檢才會真的執行。
  test('PUBLIC_PATTERNS 每一項都不得與任何 PROTECTED_PATTERNS 重疊', () => {
    test.skip(PUBLIC_PATTERNS.length === 0, 'PUBLIC_PATTERNS 為空，此自檢暫無意義；填入公開頁 pattern 後才會執行')
    // 兩邊都可能含動態段，所以比的是「能不能命中同一個具體路徑」，不是拿一邊當路徑去比另一邊
    for (const publicPattern of PUBLIC_PATTERNS) {
      for (const protectedPattern of PROTECTED_PATTERNS)
        expect(patternsOverlap(publicPattern, protectedPattern), `${publicPattern} 與 ${protectedPattern} 會命中同一路徑`).toBe(false)
    }
  })

  // ⚠️ 導向判斷一律用 matchesRoutePattern 對 pathname 比對，不用 toHaveURL(/\/login/)：
  // 後者是子字串比對，會誤中同前綴的兄弟路由（如 /login-recovery），跟上面 login() helper
  // 與互斥自檢用的判斷方式不一致（PR #141 review）。用 expect.poll 保留 toHaveURL 原有的重試等待。
  const isOnLogin = (page: import('@playwright/test').Page) =>
    matchesRoutePattern(Routes.login, new URL(page.url()).pathname)

  // ⚠️ 下面兩個迴圈把 PROTECTED_PAGES／PUBLIC_PAGES 直接丟給 page.goto()，所以這兩份只能放具體路徑。
  // pattern（如 `/users/[id]`）放上面的 *_PATTERNS：page.goto() 會把它當成字面 URL 訪問，
  // 導向斷言可能因此對到錯誤頁面而誤判過。
  for (const path of PROTECTED_PAGES) {
    test(`未登入訪 ${path} → 導向 login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' })
      await expect.poll(() => isOnLogin(page)).toBe(true)
    })
  }
  for (const path of PUBLIC_PAGES) {
    test(`未登入訪公開頁 ${path} → 不被導去 login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' })
      await expect.poll(() => isOnLogin(page)).toBe(false)
    })
  }
  test('已登入訪 login → 導回而非停留', async ({ page }) => {
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(Routes.login, { waitUntil: 'networkidle' })
    await expect.poll(() => isOnLogin(page)).toBe(false)
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
  const res = await request.post('/api/v1/auth/login', { // 前綴依 route-map.yaml > api_contract.path_prefix
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
│   ├── route-match.ts              # 路由 pattern 逐段比對（[id]／:id 段吃任意非空值）
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
- test/e2e/helpers/route-match.ts（matchesRoutePattern 逐段比對路由 pattern；patternsOverlap 判兩個 pattern 是否重疊）
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
- [ ] reset 端點支援 `{ empty?: string[] }` 通道（集合名走 zod enum 白名單）並清空指定集合
- [ ] reset 端點有 `if (!import.meta.dev && !useRuntimeConfig(event).e2eReset) throw createError({ statusCode: 404 })` 守門，且 `nuxt.config.ts` 有 `runtimeConfig.e2eReset: false`；production 只在 CI e2e job／`scripts/docker-gate.sh` 以 `NUXT_E2E_RESET=true` 開門，部署不設
- [ ] `actions.ts` 包含 login / selectOption / confirmDelete / resetMockData（`resetMockData` 支援透傳 `{ empty }`）
- [ ] `fixtures.ts` 包含測試帳號和路由（與 `_common.flow.md` 一致）
- [ ] `hydration.ts` 存在且 `index.ts` re-export `{ expect, test }`
- [ ] `route-match.ts` 存在，`login` 與 `01-auth-guard.spec.ts` 皆改用 `matchesRoutePattern`／`patternsOverlap`（不用 `startsWith`）
- [ ] `specs/00-hydration.spec.ts` 涵蓋所有 Routes（公開 + 登入後）
- [ ] `route-map.yaml` 有 `auth` 區塊時，`specs/01-auth-guard.spec.ts` 存在（未登入導 login／公開頁不被導走／已登入訪 login 導回／`PUBLIC_PATTERNS` 不與任何 `PROTECTED_PATTERNS` 重疊（`patternsOverlap`，`PROTECTED_PATTERNS` 列全部受保護路徑）；`PUBLIC_PATTERNS` 為空時互斥自檢標成 skipped，填值後才執行；導航用的 `PROTECTED_PAGES`／`PUBLIC_PAGES` 只放具體路徑）
- [ ] `route-map.yaml > api_contract.endpoints` 有 ≥2 個 path 參數的端點時，`specs/02-authz-scope.spec.ts` 存在且**含寫入端點**的錯誤父子組合
- [ ] `.gitignore` 排除測試產物
- [ ] `npx playwright test --list` 可執行
