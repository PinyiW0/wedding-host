# data-testid 命名規則

`.flow.md` 內所有 `data-testid` 必須遵守此規則。後續 `/feature-to-ui` 產出 UI 時也以此為準。

---

## ⚠️ 重要：v2 抽象化原則（先讀這段）

**testid 不再是 `.flow.md` 的預設斷言手段，而是 fallback**。

定位優先序：

1. **語意 role + accessible name**（首選）
   `page.getByRole('button', { name: /匯出.*單次/ })`、`page.getByRole('row', { name: /陳小明/ })`

2. **可見文字 / 角色語意元素**
   `page.getByText(/已收藏/)`、`page.getByRole('alert')`

3. **API spy**（destructive / outcome 驗證）
   `page.waitForRequest(req => /\/pitches\/[^/]+$/.test(req.url()) && req.method() === 'DELETE')`

4. **testid**（fallback only）—— 僅在以下情況用：
   - role + name 無法消歧（同頁多個相同 role 與名稱）
   - 純樣式元素無語意角色（spacer、wrapper）
   - 動態狀態屬性（如 `data-favorited="true"`）

**為什麼這樣**：testid 對 UI 結構漂移（vibe iteration、layout 重組）零容忍，會把可變 UX 凍結成合約。語意 locator 描述「使用者怎麼找到這個元素」，與結構解耦，吸收 UX 迭代。

**保留本檔規範的場景**：當你確定要用 testid（fallback），命名仍遵守下列基本格式，以保持可預測性。

---

## 基本格式

```
{entity}-{role}[-{element}][-{id}]
```

| 段 | 必填 | 說明 | 範例 |
|----|------|------|------|
| `entity` | ✅ | 業務實體（kebab-case 單數） | `account`、`player`、`team`、`practice`、`pitch`、`camera`、`export` |
| `role` | ✅ | 元素角色 | `list`、`row`、`create`、`edit`、`delete`、`search`、`filter` |
| `element` | 視情況 | HTML/UI 元素類型 | `button`、`input`、`modal`、`table`、`page`、`form`、`submit`、`cancel` |
| `id` | 動態列表項才加 | 該筆資料的 ID | `acc-001`、`player-001` |

字母全小寫、單字以 `-` 分隔。**禁止**駝峰、底線、空格、大寫。

---

## 常用模式

### 頁面容器

```
{entity}-list-page              # 列表頁
{entity}-detail-page            # 詳情頁
```

範例：`account-list-page`、`practice-detail-page`

### 列表 / 表格

```
{entity}-list-table             # 表格本體
{entity}-list-empty             # 空狀態提示
{entity}-row-{id}               # 單列（含資料 id）
{entity}-row-{id}-{column}      # 單列的特定欄位（如需驗證單一欄位）
```

範例：`account-list-table`、`account-row-acc-001`、`pitch-row-pitch-001-speed`

### 操作按鈕

```
{entity}-create-button          # 開啟新增
{entity}-edit-button-{id}       # 編輯該筆
{entity}-delete-button-{id}     # 刪除該筆
{entity}-{action}-button[-{id}] # 自訂動作（favorite, unfavorite, switch 等）
```

範例：
- `account-create-button`
- `account-edit-button-acc-001`
- `account-delete-button-acc-001`
- `pitch-favorite-button-pitch-001`
- `practice-end-button`

### 對話框 / Modal

```
{entity}-{action}-modal             # 對話框本體
{entity}-{action}-submit-button     # 確認按鈕
{entity}-{action}-cancel-button     # 取消按鈕
```

範例：
- `account-create-modal`
- `account-create-submit-button`
- `account-create-cancel-button`
- `account-delete-confirm-modal`
- `account-delete-confirm-button`

### 表單欄位

```
{entity}-{field}-input          # 文字輸入
{entity}-{field}-select         # 下拉選單
{entity}-{field}-checkbox       # 勾選框
{entity}-{field}-radio          # 單選
{entity}-{field}-textarea       # 多行文字
{entity}-{field}-error          # 該欄位錯誤訊息
```

> `{field}` 取 `.feature` payload 內的 key，轉 kebab-case：
> - `playerName` → `player-name`
> - `hashedPassword` → 不會出現在 UI；UI 用 `password`
> - `battingHand` → `batting-hand`

範例：
- `account-name-input`
- `account-username-input`
- `account-password-input`
- `account-remark-input`
- `player-batting-hand-select`
- `player-team-id-select`

### 搜尋 / 篩選

```
{entity}-search-input           # 搜尋框
{entity}-filter-{field}-select  # 篩選下拉
{entity}-filter-clear-button    # 清除篩選
```

範例：`player-search-input`、`player-filter-team-id-select`

### 全域元件

```
toast-success                   # 成功 toast
toast-error                     # 錯誤 toast
loading-overlay                 # 全頁載入遮罩
sidebar-nav-{module}            # 側邊欄連結
logout-button
```

---

## 對應規則：從 .feature payload 推導 testid

當 `.feature` 出現一個 command/event payload 時，對每個欄位推導 testid：

```gherkin
When Coach sends CreatePlayer on stream "player-001":
  """
  {
    "playerName": "陳小明",
    "teamId": "team-001",
    "battingHand": "right",
    "throwingHand": "right",
    "height": 165,
    "weight": 55
  }
  """
```

對應的表單 testid：

| payload key | testid | 元素 |
|-------------|--------|------|
| `playerName` | `player-name-input` | text input |
| `teamId` | `player-team-id-select` | select（外鍵） |
| `battingHand` | `player-batting-hand-select` | select / radio |
| `throwingHand` | `player-throwing-hand-select` | select / radio |
| `height` | `player-height-input` | number input |
| `weight` | `player-weight-input` | number input |

加上：
- `player-create-modal`
- `player-create-submit-button`
- `player-create-cancel-button`

---

## 合約可定位表面（v2）

`.flow.md` 的 testid **不是**「實作該長什麼樣」，而是「合約承諾哪些元素可被 spec 穩定定位」。範圍嚴格限制——過寬會把可變 UX 凍結成合約。

### 兩種 testid 用途，只有第一種進合約

| 用途 | 寫進 flow.md？ | 範例 |
|------|---------------|------|
| **實體 locator**：識別「哪一個」業務實體 | ✅ 進合約 | `camera-row-{deviceId}`、`pitch-row-{pitchId}` |
| **欄位 cell**：定位 row 內哪個欄位 | ❌ 不進合約 | ~~`pitch-row-pitch-001-speed`~~（v1 殘留，禁止） |

**為什麼欄位 testid 不進合約**：欄位呈現方式是 vibe 可動空間（表格欄、卡片區塊、tooltip、modal、圖表點）。凍結欄位 testid = 凍結 UX。spec 該驗的是「該 row 顯示了 130」，不是「某個 testid 元素的 textContent 是 130」。用 `findRow(/pitch-001/).getByText(/130/)` 就夠。

### 什麼時候 row locator 需要 testid（vs 純 role+name）

**預設不用**——`getByRole('row', { name: /pitch-001/ })` 在 businessId 可見時夠用。**只有以下三種情況**才在 flow.md 寫 `{entity}-row-{businessId}`：

1. **businessId 不顯示給使用者**（如 deviceUUID，UI 只顯示「攝影機 A」）
2. **同名碰撞**（兩台 camera 都叫「攝影機 A」，靠 businessId 區分）
3. **同一實體多處呈現**（同一 pitch 同時出現在表格列與圖表點，需要關聯）

### 「漏實作欄位」改用 spec 紅燈反映

v1 強制「view 14 欄→14 個 testid」是為了防止 Claude 漏實作欄位（04-practice 14 欄只做 1 欄的歷史教訓）。v2 改由：

- `.flow.md` 的 Scenario 寫業務 assertion（「使用者必須能在 pitch row 看到 speed 與 spinRate」）
- spec 用語意 locator 驗（`findRow(/pitch-001/).getByText(/130/)`、`findRow(/pitch-001/).getByText(/2200/)`）
- 漏實作 → spec 紅 → 修 UI

而**不是**用 testid 數量綁定欄位數量。

### 合約可定位表面：允許 pattern 清單

| pattern | 場景 | 備註 |
|---------|------|------|
| `{entity}-row-{businessId}` | row locator 三個例外情境 | businessId 來自 domain，不可是 array index |
| `{entity}-{action}-button-{businessId}` | row 內動作按鈕，businessId 不可見時 | 同上 |
| `{entity}-list-empty` | empty state，無語意 anchor 時 | 優先試 `getByText(/尚無.../)` |
| `{entity}-create-button` | 全域唯一動作按鈕的 fallback | role+name 通常夠用 |

### 禁止出現在 flow.md 的 pattern

- `{entity}-row-{id}-{column}`（v1 強制 14 欄殘留）
- 任何 column-level testid（`*-speed`、`*-spin-rate`、`*-spin-axis`...）
- `{entity}-{field}-input` 形式（form input 用 `getByLabel(/球速/)` 找）
- `{page}-page` 容器 testid（用 `page.locator('h1', { hasText: /球速分析/ })` 等語意 anchor）

---

## 對應規則：失敗訊息

```gherkin
Then the operation fails with: 帳號名稱已存在
```

- 對應的錯誤顯示元素 testid：`{entity}-{action}-error`
- 範例：`account-create-error`、`account-login-error`

> 一般情況下用 toast (`toast-error`) 顯示即可；只有當錯誤必須**留在表單內**（inline）才需要 `{entity}-{action}-error`。

---

## 反例（禁止）

| ❌ 錯誤 | ✅ 正確 | 原因 |
|--------|--------|------|
| `accountList` | `account-list-table` | 駝峰、缺 role |
| `btn-create-account` | `account-create-button` | entity 應在最前 |
| `account_row_001` | `account-row-acc-001` | 不要底線、id 要完整 |
| `CreateAccountModal` | `account-create-modal` | 大寫、駝峰 |
| `submit` | `account-create-submit-button` | 過度泛用，會撞名 |
| `row-1` | `account-row-acc-001` | id 應為資料 id 而非索引 |
