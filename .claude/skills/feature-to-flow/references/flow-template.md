# .flow.md 結構範本（v2 — 抽象化版）

每份 `spec/e2e-flows/{module}.flow.md` 都遵守此結構。

> **v2 改變什麼**：從「每個 Step 寫 testid、每個欄位寫 testid 斷言」改為「描述 business invariants、用語意 locator、允許 UX 迭代」。
> **目的**：讓 UI 之後做 vibe iteration（換 layout、改顯示格式、加 drawer/card）時不需要 spec 跟著改。

---

## 整體骨架

```markdown
# Flow: {模組中文名稱}

> 對應規格：spec/gherkin-feature/{filename}.feature
> 涵蓋頁面：/route-a, /route-b

## Background
- {共用前置條件，如已登入為管理者 / 測試帳號 admin}

---

## Business Invariants（合約核心）

{以條列描述本模組業務合約，與 UI 形式無關}
1. {使用者能執行 X 操作}
2. {資料 Y 可被使用者讀到（不限位置與形式）}
3. {狀態 Z 變更後使用者能感知（toast / banner / 任何語意反饋皆可）}

---

## Flow: {Scenario 名稱}（{tag}）

> 對應 Feature: {feature 名稱} → Scenario: {scenario 名稱}

### 業務脈絡
- {初始事件/資料狀態，仿 .feature 的 Given}

### E2E 驗證流程
1. {使用者意圖，自然語言，非 testid 命令}
2. {互動的「動詞 + 對象語意」，例：「觸發匯出此次練習」、「在 pitch-001 旁觸發收藏」}
3. ...

### Verification 策略
- {對應 outcome 怎麼驗證：API spy / 狀態變化 / 反饋元素}
- {若需要 testid 才能消歧，明確標示 fallback 用途}

### 不再凍結（UX 自由區）
- {列出本 scenario 不限定的 UX 細節，例：confirm 形式、layout、措辭同義詞}

---

## Selector 策略（v2 通則）

優先序：
1. **role + name regex**：找實體與按鈕（涵蓋同義詞）
2. **可見文字 / role=alert / role=status**：找反饋
3. **API spy（waitForRequest）**：抓 destructive / async outcome
4. **testid**：fallback 用，僅限 role 無法消歧時

---

## Mock 假設
- {說明本 flow 依賴的 mock seed}
- {API 端點與 payload 期待}
```

---

## 完整範例：練習投球管理（節錄）

以下展示**抽象化**的寫法，對照 v1 的 testid-heavy 版本。

```markdown
# Flow: 練習與投球管理

> 對應規格：spec/gherkin-feature/gherkin-export.feature
> 涵蓋頁面：/practice/history, /practice/{practiceId}（含 live）

## Background
- 已登入為管理者（admin / admin888）
- 既存資料：player-001（陳小明）、player-002（林大華）

---

## Business Invariants

1. 在歷史頁面能找到所有未刪除的 practice，且能識別 item / player / 狀態
2. 在練習詳情下能看到所有未刪除的 pitch（透過 row / card / drawer 任一形式）
3. 每球的關鍵屬性（pitch-type、player、收藏狀態）可被使用者識別
4. 完整 metric（speed / spin-rate / approach-angle / 等 14 欄）必須可被使用者讀到——可以**全在 row**、**部分在 row 部分在 detail**、**全在 drawer 點開**，由 UI 決定，但**不可漏**
5. 收藏 / 取消 / 刪除 / 結束 / 切換投手等操作必須可觸發，且操作後可感知結果

---

## Flow: 顯示練習歷史（happy-path）

> 對應 Feature: 練習歷史總覽 → Scenario: 顯示練習歷史

### 業務脈絡
- mock seed 有 practice-001：投球訓練 / 陳小明 / 2 球 / 已結束

### E2E 驗證流程
1. 進入 `/practice/history`
2. 若採 calendar / drill-down UX，互動進入有練習紀錄的範圍（如點日期格）
3. 期待：能找到含「投球訓練」、「陳小明」資訊的可識別實體

### Verification 策略
- 用 `getByText(/投球訓練/)`、`getByText(/陳小明/)` 找文字
- 狀態（已結束）依 UX 取捨：若日曆隱含、則不必硬斷言；若 list 顯示則加 `getByText(/已結束/)`

### 不再凍結
- 列表形式（table / card / calendar / timeline）
- 是否預設展開（calendar 需互動、table 預設展示，皆可）
- 「已結束」的視覺呈現（badge / icon / 隱含於分區）

---

## Flow: 顯示投球清單（happy-path）

> 對應 Feature: 練習投球清單 → Scenario: 顯示投球清單

### 業務脈絡
- practice-001 含 pitch-001 (FF, 已收藏) 與 pitch-002 (CB, 未收藏)

### E2E 驗證流程
1. 進入 `/practice/practice-001`
2. 識別 pitch-001（pitch-type = FF）：用 `getByRole('row', { name: /FF/ })` 或 `getByRole('article', { name: /FF/ })`
3. 識別 pitch-002（pitch-type = CB）：同上
4. 驗證 pitch-001 顯示「已收藏」（有對應的「取消收藏」按鈕）
5. 驗證 pitch-002 顯示「未收藏」（有「收藏」按鈕）

### Verification 策略（metric 完整性）
- **主流 invariant**：pitch-type / favorite 狀態用 role/text 驗，不鎖具體格式
- **深度 invariant**（可選 sub-flow）：開啟某 pitch 的 detail / drawer，驗證至少 3-4 個關鍵 metric（speed / spin-rate / pitch-type / player）可達。**不必驗 14 欄具體值**，因為單位/格式可能迭代（°→HH:mm、imperial→metric）

### 不再凍結
- 14 個 metric 是否全顯在 row（可移至 drawer / detail）
- 數值格式（mph / km/h / °/HH:mm / imperial / metric）
- video 連結的具體 href（檢查「有可開啟的影片元素」即可）

---

## Flow: 成功收藏單球（happy-path）

> 對應 Feature: 收藏單球 → Scenario: 成功收藏

### 業務脈絡
- pitch-002 未收藏

### E2E 驗證流程
1. 進入 `/practice/practice-001`
2. 在 pitch-002 實體範圍內，觸發「收藏」按鈕（role=button, name 含「收藏」前綴）
3. 期待：狀態翻轉為「已收藏」（同一按鈕變「取消收藏」，或出現「已收藏」標記）

### Verification 策略
- 範圍：先用 role 找 pitch-002 entity，再在 entity 範圍內找 button
- 狀態：驗證 entity 內出現「取消收藏」按鈕（state-based assertion，不依賴 data-favorited 屬性）

### 不再凍結
- 按鈕 icon / 顏色 / 動畫
- 是否有額外反饋（toast / inline indicator）
- 收藏狀態的 ARIA / data attribute 命名

---

## Flow: 成功刪除單球（happy-path）

> 對應 Feature: 刪除單球 → Scenario: 成功刪除單球

### 業務脈絡
- pitch-001 已記錄、未刪除

### E2E 驗證流程
1. 進入 `/practice/practice-001`
2. 在 pitch-001 實體範圍內，觸發「刪除」按鈕
3. 若有 confirm dialog，完成確認（dialog 內動詞按鈕，如「刪除」/「確認」）
4. 期待：
   - `DELETE /api/v1/practices/{id}/pitches/{id}` 被呼叫（API spy）
   - pitch-001 不再可見於清單

### Verification 策略（destructive 操作）
- 主要靠 API spy：`page.waitForRequest(req => /\/pitches\/[^/]+$/.test(req.url()) && req.method() === 'DELETE')`
- UI 補：執行後 pitch-001 entity 不可見

### 不再凍結
- confirm 形式（modal / inline / 滑動皆可）
- 觸發按鈕的位置（cell / hover / kebab menu）
- 反饋形式（toast / banner / inline）

---

## Flow: 缺少練習 ID（field-validation, API 邊界）

> 對應 Feature: 請求匯出 → Scenario: 缺少練習 ID

### 性質
API-only。UI 不應該能進入此狀態，主要保護 API 合約。

### 驗證流程
- 直接 `POST /api/v1/exports` 帶 `{ exportType: 'single-practice', practiceId: null }`
- 期待：400，訊息含「匯出單次練習時必須提供 practiceId」
```

---

## 撰寫原則（v2）

### 1. 每個 Scenario 對應一個 `## Flow:` 區段
不變。

### 2. Steps 用「使用者意圖」描述，不寫 testid
- ✅ 「觸發匯出此次練習」
- ✅ 「在 pitch-001 範圍內觸發收藏」
- ❌ 「點擊 `[data-testid="export-single-practice-button"]`」

### 3. Expected 用「可觀察的業務結果」描述
- ✅ 「`POST /api/exports` 被呼叫，payload {...}」
- ✅ 「pitch-001 不再可見於清單」
- ✅ 「使用者能看到成功反饋（role=alert / role=status / 「已送出」文字）」
- ❌ 「`[data-testid="toast-success"]` 顯示「匯出請求已送出」」（過度具體文字 + testid）

### 4. View 多欄位（**重要規則修訂**）

**舊規則**（v1）：「view returns 每欄都要 `{entity}-row-{id}-{column}` testid 斷言」

**新規則**（v2）：
- 每個欄位**必須是 UI 可達**（accessible by user），但**不限定位置**：可在 row、card、drawer、tooltip、詳情頁
- spec 不必對「每欄寫斷言」，但**必須涵蓋「主要識別欄」+「狀態欄」**：
  - 主要識別欄：例如 pitch-type、player、practice item（讓使用者能識別這是哪筆資料）
  - 狀態欄：收藏 / 進行中 / 已結束等業務狀態
- 其他細節欄位（如 spin-axis 數值、verticalBreak cm 等）可選擇：
  - (a) 在主 flow 寫「能找到代表性數值」概覽斷言（如「speed 130 出現於 pitch-001 範圍」）
  - (b) 開「detail / drawer」sub-flow 獨立驗證該情境下能看到所有 metric label
- **不可省的**：影片連結（驗證有可開啟的影片元素）

### 5. UX 取捨記錄
若發現 UI 迭代帶來 UX 簡化（例：calendar 隱含狀態、metric 改 drawer 顯示），在「不再凍結」段註明，**不強制斷言**，但業務 invariant 必須由其他 flow 守護。

### 6. testid 退最後手段
詳見 [testid-conventions.md](testid-conventions.md) 的「v2 抽象化原則」段。

### 7. System / Translator 觸發的 Scenario
標記為 `（背景同步）`，Steps 改為「背景觸發條件」，verification 改用 API spy + UI side-effect。

---

## 反例對照

### ❌ 過度具體（v1 風格，會被 vibe 破壞）

```markdown
### Steps
1. 點擊 `[data-testid="pitch-delete-button-pitch-001"]`
2. 驗證 `[data-testid="pitch-delete-confirm-modal"]` 顯示
3. 點擊 `[data-testid="pitch-delete-confirm-button"]`

### Expected
- `[data-testid="toast-success"]` 顯示「刪除成功」
- `[data-testid="pitch-row-pitch-001"]` 從列表消失
- `[data-testid="practice-pitch-count"]` -1
```

### ✅ 抽象化（v2 風格，吸收 vibe）

```markdown
### E2E 驗證流程
1. 在 pitch-001 實體範圍內，觸發「刪除」
2. 若有 confirm dialog，完成確認
3. 期待：
   - `DELETE /api/v1/practices/*/pitches/*` 被呼叫
   - pitch-001 不再可見於清單

### 不再凍結
- confirm 形式（modal / inline / 滑動）
- 觸發按鈕位置（cell action / kebab menu / hover）
- 反饋形式（toast / banner / inline）
- 投球計數的呈現位置與格式
```

---

## 共用 helper 模式

`.flow.md` 不直接寫程式碼，但要描述 verification 策略時可引用以下標準 pattern（由 `/test e2e spec` 翻譯成實際 helper）：

| 模式 | 用途 |
|---|---|
| `findEntity(role, name regex)` | 找實體（row / article / listitem 多形式接受） |
| `triggerActionByIntent(entity, action regex)` | 在 entity 範圍內觸發語意動作 |
| `maybeConfirm(page)` | 可選二次確認（dialog scope，動詞 regex） |
| `waitForApiCall(method, urlPattern)` | API spy |
| `getFeedbackElement(page)` | 找成功反饋（role=alert / status / 文字 regex） |

---

## 何時還是可以用 testid

明確的 testid 適用情境：

1. **狀態 attribute**：`data-favorited="true"`、`data-selected="true"` 等業務狀態（純 ARIA 不夠表達時）
2. **同頁多個同名 role**：例如多個「確認」按鈕分散在不同區塊
3. **無語意純樣式元素**：spacer、divider、wrapper 等

即使用 testid，命名仍遵守 [testid-conventions.md](testid-conventions.md)。
