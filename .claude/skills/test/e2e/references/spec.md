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
   page.getByRole('button', { name: /匯出.*(此次|單次|本練習)/ })
   page.getByRole('row', { name: /FF/ })  // 找實體
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

5. **testid 退 fallback only**：僅在以下情況用：
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
5. spec/gherkin-feature/{NN}-{name}.dsl.feature — 原始 Feature Background（該 feature 的初始狀態定義）
6. server/mock/data/*.ts             — 實際 mock 資料（實體名稱、日期、數值等）
7. server/api/{相關 API}.ts           — API 過濾邏輯 + 錯誤訊息（createError 的 message）

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
4. **Selector 策略以 `.flow.md` 為準（v2）**：flow 的「Selector 策略」/「Verification 策略」段授權使用哪些 locator 類型。flow 沒寫 testid 就不寫 testid 斷言；flow 用 invariant 表達就用 role/text/API spy 驗證。**禁止越權**：例如 flow 寫「pitch-001 可被識別」，spec 不得改寫成「`pitch-row-pitch-001` 包含 14 欄 testid 斷言」
5. **每個 spec 獨立可執行**：透過 `test.beforeEach` reset mock data + 清理多餘實體，確保初始狀態符合 Feature Background
6. **⚠️ 初始狀態以 Feature Background 為準**：每個 `.dsl.feature` 的 `Background:` 定義了該 feature 的初始狀態。Mock 全集是所有 feature 的 Background 合併，可能包含不屬於該 feature 的實體。Spec 必須確保測試開始時的狀態與 Feature Background 一致（見 Step 2c-2d）
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

#### 2a. 讀取 Feature Background（⚠️ 初始狀態定義）

讀取 `spec/gherkin-feature/{NN}-{name}.dsl.feature`，解析 `Background:` 區塊中的 `Given` 語句，識別**該 feature 定義的初始狀態**（哪些實體在測試開始時應該存在）。

```
Feature Background 定義：
- 使用者：admin, coach1
- 球隊：藍鷹隊（coach1）
→ 該 feature 的測試假設「只有藍鷹隊存在」
```

> ⚠️ **Feature Background ≠ Mock 全集**。Mock 資料是所有 feature 的 Background 合併而成的超集。
> 例如 feature 03 的 Background 有 4 支球隊，feature 04 的 Background 只有 1 支。
> 每個 feature 的 spec 必須基於**自己的 Background**推算預期結果，而非 mock 全集。

#### 2b. 掃描 mock data + API 過濾邏輯

1. 讀取 `server/mock/data/*.ts`，取得原始資料全集
2. 讀取 `server/api/{對應路徑}.ts`，理解 API 的過濾邏輯（日期過濾、狀態過濾、角色過濾、搜尋篩選等）
3. **以每個測試情境的角色/參數，模擬 API 過濾**，推算該情境下 API 實際會回傳哪些資料
4. 用推算結果寫斷言值，而非 raw data 的值

> ⚠️ raw data ≠ API 回傳。例如 `mockTrainings` 有 16 筆，但經過 `status === 'active'`、`date >= today`、角色過濾後，coach1 呼叫 API 可能只拿到 3~4 筆。斷言必須基於過濾後的結果。

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
  await request.delete('/api/teams/2') // 紅龍隊
  await request.delete('/api/teams/3') // 白虎隊
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
- testid: 直接使用 flow 定義（flow 是 testid 權威來源）
- toast 文字: 直接使用 flow 定義（UI 必須實作此文字）
- ⚠️ Background 衝突: mock 多餘實體 "{name}" 與建立操作衝突 → 需清理
```

### Step 3：更新 fixtures.ts

若 `.flow.md` 涉及新的路由或測試帳號，更新 `fixtures.ts`。

### Step 4：生成 .spec.ts（使用校正後的值）

---

## .spec.ts 結構（v2）

```typescript
import { expect, type Page, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  waitForApiCall,
} from '../helpers'

test.beforeEach(async ({ page, request }) => {
  await resetMockData(page)
  // 若 Feature Background ≠ mock 全集，在此調整
  // await request.delete('/api/v1/teams/team-002')
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

> **v2 範例對照**：見 `test/e2e/specs/06-export.v2.spec.ts` 與 `04-practice.v2.spec.ts`（兩個試點實作）。

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
| 實體識別值（人物名稱、pitch-type 等） | `server/mock/data/*.ts` | 用 mock 實際值，spec 用 regex 抽樣（如 `/陳小明/`、`/FF/`） |
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
await expect(page.getByTestId('pitch-favorite-button-pitch-001')).toHaveAttribute('data-favorited', 'true')
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
  req => /\/pitches\/[^/]+$/.test(req.url()) && req.method() === 'DELETE',
)
await findEntity(page, /FF/).getByRole('button', { name: /刪除/ }).click()
await maybeConfirm(page)
const request = await apiRequest
expect(request.postDataJSON()).toMatchObject({ /* expected payload */ })
```

**URL regex 通則**：用 `/\/<endpoint>(\?|$)/` 容版本路徑（`/api/v1/exports`、`/api/v2/exports` 皆過）。**禁止寫死 `/api/exports`** 字面值（會被 server 升版打掛）。

### 列表中定位特定實體（v2）

```typescript
// 用 role + 語意 name 找實體（不限 row / article / listitem 形式）
const pitchEntity = findEntity(page, /FF/)  // pitch-type 當識別
await pitchEntity.getByRole('button', { name: /取消收藏/ }).click()
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
await page.getByRole('combobox', { name: /球員/ }).click()
await page.getByRole('option', { name: '陳小明' }).click()
```

testid fallback：

```typescript
await selectOption(page, '{field-id}', '{option-label}')
```

> **注意**：option label 可能經過格式化（如 `"1 - 項目名稱"` 而非 `"項目名稱"`），必須檢查 Vue 頁面確認實際格式。

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
  await login(page, 'coach1', 'pass123')
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

```typescript
// ✅ import 排序：import type 在前、外部套件按字母、相對路徑按字母、named imports 按字母
import { expect, test } from '@playwright/test'
import { confirmDelete, login } from '../helpers'
```

生成後**必須執行**：

```bash
npm run lint --fix
npm run lint    # 確認 0 errors
```

常見問題：
- `test.skip` 導致 `expect` / `login` 未使用 → 移除未使用的 import
- 未使用參數 → 加 `_` 前綴

---

## 檢查清單

### 基礎
- [ ] fixtures.ts 已包含所需的路由和測試帳號
- [ ] import 排序符合 ESLint perfectionist 規則
- [ ] 共用操作從 `../helpers` import，spec 內無本地定義
- [ ] `test.beforeEach` 呼叫 reset + 背景調整（Feature Background vs mock 全集已比對）
- [ ] 每個 test 有 Given/When/Then 註解
- [ ] `npm run lint` 零錯誤

### v2 抽象化合規
- [ ] **flow 沒寫 testid 的地方，spec 也沒用 testid**（沒越權）
- [ ] **destructive / async outcome 用 API spy 驗證**（不只靠 UI 斷言）
- [ ] **API URL 用 regex（`/\/<endpoint>(\?|$)/`）容版本路徑**，不寫死 `/api/exports`
- [ ] **語意 regex 含同義詞集合**（如 `/匯出.*(此次|單次|本練習)/`），不鎖單一措辭
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
