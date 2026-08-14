# E2E Spec 生成（Phase: e2e spec）

## 目標

將 `.flow.md` 操作流程轉換為 Playwright `.spec.ts` 測試檔案，實現**業務需求 100% 覆蓋**。

> **TDD 定位**：spec 在 UI 之前生成，是測試合約。UI 為通過 spec 而建，spec 不因 UI 而改。

---

## ⚠️ v2 抽象化原則（先讀）

v2 起，`.spec.ts` 從「testid 主導」改為「**business outcome 主導**」。`.flow.md` 已用 v2 風格描述 business invariants 與 Selector 策略，spec.ts **必須對齊該風格**，不可越權加 testid 斷言或硬鎖具體值。

定位優先序：

1. **API spy 優先驗證 destructive / async outcome**
   ```ts
   page.waitForRequest(req => /\/exports(\?|$)/.test(req.url()) && req.method() === 'POST')
   ```
   API URL **必用 regex** 容版本路徑（`/api/v1/...`、`/api/v2/...`）。

2. **role + name regex 為主要 locator**
   ```ts
   page.getByRole('button', { name: /匯出.*(此次|單次|本觀測時段)/ })
   page.getByRole('row', { name: /PER/ })  // 找實體
   ```
   name regex **列同義詞集合**（給 vibe 改措辭空間）。

3. **語意反饋元素**
   ```ts
   page.getByRole('alert')
     .or(page.getByRole('status'))
     .or(page.getByText(/已送出|匯出成功|處理中/))
   ```
   不寫死特定 toast testid 或文字字面值。

4. **可選 confirm 步驟**：用 helper `maybeConfirm(page)`，scope 到 `getByRole('dialog')`，內部用動詞前綴 regex（`/^(確認|確定|送出|匯出|刪除|移除|完成)/`）

5. **testid 退 fallback only**（規範 SSOT：[testid-conventions.md](../../../feature-to-flow/references/testid-conventions.md)；本節只給 spec 側的使用政策，不重列命名規則）：僅在以下情況用：
   - role + name 無法消歧（同名多個 role）
   - 純樣式元素無語意角色
   - 動態狀態屬性（`data-favorited`、`data-selected`）

**.flow.md 的 Verification 策略 / 不再凍結 / Selector 策略段是輸入指示**，spec.ts **必須遵守該指示**，不可加 flow.md 未授權的斷言。

---

---

## 輸入 / 輸出

### 輸入

```
必讀（結構來源）：
1. spec/e2e-flows/{NN}-{name}.flow.md  — 操作流程文件（測試結構）
2. spec/e2e-flows/_common.flow.md      — 共用步驟
3. test/e2e/helpers/actions.ts       — 共用操作（login 等）
4. test/e2e/helpers/fixtures.ts       — 測試資料

必讀（資料來源）：
5. flow 檔頭 `> 對應規格` 所指的 .feature 檔 — 原始 Feature Background（該 feature 的初始狀態定義；定位方式見 Step 2a，逐 feature 檔與單一大檔兩種形式都支援）
6. server/mock/data/*.ts             — 實際 mock 資料（實體名稱、日期、數值等）
7. server/api/{相關 API}.ts           — API 過濾邏輯 + 錯誤訊息（createError 的 message）
8. spec/report/route-map.yaml > rbac（**若存在** → 角色全集、受限端點、ownership、object_ownership（單筆 BOLA）、受保護路由；據此產多角色登入 + 拒絕場景，見「角色與權限場景」段）

不讀（TDD 模式下 UI 尚未建立）：
7. app/pages/{相關頁面}.vue           — ❌ spec 在 UI 之前生成，不依賴 Vue 頁面
```

### 輸出

```
1. test/e2e/specs/{NN}-{name}.spec.ts  — Playwright 測試檔案
2. test/e2e/helpers/fixtures.ts        — 更新（如有新路由/帳號）
```

---

## 核心原則

1. **一個 `.flow.md` 對應一個 `.spec.ts`**
2. **不使用 quickpickle / Gherkin**：直接生成 Playwright `test.describe` / `test` 結構
3. **共用操作從 helpers import**：login / selectOption / confirmDelete 不在 spec 內定義
4. **Selector 策略以 `.flow.md` 為準（v2）**：flow 的「Selector 策略」/「Verification 策略」段授權使用哪些 locator 類型。flow 沒寫 testid 就不寫 testid 斷言；flow 用 invariant 表達就用 role/text/API spy 驗證。**禁止越權**：例如 flow 寫「sighting-001 可被識別」，spec 不得改寫成「`sighting-row-sighting-001` 包含 14 欄 testid 斷言」
5. **每個 spec 獨立可執行**：透過 `test.beforeEach` reset mock data + 清理多餘實體，確保初始狀態符合 Feature Background
6. **⚠️ 初始狀態以 Feature Background 為準**：每個 feature 的 `Background:`（逐檔形式為該 `.dsl.feature` 檔、大檔形式為對應的 `Feature:` 區塊）定義了該 feature 的初始狀態。Mock 全集是所有 feature 的 Background 合併，可能包含不屬於該 feature 的實體。Spec 必須確保測試開始時的狀態與 Feature Background 一致（見 Step 2c-2d）
7. **spec 是生成物，禁止手動編輯**：`.flow.md` 更新時，spec 全量重新生成。green 階段**禁止修改 spec**，只能修改 UI/mock/API。如果 spec 有問題，修 flow 再重新生成

> ⚠️ 若需調整測試的 Given/When/Then 邏輯，應修改 `.flow.md` 後重新執行 `/test e2e spec`，而非直接編輯 `.spec.ts`

---

## 執行步驟

### Step 1：讀取 .flow.md

解析 `.flow.md` 結構：

```
├── 頁面資訊（名稱、路由）
├── 元素定義表
├── 共用前置條件
└── 規則[]
    └── 情境[]
        ├── 跳過？（⏭️ 整個情境跳過）
        ├── 前置條件[]
        ├── 操作步驟[]
        └── 預期結果[]
```

### Step 2：交叉比對實作（⚠️ 關鍵步驟）

在生成 spec 之前，**必須讀取實際實作**來校正 `.flow.md` 中的假設值。

#### 2a. 定位並讀取 Feature Background（⚠️ 初始狀態定義）

**來源 .feature 檔採三層定位，主錨點是 flow 檔頭的 `> 對應規格`，不用檔名瞎猜**：

1. **header 指向逐 feature 檔**（如 `{NN}-{name}.dsl.feature`；可能列多個來源檔，逐一處理）→ 直接讀該檔
2. **header 指向單一大檔**（一檔含多個 `Feature:` 區塊，如 `gherkin-export.feature`）→ 依 flow 內各 `> 對應 Feature: {feature 名稱}` 引用，在大檔中定位同名 `Feature:` 區塊，只取這些區塊
3. **header 缺失才 fallback 檔名慣例**：讀 `spec/gherkin-feature/{NN}-{name}.dsl.feature`（由 flow 檔名反推，維持既有行為），並在產出回報中提示在 flow 檔頭補上 `> 對應規格`

定位到目標後，解析 `Background:` 區塊中的 `Given` 語句，識別**該 feature 定義的初始狀態**（哪些實體在測試開始時應該存在）。若定位到的 `Feature:` 區塊沒有 `Background:`，初始狀態由各 Scenario 自己的 `Given` 定義——Step 2c 視為「無 Background 差異」，reset 全集即為基底。

```
Feature Background 定義：
- 使用者：admin, observer1
- 觀測點：藍鷹隊（observer1）
→ 該 feature 的測試假設「只有藍鷹隊存在」
```

> ⚠️ **Feature Background ≠ Mock 全集**。Mock 資料是所有 feature 的 Background 合併而成的超集。
> 例如 feature 03 的 Background 有 4 支觀測點，feature 04 的 Background 只有 1 支。
> 每個 feature 的 spec 必須基於**自己的 Background**推算預期結果，而非 mock 全集。

#### 2b. 掃描 mock data + API 過濾邏輯

1. 讀取 `server/mock/data/*.ts`，取得原始資料全集
2. 讀取 `server/api/{對應路徑}.ts`，理解 API 的過濾邏輯（日期過濾、狀態過濾、角色過濾、搜尋篩選等）
3. **以每個測試情境的角色/參數，模擬 API 過濾**，推算該情境下 API 實際會回傳哪些資料
4. 用推算結果寫斷言值，而非 raw data 的值

> ⚠️ raw data ≠ API 回傳。例如 `mockTrainings` 有 16 筆，但經過 `status === 'active'`、`date >= today`、角色過濾後，observer1 呼叫 API 可能只拿到 3~4 筆。斷言必須基於過濾後的結果。
>
> ⚠️ **角色維度看 `route-map.rbac`**（若存在）：`rbac.endpoints` 列的端點對受限角色回 **403**（該角色的斷言是「被拒」非「空清單」）；`rbac.ownership` 列的端點對 `restricted_roles` 只回自己 `owner_field` 的列（依登入角色推算筆數）；`rbac.object_ownership` 列的 `/{id}` 端點，受限角色帶**他人 id** 回 **403/404**（BOLA），帶**自己 id** 才成功。mock 的 `requireRole` / `requireOwnership` / `getMockCurrentUser` 是實際守門點。

#### 2c. 比對 Feature Background vs Mock 全集（⚠️ 背景差異偵測）

將 Step 2a 的 Feature Background 與 Step 2b 的 mock 全集比對：

```
Feature Background 定義的實體 vs mock 全集
├─ 完全一致 → 無需額外處理，直接用 reset
└─ 有差異 → 需要在 beforeEach 中建立乾淨背景
    ├─ mock 多餘實體（不在 Background 中）→ 需刪除
    └─ mock 缺少實體（在 Background 中但 mock 沒有）→ 需建立

例：
  Feature 04 Background: 藍鷹隊
  Mock 全集: 藍鷹隊, 紅龍隊, 白虎隊, 黑豹隊(deleted)
  差異: 紅龍隊、白虎隊、黑豹隊為多餘 → 需刪除
```

#### 2d. 生成乾淨背景 setup（有差異時）

**原則：每個 spec 的初始狀態必須精確對應 Feature Background，不多不少。**

在 `test.beforeEach` 中，先 reset 到全集，再透過 API 呼叫調整到 Feature Background：

```typescript
test.beforeEach(async ({ request }) => {
  // Step 1: 重置 mock 資料到全集
  await request.post('/api/__test__/reset')

  // Step 2: 調整到 Feature 04 的 Background（只有藍鷹隊）
  // 刪除不屬於此 feature Background 的實體
  await request.delete('/api/sites/2') // 紅龍隊
  await request.delete('/api/sites/3') // 白虎隊
})
```

> ⚠️ **解耦原則**：每個 spec 必須從自己 Feature Background 定義的乾淨狀態開始。
> mock 全集只是一個「素材池」，reset 後再透過 API 裁剪到正確的初始狀態。
> 這確保了：
> - 建立操作不會因為多餘實體的唯一性約束而失敗
> - 列表查詢的筆數與 Feature Background 一致
> - 各 spec 之間完全解耦，不互相影響

#### 2e. 掃描 API 錯誤訊息（僅涉及錯誤場景時）

讀取相關 API handler，提取 `createError` 的 message：

```bash
grep "createError" server/api/{相關路徑}/*.ts
```

#### 2f. 產出校正表

對比 `.flow.md` 與 mock data / API / Feature Background，列出資料差異：

```
⚠️ 校正表：
- flow 實體名稱 "{flow值}" → 實際 mock: "{mock值}"
- flow 錯誤訊息 "{flow訊息}" → 實際 API: "{api訊息}"
- testid: 僅當 flow「Selector 策略」授權時使用，值取自 flow 定義（v2：testid 是 fallback，不是預設）
- toast 文字: 直接使用 flow 定義（UI 必須實作此文字）
- ⚠️ Background 衝突: mock 多餘實體 "{name}" 與建立操作衝突 → 需清理
```

### Step 3：更新 fixtures.ts

若 `.flow.md` 涉及新的路由或測試帳號，更新 `fixtures.ts`。

### Step 4：生成 .spec.ts（使用校正後的值）

> **覆寫既有 spec 前必寫 sentinel**：flow 更新觸發的全量重生會覆寫 `test/e2e/specs/` 既有檔，凍結 hook 預設擋下。經使用者確認重生範圍後、寫檔前，先寫 `.claude/tmp/frozen-allow.json`（`{ "reason": "flow 更新，spec 全量重生", "files": ["test/e2e/specs/<檔名>.spec.ts", ...] }`），hook 對清單內目標放行一次。新增全新 spec 檔不需 sentinel。

---

## .spec.ts 結構（v2）

```typescript
// test/expect 走 ../helpers（掛 hydration 守門 fixture），不直接 import @playwright/test
import type { Page } from '@playwright/test'

import {
  expect,
  findEntity,
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  test,
  waitForApiCall,
} from '../helpers'

test.beforeEach(async ({ page, request }) => {
  await resetMockData(page)
  // 若 Feature Background ≠ mock 全集，在此調整
  // await request.delete('/api/v1/sites/site-002')
})

test.describe('規則：{Rule 名稱}', () => {
  test('{Example 名稱}', async ({ page }) => {
    // Given：{前置條件原文}
    await login(page, 'admin', 'admin888')
    await page.goto('/items', { waitUntil: 'networkidle' })

    // When：操作（intent-based）
    // — Destructive / async 用 API spy 抓 outcome
    const apiCall = waitForApiCall(page, /\/items\/[^/]+$/, 'DELETE')
    await findEntity(page, /<entity-name>/).getByRole('button', { name: /刪除/ }).click()
    await maybeConfirm(page)
    const req = await apiCall
    expect(req.postDataJSON()).toMatchObject({ /* expected */ })

    // Then：UI 反饋與狀態
    await expect(getFeedbackElement(page)).toBeVisible()
    await expect(findEntity(page, /<entity-name>/)).not.toBeVisible()
  })

  test.skip('{跳過的 Example 名稱}', async () => {
    // 跳過：{原因}
  })
})
```

> **v2 範例對照**：見本檔「Flow → Playwright 轉換規則（v2）」與「特殊操作轉換（v2 為主，testid 為 fallback）」段的實例。

---

## Playwright 必遵守規則

> ⚠️ 違反任一條都會產生有問題的 spec。此段落為 Playwright 規則的**唯一權威來源**，其他檔案（red.md、green.md）不再重複列出。

### 語法規則

| 規則 | 正確 | 禁止 |
|------|------|------|
| `page.goto()` | 加 `{ waitUntil: 'networkidle' }` | 不帶 waitUntil |
| Toast 斷言 | `{ exact: true }` | regex（如 `/成功/`） |
| `test.skip` callback | `async () =>` | `async ({ page }) =>` |
| `test.beforeEach` | reset + 調整到 Feature Background 狀態 | 省略 reset 或忽略 Background 差異 |
| 確認彈窗 | `confirmDelete(page)` | `getByText('確定要刪除')` + `getByRole('button')` |
| 列表行定位 | `locator('tbody tr', { hasText })` | 直接 `getByText`（會匹配 header） |
| `toHaveURL` | 用 `waitForURL('**/path')` 代替 | `toHaveURL` 不支援 glob |
| helpers | 從 `../helpers` import | 在 spec 內重複定義 login / selectOption / confirmDelete |

### Business Invariant 字串引用

`getByText` / `toContainText` 的**字面字串必須 import 自 invariants 常數檔**，不直接寫死。

```typescript
// ❌ 寫死字面字串 — 易與 UI 漂移
await expect(row).toContainText('{invariant text}')
await expect(page.getByText('{feedback text}')).toBeVisible()

// ✅ import 常數 — TypeScript 保證對齊 UI
import { {GROUP} } from '~/constants/invariants'
await expect(row).toContainText({GROUP}.{STATE_KEY})
await expect(page.getByText({FEEDBACK}.{SUCCESS_KEY})).toBeVisible()
```

**例外允許 hardcode 字面字串**的情境：

| 情境 | 例 |
|------|------|
| Fixture / mock data 比對 | `toContainText('{mock fixture value}')`（mock 改 → spec 跟改）|
| API server error message（API 合約） | exact 文字斷言（不是 UI invariant）|
| 純數值斷言 | `toContainText('{number}')`（speed、count）|
| 該 invariant 尚未遷移到常數 | 過渡期允許，flow.md 同步要寫進「待遷移」清單 |

> **規範細節**：見 [`/feature-to-api` 的 invariants.md](../../../feature-to-api/references/invariants.md)。

> **為什麼**：當 UI 端 invariant 文字也 import 同份常數，TypeScript 在 compile time 就能保證 UI 與 spec 對齊，無須 runtime 驗證。vibe iteration 階段「改錯字」這類紅燈消除大半。

### 交叉比對規則（TDD 模式，v2）

| 資料類型 | 來源 | 說明 |
|---------|------|------|
| 實體識別值（人物名稱、shower-code 等） | `server/mock/data/*.ts` | 用 mock 實際值，spec 用 regex 抽樣（如 `/陳小明/`、`/PER/`） |
| API endpoint & method | `.flow.md` 的 Verification 策略 | URL 用 regex 容版本：`/\/<endpoint>(\?|$)/` |
| API 錯誤訊息 | `server/api/` 的 `createError({ message })` | exact 文字斷言（這是 API 合約） |
| 語意 locator 措辭 | `.flow.md` 的 Selector 策略 | 用 regex 含同義詞，不鎖單一措辭 |
| 反饋元素 | `.flow.md` 的「使用者收到反饋」描述 | 用 `getFeedbackElement(page)`（不寫死 testid 或精確 toast 文字） |
| 統計數值 | 從 mock data 手動計算 | 不可省略；用 contains 不用 exact（vibe 可能加單位/格式） |
| testid（**fallback only**） | `.flow.md` 明示時用 | flow 沒寫 testid，spec 就不寫；flow 用 `data-favorited` 等 attribute 時才用 testid |

> **TDD 原則（v2）**：spec 在 UI 之前生成。flow 描述 business invariant、Verification 策略、Selector 策略，spec 對齊翻譯。UI 實作時必須通過這些 invariant，但**怎麼通過（layout / 措辭 / testid 命名）由 UI 自由決定**。

### Strict Mode Violation 防範（v2）

`getByText` / 寬鬆 `getByRole` 都可能匹配多個元素。**v2 預設用 scope 而非 testid 收窄**。

```typescript
// ❌ toast 文字與 Badge 重複 → strict mode violation
await expect(page.getByText('狀態文字', { exact: true })).toBeVisible()

// ✅ v2：限定在 role=alert / status
await expect(page.getByRole('alert').getByText('狀態文字')).toBeVisible()

// ❌ 找實體時可能多個 row 含同文字
await expect(page.getByText('陳小明')).toBeVisible()

// ✅ v2：用 findEntity + 範圍內驗證
const entity = findEntity(page, /陳小明/)
await expect(entity).toBeVisible()
await expect(entity.getByText(/130/)).toBeVisible()  // 該實體範圍內的 speed 值

// ✅ v2 替代：`.first()` 配 regex（明確接受多匹配但只驗第一個）
await expect(page.getByText(/陳小明/).first()).toBeVisible()
```

**testid 仍可作 disambiguation 工具**（fallback）：

```typescript
// flow 明示用 data attribute 表達狀態時
await expect(page.getByTestId('sighting-favorite-button-sighting-001')).toHaveAttribute('data-favorited', 'true')
```

---

## Flow → Playwright 轉換規則（v2）

### 操作動詞轉換（v2）

| Flow 動詞 | v2 首選（role/text） | testid fallback（僅 flow 明示時用） |
|-----------|---------------------|----------------------------------|
| `進入 {頁面}` / `前往 {頁面}` | `await page.goto('/path', { waitUntil: 'networkidle' })` | 同 |
| `觸發「{意圖}」` | `await page.getByRole('button', { name: /<intent regex>/ }).click()` | `page.getByTestId('id').click()` |
| `填寫「{欄位}」→ {值}` | `await page.getByLabel('{欄位}').fill('value')` 或 `getByRole('textbox', { name: /<label>/ })` | `getByTestId('xxx-input').fill('value')` |
| `在 {entity} 範圍內觸發 X` | `await findEntity(page, /<id-or-name>/).getByRole('button', { name: /X/ }).click()` | scope 到 testid 範圍 |
| `等待 dialog / modal 出現` | `await expect(page.getByRole('dialog')).toBeVisible()` | `getByTestId('xxx-modal').toBeVisible()` |
| `完成 confirm 步驟` | `await maybeConfirm(page)`（dialog scope + 動詞 regex） | `confirmDelete(page, 'entity')` |
| `等待跳轉到 {頁面}` | `await page.waitForURL('**/path')` | 同 |
| `勾選 / 取消勾選「{描述}」` | `await findEntity(page, /<name>/).getByRole('checkbox').check()` | 見「批次勾選」fallback |

### 驗證詞轉換（v2）

| Flow 驗證詞 | v2 首選 | testid fallback |
|------------|--------|----------------|
| `API spy: POST/DELETE/PUT {url}` | `page.waitForRequest(req => /<url-regex>/.test(req.url()) && req.method() === '<method>')` | — |
| `→ 使用者收到反饋` | `expect(getFeedbackElement(page)).toBeVisible()`（role=alert / status / 語意文字） | `expect(getByTestId('toast-xxx')).toBeVisible()` |
| `→ {entity} 可被識別` | `expect(findEntity(page, /<name>/)).toBeVisible()` | `expect(getByTestId('row-xxx')).toBeVisible()` |
| `→ {entity} 顯示狀態「{state}」` | `expect(findEntity(page, /<name>/).getByText(/<state>/)).toBeVisible()` 或 `getByRole('button', { name: /<state-verb>/ })` | `toHaveAttribute('data-<state>', '<value>')`（僅當 flow 明示 data attribute） |
| `→ {entity} 不可見` | `expect(findEntity(page, /<name>/)).not.toBeVisible()` | `expect(getByTestId('row-xxx')).not.toBeVisible()` |
| `→ 跳轉到 {path}` | `await page.waitForURL('**/path')`。⚠️ **Redirect 路由解析**：見原規則。 | 同 |
| `→ ⏭️ 跳過（{reason}）` | `test.skip('...', async () => {})` 註明原因 | 同 |
| `→ 文字「{text}」可見`（**僅當 flow 明示精確文字**） | `expect(page.getByText('text', { exact: true })).toBeVisible()` | 同 |

**重要**：flow 用 regex 語意（如「匯出.*單次」）就在 spec 用 regex；flow 用精確文字（如錯誤訊息「帳號不存在」）才用 exact。**不可自行升級為 exact**。

### v2 helper 模式

下列 helper 應放在 `test/e2e/helpers/`（首次使用時建立、之後共用）：

```ts
// 找實體：row / article / listitem 任一形式
export function findEntity(page: Page, name: string | RegExp): Locator {
  return page
    .getByRole('row', { name })
    .or(page.getByRole('article', { name }))
    .or(page.getByRole('listitem', { name }))
    .first()
}

// 可選 confirm：dialog scope + 動詞前綴
export async function maybeConfirm(page: Page) {
  const dialog = page.getByRole('dialog')
  const hasDialog = await dialog.first().isVisible({ timeout: 2000 }).catch(() => false)
  if (hasDialog) {
    const confirm = dialog.getByRole('button', {
      name: /^(確認|確定|送出|匯出|刪除|移除|完成)/,
    })
    if (await confirm.first().isVisible({ timeout: 500 }).catch(() => false)) {
      await confirm.first().click()
      return
    }
  }
  const fallback = page.getByRole('button', { name: /^(確認|確定|送出)/ })
  if (await fallback.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await fallback.first().click()
  }
}

// 找成功反饋（不限形式）
export function getFeedbackElement(page: Page): Locator {
  return page
    .getByRole('alert')
    .or(page.getByRole('status'))
    .or(page.getByText(/已送出|已請求|匯出成功|處理中|已收藏|已刪除/))
    .first()
}

// API spy 包裝（path regex + method）
export function waitForApiCall(page: Page, pathRegex: RegExp, method: string) {
  return page.waitForRequest(req => pathRegex.test(req.url()) && req.method() === method)
}
```

> 若這些 helper 還不存在於 `test/e2e/helpers/`，spec 生成時順手建檔（並 export 到 `helpers/index.ts`）。

---

## 特殊操作轉換（v2 為主，testid 為 fallback）

### API spy（destructive / async outcome 主要驗證手段）

```typescript
// 監聽 destructive API call（DELETE / POST / PUT）
const apiRequest = page.waitForRequest(
  req => /\/sightings\/[^/]+$/.test(req.url()) && req.method() === 'DELETE',
)
await findEntity(page, /PER/).getByRole('button', { name: /刪除/ }).click()
await maybeConfirm(page)
const request = await apiRequest
expect(request.postDataJSON()).toMatchObject({ /* expected payload */ })
```

**URL regex 通則**：用 `/\/<endpoint>(\?|$)/` 容版本路徑（`/api/v1/exports`、`/api/v2/exports` 皆過）。**禁止寫死 `/api/exports`** 字面值（會被 server 升版打掛）。

### 列表中定位特定實體（v2）

```typescript
// 用 role + 語意 name 找實體（不限 row / article / listitem 形式）
const sightingEntity = findEntity(page, /PER/)  // shower-code 當識別
await sightingEntity.getByRole('button', { name: /取消收藏/ }).click()
```

testid fallback（僅 flow 明示 testid 時用）：

```typescript
const row = page.getByTestId('{entity}-list').locator('tbody tr', { hasText: '{item-name}' })
```

### 行內驗證（v2）

```typescript
const entity = findEntity(page, /<name>/)
await expect(entity.getByText(/<expected-state>/)).toBeVisible()
// 或：實體內找 role+name
await expect(entity.getByRole('button', { name: /取消收藏/ })).toBeVisible()  // 已收藏狀態
```

### 批次勾選

```typescript
// v2：role-based
await findEntity(page, /<item-name>/).getByRole('checkbox').check()
```

### 確認彈窗（v2）

```typescript
await maybeConfirm(page)
```

**舊 `confirmDelete(page, 'entity')`** 仍可用於 flow 明示 testid 的 entity，但 v2 預設用 `maybeConfirm`（dialog scope + 動詞 regex）。

### 反饋驗證（v2）

```typescript
await expect(getFeedbackElement(page)).toBeVisible()
```

不寫死 toast testid 與精確文字（除非 flow 明示）。

### 跨頁驗證

```typescript
await page.goto('/items', { waitUntil: 'networkidle' })
await expect(findEntity(page, /<deleted-name>/)).not.toBeVisible()
```

### USelect / 下拉選單（v2）

```typescript
// 優先用 role
await page.getByRole('combobox', { name: /觀測站/ }).click()
await page.getByRole('option', { name: '陳小明' }).click()
```

testid fallback：

```typescript
await selectOption(page, '{field-id}', '{option-label}')
```

> **注意**：option label 可能經過格式化（如 `"1 - 項目名稱"` 而非 `"項目名稱"`），必須檢查 Vue 頁面確認實際格式。

---

## 角色與權限場景（條件式，route-map 有 `rbac` 時）

flow 的「角色可見性不變式」+ `route-map.rbac` 一起驅動權限場景的產生。**這些是「看得到的權限差異」，必須測，不可 skip。**

### 多角色登入 helper

`rbac.roles` 每個角色都要能登入。擴充 `test/e2e/helpers/actions.ts`，**測試帳號取自 `ui-config.yaml > testAccounts` / mock 種子，不寫死**：

```ts
// test/e2e/helpers/actions.ts
export const ROLE_ACCOUNTS = {
  super_admin: { account: 'admin', password: 'admin888' },
  observer: { account: 'observer1', password: 'pass123' },
} as const

export async function loginAs(page: Page, role: keyof typeof ROLE_ACCOUNTS) {
  const a = ROLE_ACCOUNTS[role]
  await login(page, a.account, a.password)
}
```

### 拒絕場景產生規則

| route-map.rbac 來源 | 產出 scenario | 驗證方式 |
|---|---|---|
| `endpoints`（受限端點） | 「{受限角色} 呼叫 {端點} → 被拒」 | API spy 抓 **403**：`page.waitForResponse(r => /<path-regex>/.test(r.url()) && r.status() === 403)`；或 UI 端語意反饋（`getFeedbackElement` / 無權限文字） |
| `protected_routes`（受保護路由） | 「{受限角色} 直接打 {path} → 被導離」 | `await page.goto(path)` 後 `await page.waitForURL('**/403')`（或首頁）；**不**斷言看得到受保護內容 |
| `ownership`（列表 ACL） | 同一列表，全權角色 vs 受限角色筆數不同 | 兩個 test 各自 `loginAs`，斷言可見實體集合依角色推算（見 Step 2b） |
| `object_ownership`（單筆 BOLA / **OWASP API #1**） | 「{受限角色} 帶**他人 id** 打 {`/{id}` 端點} → 被拒」 | API spy 抓 **403**（`notfound: true` 時 **404**）：`page.waitForResponse(r => /<path-with-OTHER-id>/.test(r.url()) && [403, 404].includes(r.status()))`。關鍵是「**同端點、換成不屬於自己的 object id**」——這正是 BOLA 攻擊面，**必測** |

```ts
// 範例：受限角色被端點擋（403）
test('observer 無法取得帳號列表（僅 super_admin 可操作）', async ({ page }) => {
  await loginAs(page, 'observer')
  const denied = page.waitForResponse(r => /\/accounts(\?|$)/.test(r.url()) && r.status() === 403)
  await page.goto('/accounts', { waitUntil: 'networkidle' })
  await denied
})

// 範例：受限角色打受保護路由被導離
test('observer 直接打 /accounts 被導離', async ({ page }) => {
  await loginAs(page, 'observer')
  await page.goto('/accounts', { waitUntil: 'networkidle' })
  await page.waitForURL('**/403') // 或首頁，依 protected_routes 守門目標
})

// 範例：受限角色帶「他人 id」打單筆端點被擋（OWASP BOLA / API #1）
// 僅當 route-map.rbac.object_ownership 命中時才產；notes 為假想資源，端點 / id 用實際 rbac 值
test('observer 無法編輯他人建立的 note（單筆歸屬）', async ({ page }) => {
  await loginAs(page, 'observer') // observer1 = acc-002
  // 帶一筆「非自己建立」的 object id（取自 mock 種子中 createdBy 屬於他人的那筆）
  const denied = page.waitForResponse(r => /\/notes\/note-of-other(\?|$|\/)/.test(r.url()) && [403, 404].includes(r.status()))
  await page.goto('/notes/note-of-other/edit', { waitUntil: 'networkidle' })
  await denied
})
```

> ⚠️ **拒絕場景 ≠ 不可達場景**：受限角色「被擋」是可觀察、可測的（上方），**必須產**。下方 Skip 規則的「API 層已過濾、UI 根本無法觸發」指的是連入口與路由都不存在、URL 也拼不出來的死路；**不含** BOLA——「帶他人 id 打 `/{id}`」永遠拼得出 URL、是真實攻擊面，`object_ownership` 命中時**必測、不可 skip**。
> ⚠️ 403/404 statusMessage、守門目標路徑、以及「屬於他人的 object id」以 mock（`requireRole` / `requireOwnership`）、`rbac.global.ts`、mock 種子的實際值為準（交叉比對 Step 2b / 2e）。

### 巢狀資源 scope 層（**無條件**，不需 rbac）

上表全綁 `route-map.rbac`；但「巢狀端點漏帶父層過濾」的 IDOR **不需要角色分層就存在**（wedding-host 是單角色 owner-based 專案，rbac 不會命中，DELETE 漏過濾照樣被打穿）。這層由 setup 階段的 `specs/02-authz-scope.spec.ts` 承接（範本見 setup.md Step 6.6）：route-map endpoints 含 ≥2 個 path 參數 → 用 `request` 直打錯誤父子組合斷言 404，**寫入端點必含**。spec 階段檢查：若本 feature 新增了巢狀端點而 02-authz-scope 未涵蓋 → 依 `rules/frozen-paths.md` 上游變更程序補組合，或另建新 spec 檔。

---

## 持久性斷言（設定/狀態類 scenario 必含）

**判定**：scenario 的 command 更新既有 aggregate 的可變狀態、且畫面直接顯示新值（設定頁、偏好、佈置、編輯表單…），就屬「設定/狀態類」。新增後跳轉列表的 create 類不算——列表重新載入本身就是讀回驗證。

**生成規則**：該 scenario 的 Then 斷言完成後，追加：

```typescript
// 持久性：寫入必須在 reload 後讀得回（防 UI 用 local state 暫存兜資料）
await page.reload({ waitUntil: 'networkidle' })
// <重複該場景的關鍵 Then 斷言>
```

- 斷言 locator 沿用該場景 flow 已授權的策略，不另開新 selector
- 這是管線層級守門（與 hydration 守門同類），**flow 沒寫 reload 也必須生**，不算 spec 越權
- 為什麼：同 session 內「寫入 → 當下顯示」永遠會過；GET 漏欄位、UI 拿 local ref 兜資料時，只有 reload 抓得到（wedding-host 實戰：7 個 GET 缺口對全部同 session 測試隱形）

---

## Skip 規則

### 允許 skip 的情況（僅限以下）

- API 層已過濾，UI 根本無法觸發的場景（如「使用者編輯他人的資源」）
- 需要外部系統配合且無法 mock（如 SSE 即時推送）
- 需要控制時間的場景（如帳號鎖定過期）

### 禁止 skip 的情況

**「UI 尚未實作」不是 skip 的理由。** 寫完整步驟，讓 Playwright 自然因找不到元素而失敗。E2E 測試報告就是功能完成度清單。

```typescript
// ❌ 禁止
test.skip('成功調整排序', async () => {
  // 跳過：UI 尚未實作
})

// ✅ 寫完整步驟
test('成功調整排序', async ({ page }) => {
  await login(page, 'observer1', 'pass123')
  await page.goto('/items/1/list', { waitUntil: 'networkidle' })
  await page.getByTestId('sort-handle').first().dragTo(page.getByTestId('sort-handle').nth(2))
})
```

### test.skip 語法

```typescript
test.skip('帳號鎖定後重新登入', async () => {
  // 跳過：需要控制時間（鎖定過期）
})
```

> callback 必須是 `async () =>`，**不帶** `{ page }` 參數。

---

## ESLint / Lint Gate

- 生成後必跑 `npm run eslint` + `npm run typelint`，零錯誤才算完成（CLAUDE.md 紅線）
- import 排序遵守 perfectionist 規則；test/expect 從 `../helpers` 匯入（見「.spec.ts 結構（v2）」範本）
- 指令順序、`--fix` 禁忌與常見問題（未使用 import、未使用參數加 `_` 前綴）見 [green.md](green.md) 的「Lint Gate（必須通過）」段

---

## 檢查清單

### 基礎
- [ ] fixtures.ts 已包含所需的路由和測試帳號
- [ ] import 排序符合 ESLint perfectionist 規則
- [ ] 共用操作從 `../helpers` import，spec 內無本地定義
- [ ] `test.beforeEach` 呼叫 reset + 背景調整（Feature Background vs mock 全集已比對）
- [ ] 每個 test 有 Given/When/Then 註解
- [ ] 設定/狀態類 scenario 含「寫入 → `page.reload()` → 斷言仍在」持久性斷言（見「持久性斷言」段）
- [ ] `npm run eslint` + `npm run typelint` 零錯誤

### v2 抽象化合規
- [ ] **flow 沒寫 testid 的地方，spec 也沒用 testid**（沒越權）
- [ ] **destructive / async outcome 用 API spy 驗證**（不只靠 UI 斷言）
- [ ] **API URL 用 regex（`/\/<endpoint>(\?|$)/`）容版本路徑**，不寫死 `/api/exports`
- [ ] **語意 regex 含同義詞集合**（如 `/匯出.*(此次|單次|本觀測時段)/`），不鎖單一措辭
- [ ] **confirm 步驟用 `maybeConfirm(page)`**（dialog scope + 動詞 regex），不寫死 confirm testid
- [ ] **反饋元素用 `getFeedbackElement(page)`** 或 `getByRole('alert' / 'status')`
- [ ] **實體查找用 `findEntity(page, /<name>/)`**，不寫死 row layout
- [ ] **flow 用 regex 語意的，spec 也用 regex**；flow 用 exact 文字（如錯誤訊息）的，spec 才用 exact
- [ ] **v2 helper 已 export 到 `test/e2e/helpers/`**（findEntity / maybeConfirm / getFeedbackElement / waitForApiCall）

### 既有規則（仍生效）
- [ ] 所有語法規則已遵守（見「Playwright 必遵守規則 > 語法規則」表）
- [ ] 所有交叉比對已完成（見「Playwright 必遵守規則 > 交叉比對規則」表）
- [ ] getByText / role 斷言已檢查 strict mode violation 風險（首選 scope，非 testid）
- [ ] 未驗證的值已標註 `// ⚠️ 未驗證` 註解
