# Phase 1：依計畫產出 .flow.md

## 目標

依 Phase 0 確認過的計畫，將每個 module 寫成一份 `spec/e2e-flows/{NN}-{module}.flow.md`（兩位編號，從 01 起跳）。

> **v2 抽象化原則**（先讀）：
> `.flow.md` 是 business invariants 的描述文件，不是 UI 步驟腳本。
> Steps 用使用者意圖（自然語言），Expected 用業務可觀察結果（API outcome / 反饋元素 / 狀態變化）。
> testid 為 fallback；首選 role + accessible name，次選 API spy。
> 詳見 [flow-template.md](flow-template.md) 與 [testid-conventions.md](testid-conventions.md) 的 v2 段落。

---

## 前置檢查

1. 確認 `spec/e2e-flows/` 目錄存在；不存在則建立
2. 若使用者在 Phase 0 調整了分組或路由，**以最新對話為準**，不要套用預設表
3. 若沒有 Phase 0 計畫（使用者直接執行 `/feature-to-flow 1`），先回退執行 Phase 0

---

## 寫檔流程

對每個 module 執行以下步驟：

### 1. 載入範本

讀 `references/flow-template.md`，了解 `.flow.md` 應有的結構。

### 2. 為每個 Scenario 產出一段 Flow

每個 `Scenario:` 對應 `.flow.md` 中一個 `## Flow:` 區段。映射規則：

| .feature 元素 | .flow.md 對應 |
|--------------|---------------|
| `Feature:` 名稱 | 在 flow 區段標題前加註「對應 Feature」 |
| `Scenario:` 名稱 | `## Flow: {scenarioName}` |
| `@happy-path` tag | flow 標題後加 `（happy-path）` |
| `@not-found` / `@condition` / `@integrity-constraint` 等 | flow 標題後加對應標籤 |
| `Given the X event has occurred` | `### Setup` 區塊的初始資料 |
| `Given the AccountList view returns` | `### Setup` 區塊（描述初始畫面狀態） |
| `Given no prior events` | `### Setup`：「系統無既有資料」 |
| `When Coach sends Create*` | `### Steps` 區塊的 UI 動作（點按鈕、填表單） |
| `When System sends ...`（System / Translator） | **不轉成 UI 步驟**，移到 `### Background sync` 區塊備註 |
| `When the X view is queried` | `### Steps`：「開啟 /xxx 頁面」 |
| `Then the X event is emitted` | `### Expected`：對應的成功反饋（toast、列表更新） |
| `Then the operation fails with: 訊息` | `### Expected`：「顯示錯誤訊息：{訊息}」 |
| `Then the view returns [...]` | `### Expected`：表格列出對應筆數與內容（用 testid 驗證） |

### 3. 對 Command 型 Scenario 補完 UI 步驟

`.feature` 的 `When ... sends Command` 只給命令名與 payload；要翻譯成 UI 操作。**用使用者意圖描述，不寫死 testid**。

**輸入（.feature）：**
```gherkin
When Coach sends CreateAccount on stream "acc-001":
  """
  { "name": "王教練", "username": "coach_wang", "password": "pass1234", "remark": "U12 教練" }
  """
```

**輸出（.flow.md `### E2E 驗證流程`）：**
```markdown
1. 進入 `/accounts` 頁面
2. 觸發「建立帳號」（位置與形式不限：toolbar / float button / menu）
3. 填寫表單欄位：
   - 姓名 → 王教練
   - 帳號 → coach_wang
   - 密碼 → pass1234
   - 備註 → U12 教練
4. 提交表單

### Verification 策略
- API spy：`POST /api/v1/accounts` 被呼叫，payload 含上述四欄
- UI：表單關閉、列表新增「王教練」實體

### 不再凍結
- 觸發按鈕的形式與位置
- 表單呈現（modal / inline panel / 獨立頁）
- 欄位 input 類型（text / 下拉 / segment）
- 提交按鈕文字（「建立」/「新增」/「送出」皆可）
```

**比較舊風格（已淘汰）**：

```markdown
❌ 1. 點擊 `[data-testid="account-create-button"]`
❌ 2. 驗證 `[data-testid="account-create-modal"]` 顯示
❌ 3. 在 `[data-testid="account-name-input"]` 填入「王教練」
... (8 步全寫死 testid)
```

舊風格凍結了「按鈕在哪、modal 一定要出現、每個 input 的 testid 命名」。vibe 把它改成 inline panel、segment button、無 modal 都會紅。

**新風格**只描述「使用者要做什麼」，UI 怎麼呈現由 `/feature-to-ui` 決定。

### 4. 對 View 型 Scenario 補完驗證步驟（v2 抽象化規則）

`.feature` 的 `Then the view returns [...]` 給定一個 JSON 陣列。要翻譯成 **business invariant 斷言**，**不是逐欄 testid 斷言**。

---

#### 新規則（v2）

**每個 view 欄位必須是 UI 可達（accessible by user），但位置與形式不受限**：可以在 row、card、drawer、tooltip、詳情頁，由 `/feature-to-ui` 決定。

`.flow.md` 的 spec 必須涵蓋：

1. **主要識別欄位**（讓使用者識別這是哪筆資料）
   - 例：pitch-type、player name、practice item
   - 用語意 locator 找實體：`getByRole('row', { name: /FF/ })`
2. **業務狀態欄位**（驅動 user behavior）
   - 例：已收藏 / 未收藏、進行中 / 已結束、連線中 / 已斷線
   - 用文字 / role 語意斷言
3. **代表性 metric 抽樣**（一兩個關鍵數值代表「資料有流到 UI」）
   - 例：speed = 130 找得到、player name 找得到
   - **不必驗每欄具體值**——單位/格式可能迭代（如 inch→cm、°→HH:mm、imperial→metric）

不在主 flow 寫的細節欄位，分兩種處理：

- **(a) 抽樣式概覽斷言**：在主 flow 寫「speed 130 出現於 pitch-001 範圍」一條代表
- **(b) 深度 sub-flow**：另起一個 `## Flow: 開啟 pitch detail / drawer` scenario，獨立驗證所有 metric 可達

---

#### 簡單範例（4 欄 list）

輸入：
```gherkin
Then the view returns:
  """
  [
    { "accountId": "acc-001", "name": "王教練", "username": "coach_wang", "remark": "U12" },
    { "accountId": "acc-002", "name": "李教練", "username": "coach_li", "remark": null }
  ]
  """
```

輸出（v2）：

```markdown
### E2E 驗證流程
1. 進入 `/accounts`
2. 期待：列表上能識別兩個帳號實體（不限 layout）

### Verification 策略
- `getByRole('row', { name: /王教練/ })` 或 `getByText(/王教練/)` 找實體
- entity 範圍內驗 username（`coach_wang`）與 remark（`U12`）可見
- 同樣驗 acc-002：李教練 / coach_li / remark 為空（用 `:not(:has-text("U"))` 或省略 remark 斷言）

### Business Invariant 必涵蓋
- 兩筆帳號可被識別
- 每筆顯示 name / username
- 有 remark 者顯示 remark
```

---

#### 多欄位範例（投球 14 欄 — 抽象化重點）

輸入見 `gherkin-export.feature` 的 PracticePitches view returns。

**舊風格（v1，已淘汰）**：14 條 testid 斷言全寫死，包含具體單位（°、cm、km/h）與具體數值（38、-15、2200）。後果：vibe 把 row 改 card / drawer，14 條全紅；vibe 改單位（imperial→metric），數值對不上。

**新風格（v2）**：

```markdown
### E2E 驗證流程
1. 進入 `/practice/practice-001`
2. 識別 pitch-001（pitch-type = FF）與 pitch-002（pitch-type = CB）
3. 驗證收藏狀態：pitch-001 顯示「已收藏」、pitch-002 顯示「未收藏」

### Verification 策略
- `findEntity(/FF/)` / `findEntity(/CB/)` 找球
- entity 內找 `getByRole('button', { name: /取消收藏/ })`（已收藏）或 `/^收藏/`（未收藏）
- 抽樣：能在 pitch-001 範圍內找到 speed `130`、player `陳小明`（代表資料流通）

### 完整 metric 驗證（sub-flow，可選）
另起 `## Flow: 開啟投球詳情（happy-path）`：
1. 從投球清單觸發「查看詳情」進入 detail / drawer
2. 驗證 detail 有可達的 metric 標籤：球速、轉速、轉軸、效率、ssw、進壘角、垂直位移、水平位移、定位、影片連結
3. **不驗具體數值或單位**，只驗 label 與對應值能對到

### 不再凍結
- 14 欄是否全顯在 row（可移 drawer）
- 數值單位（mph / km/h / °/HH:mm / imperial / metric）
- video href 字面值
```

---

#### 影片 / 連結欄位

**仍是 invariant**：影片必須可被使用者開啟。

驗證寫法：
```markdown
- entity 範圍內能找到「查看影片」/「播放」等可觸發元素
- 或：能找到 `<a>` / `<video>` 元素且 href / src 不為空
```

**不驗 href 字面值**（vibe 可能換 CDN、加 query string、改 mock URL）。

---

#### View 多欄位的舊硬規則被取消的原因

舊規則「每欄一條 testid 斷言」存在的動機：防止 UI 漏實作（曾發生 14 欄只實作 1 欄）。

v2 用不同機制達成同樣目的：

| 目的 | 舊機制 | 新機制 |
|---|---|---|
| 防止 UI 漏欄位 | testid 每欄斷言 | sub-flow 開 detail / drawer 驗 label 可達 |
| 防止資料沒流到 UI | 每個欄位值斷言 | 主流抽樣（1-2 個代表性值）+ API spy 確保資料正確 |
| 防止 layout 假設 | 硬寫 row 結構 | 用 role 找實體，允許 row / card / drawer |

新機制少了「精確到每欄每值」的保護，**但這部分由「visual regression」或「manual QA」補**，不該由 E2E 扛——E2E 扛不動「14 欄 ×2 筆 × 各種單位變體」的維護負擔。

---

#### 反例對照

```markdown
❌ - `[data-testid="pitch-row-pitch-001-spin-axis"]` 顯示「210」(°)
   ← 凍結了 row layout + 單位 + 具體值，vibe 三項都動就紅

✅ - 在 pitch-001 範圍內，spin-axis 對應的數值或時鐘字串可被找到
   ← 描述 invariant，不鎖呈現

✅ - `[data-testid="pitch-row-pitch-001"]` 包含「FF」（pitch-type 識別）
   ← 抽樣識別欄，OK
```

### 5. 處理 System / Translator Scenario

`.feature` 中由 `System` 或 `Translator` 觸發的 Scenario（例如「記錄投球」、「註冊相機」、「更新相機狀態」）並非使用者直接操作。寫入 `.flow.md` 時：

- 仍保留為一個 `## Flow:` 區段（標註 `（背景同步）`）
- `### Steps` 改為「背景觸發條件」，列出觸發來源
- `### Expected` 描述 UI 列表/狀態應如何反映變化（仍用 testid 驗證）

### 6. 加入檔頭與背景

每份 `.flow.md` 必須有：

- 一級標題 `# Flow: {module 中文名}`
- `## Background` 區塊（共用前置條件，例如「已登入」、「測試帳號 admin」）
- `## Testid 索引`（可選）：列出本檔所有用到的 testid，方便 UI 實作時 grep

> 詳見 [flow-template.md](flow-template.md)

---

## 完成後

- 列出寫入的檔案路徑與大小
- 提示：「下一步：`/feature-to-api` 產出 API 合約與 Mock」
- 不要主動執行下一步指令
