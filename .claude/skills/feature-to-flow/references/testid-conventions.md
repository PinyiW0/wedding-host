# data-testid 命名規則（v2）

> **本檔是 testid 規範的 SSOT / 契約**——全 repo 對「testid 該不該用、該長怎樣」只有這一份權威。
> 消費端（`/feature-to-flow` 寫 flow、`/feature-to-ui` 產 UI、`/test e2e` 產 spec、`/vibe-e2e` 推 locator）一律指讀本檔，不自帶第二套命名規則。改本檔前先想清楚：下游全部照這裡走。

`.flow.md` 內**如需使用** `data-testid`（fallback 場景）必須遵守此規則。後續 `/feature-to-ui` 產出 UI、`/test e2e` 產 spec 時也以此為準。

---

## ⚠️ 重要：v2 抽象化原則（先讀這段）

**testid 不再是 `.flow.md` 的預設斷言手段，而是 fallback**。

定位優先序：

1. **語意 role + accessible name**（首選）
   `page.getByRole('button', { name: /匯出.*單次/ })`、`page.getByRole('row', { name: /陳小明/ })`

2. **可見文字 / 角色語意元素**
   `page.getByText(/已收藏/)`、`page.getByRole('alert')`

3. **API spy**（destructive / outcome 驗證）
   `page.waitForRequest(req => /\/sightings\/[^/]+$/.test(req.url()) && req.method() === 'DELETE')`

4. **testid**（fallback only）—— 僅在以下情況用：
   - role + name 無法消歧（同頁多個相同 role 與名稱）
   - 純樣式元素無語意角色（spacer、wrapper）
   - 動態狀態屬性（如 `data-favorited="true"`）

**為什麼這樣**：testid 對 UI 結構漂移（vibe iteration、layout 重組）零容忍，會把可變 UX 凍結成合約。語意 locator 描述「使用者怎麼找到這個元素」，與結構解耦，吸收 UX 迭代。

---

## 合約可定位表面

`.flow.md` 的 testid **不是**「實作該長什麼樣」，而是「合約承諾哪些元素可被 spec 穩定定位」。範圍嚴格限制——過寬會把可變 UX 凍結成合約。

### 兩種 testid 用途，只有第一種進合約

| 用途 | 寫進 flow.md？ | 範例 |
|------|---------------|------|
| **實體 locator**：識別「哪一個」業務實體 | ✅ 進合約 | `camera-row-{deviceId}`、`sighting-row-{sightingId}` |
| **欄位 cell**：定位 row 內哪個欄位 | ❌ 不進合約 | ~~`sighting-row-sighting-001-speed`~~（v1 殘留，禁止） |

**為什麼欄位 testid 不進合約**：欄位呈現方式是 vibe 可動空間（表格欄、卡片區塊、tooltip、modal、圖表點）。凍結欄位 testid = 凍結 UX。spec 該驗的是「該 row 顯示了 130」，不是「某個 testid 元素的 textContent 是 130」。用 `findRow(/sighting-001/).getByText(/130/)` 就夠。

### 什麼時候 row locator 需要 testid（vs 純 role+name）

**預設不用**——`getByRole('row', { name: /sighting-001/ })` 在 businessId 可見時夠用。**只有以下三種情況**才在 flow.md 寫 `{entity}-row-{businessId}`：

1. **businessId 不顯示給使用者**（如 deviceUUID，UI 只顯示「攝影機 A」）
2. **同名碰撞**（兩台 camera 都叫「攝影機 A」，靠 businessId 區分）
3. **同一實體多處呈現**（同一 sighting 同時出現在表格列與圖表點，需要關聯）

### 「漏實作欄位」改用 spec 紅燈反映

v1 強制「view 14 欄→14 個 testid」是為了防止 Claude 漏實作欄位（04-watch 14 欄只做 1 欄的歷史教訓）。v2 改由：

- `.flow.md` 的 Scenario 寫業務 assertion（「使用者必須能在 sighting row 看到 speed 與 lightPeak」）
- spec 用語意 locator 驗（`findRow(/sighting-001/).getByText(/130/)`、`findRow(/sighting-001/).getByText(/2200/)`）
- 漏實作 → spec 紅 → 修 UI

而**不是**用 testid 數量綁定欄位數量。

### 允許 pattern 清單

| pattern | 場景 | 備註 |
|---------|------|------|
| `{entity}-row-{businessId}` | row locator 三個例外情境 | businessId 來自 domain，不可是 array index |
| `{entity}-{action}-button-{businessId}` | row 內動作按鈕，businessId 不可見時 | 同上 |
| `{entity}-list-empty` | empty state，無語意 anchor 時 | 優先試 `getByText(/尚無.../)` |
| `{entity}-create-button` | 全域唯一動作按鈕的 fallback | role+name 通常夠用 |
| `toast-success` / `toast-error` | 全域回饋元素，`getByRole('alert')` 無法消歧時 | 優先試 role anchor |
| `{entity}-{action}-error` | 錯誤必須**留在表單內**（inline）時 | 一般情況用 toast 即可 |

### 禁止出現在 flow.md 的 pattern

- `{entity}-row-{id}-{column}`（v1 強制 14 欄殘留）
- 任何 column-level testid（`*-speed`、`*-light-peak`、`*-radiant-axis`...）
- `{entity}-{field}-input` / `-select` / `-checkbox` 等表單欄位形式（form input 用 `getByLabel(/入射速度/)` 找）
- `{page}-page` 容器 testid（用 `page.locator('h1', { hasText: /入射速度分析/ })` 等語意 anchor）
- 從 `.feature` payload 逐欄推導 testid（v1 做法；payload 欄位對應的是表單 label，不是 testid）

---

## Fallback 命名格式

當你確定要用 testid（符合上方允許清單），命名遵守：

```
{entity}-{role}[-{element}][-{id}]
```

| 段 | 必填 | 說明 | 範例 |
|----|------|------|------|
| `entity` | ✅ | 業務實體（kebab-case 單數） | `account`、`station`、`site`、`watch`、`sighting`、`camera`、`export` |
| `role` | ✅ | 元素角色 | `list`、`row`、`create`、`delete` |
| `element` | 視情況 | HTML/UI 元素類型 | `button`、`modal`、`empty` |
| `id` | 動態列表項才加 | 該筆資料的 businessId | `acc-001`、`station-001` |

字母全小寫、單字以 `-` 分隔。**禁止**駝峰、底線、空格、大寫。

### 反例（禁止）

| ❌ 錯誤 | ✅ 正確 | 原因 |
|--------|--------|------|
| `accountList` | `account-list-empty` | 駝峰、缺 role |
| `btn-create-account` | `account-create-button` | entity 應在最前 |
| `account_row_001` | `account-row-acc-001` | 不要底線、id 要完整 |
| `row-1` | `account-row-acc-001` | id 應為資料 id 而非索引 |
