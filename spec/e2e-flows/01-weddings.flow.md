# Flow: 婚禮場次管理

> 對應規格：spec/gherkin-feature/CreateWedding.feature, UpdateWeddingInfo.feature, SoftDeleteWedding.feature, RestoreWedding.feature
> 涵蓋頁面：/weddings（場次列表 + 建立 + 軟刪 / 恢復）、/weddings/[weddingId]（婚禮詳情 + 編輯資訊）

## Background
- 已登入為管理員（Admin）
- 婚禮以事件源建立，狀態包含：未刪除 / 已軟刪除

---

## Business Invariants（合約核心）

1. 管理員能建立新婚禮（輸入名稱、場地、地址、日期）
2. 管理員能更新既有婚禮資訊（時間、地點、地圖連結、停車資訊、交通指引）
3. 管理員能軟刪除婚禮（資料保留、可恢復），且能恢復已軟刪除的婚禮
4. 婚禮的關鍵識別資訊（title、venue、date）可被使用者讀到
5. 對不存在 / 狀態不符的婚禮操作時，使用者能感知失敗原因

---

## Flow: 成功建立婚禮（happy-path）

> 對應 Feature: 建立婚禮 → Scenario: 成功建立婚禮

### 業務脈絡
- 系統無既有資料（no prior events）

### E2E 驗證流程
1. 進入 `/weddings`
2. 觸發「建立婚禮」（toolbar / float button / menu 不限）
3. 填寫表單：
   - 婚禮名稱 → 王小明與李小美的婚禮
   - 場地 → 台北君悅酒店
   - 地址 → 台北市信義區松壽路2號
   - 日期 → 2026-10-10
4. 提交表單

### Verification 策略
- API spy：`POST /api/v1/weddings`，payload 含 title / venue / address / date
- UI：表單關閉、列表新增可識別的「王小明與李小美的婚禮」實體（`getByText(/王小明與李小美的婚禮/)`）

### 不再凍結
- 觸發按鈕形式與位置
- 表單呈現（modal / inline / 獨立頁）
- 日期輸入元件（date picker / text）

---

## Flow: 成功更新婚禮資訊（happy-path）

> 對應 Feature: 更新婚禮資訊 → Scenario: 成功更新婚禮資訊

### 業務脈絡
- wedding-001 已建立（王小明與李小美的婚禮）

### E2E 驗證流程
1. 進入 wedding-001 的詳情 / 編輯入口（`/weddings/wedding-001` 或列表內編輯）
2. 觸發「編輯婚禮資訊」
3. 修改欄位：
   - 場地 → 台北晶華酒店
   - 地址 → 台北市中山區中山北路二段39巷3號
   - 日期 → 2026-11-11
   - 地圖連結 → https://maps.google.com/example
   - 停車資訊 → 飯店地下停車場B2
   - 交通指引 → 捷運中山站步行5分鐘
4. 提交

### Verification 策略
- API spy：`PATCH/PUT /api/v1/weddings/wedding-001`，payload 含更新後的 venue / address / date / mapLink / parkingInfo / transportInfo
- UI：更新後能讀到新場地「台北晶華酒店」（`getByText(/台北晶華酒店/)`）

### 不再凍結
- 編輯入口位置（詳情頁 / 列表 action / kebab menu）
- 地圖 / 停車 / 交通欄位的群組與排版

---

## Flow: 更新不存在的婚禮（not-found）

> 對應 Feature: 更新婚禮資訊 → Scenario: 婚禮不存在

### 性質
API 邊界保護。UI 正常不會進入此狀態（編輯入口來自既有列表）。

### 驗證流程
- 直接 `PATCH/PUT /api/v1/weddings/wedding-999` 帶更新 payload
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 成功軟刪除婚禮（happy-path）

> 對應 Feature: 軟刪除婚禮 → Scenario: 成功軟刪除婚禮

### 業務脈絡
- wedding-001 已建立、未刪除

### E2E 驗證流程
1. 進入 `/weddings`
2. 在 wedding-001 實體範圍內觸發「刪除」
3. 若有 confirm dialog，完成確認
4. 期待：
   - API spy：`DELETE /api/v1/weddings/wedding-001`（或 `POST .../soft-delete`）被呼叫
   - wedding-001 從未刪除清單消失，或標示為「已刪除」可恢復狀態

### Verification 策略（destructive）
- 主要靠 API spy（method=DELETE 或軟刪端點）
- UI：執行後 wedding-001 不再出現在預設（未刪除）列表，或進入「已刪除」分區

### 不再凍結
- confirm 形式（modal / inline / 滑動）
- 已刪除婚禮的呈現（隱藏 / 灰階 / 移至回收區）

---

## Flow: 重複軟刪除婚禮（condition / already-deleted）

> 對應 Feature: 軟刪除婚禮 → Scenario: 婚禮已軟刪除

### 性質
API 邊界保護（UI 正常不會對已刪除婚禮再次刪除）。

### 驗證流程
- wedding-001 已軟刪除狀態下，再 `DELETE /api/v1/weddings/wedding-001`
- 期待：4xx，訊息含「婚禮已被刪除」

---

## Flow: 軟刪除不存在的婚禮（not-found）

> 對應 Feature: 軟刪除婚禮 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `DELETE /api/v1/weddings/wedding-001`（無既有資料）
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 成功恢復婚禮（happy-path）

> 對應 Feature: 恢復婚禮 → Scenario: 成功恢復婚禮

### 業務脈絡
- wedding-001 已建立且已軟刪除

### E2E 驗證流程
1. 進入 `/weddings`（含已刪除分區 / 篩選）
2. 在已軟刪除的 wedding-001 範圍內觸發「恢復」
3. 期待：
   - API spy：`POST /api/v1/weddings/wedding-001/restore`（或對應端點）被呼叫
   - wedding-001 回到未刪除清單

### Verification 策略
- API spy（restore 端點）
- UI：恢復後 wedding-001 重新出現在預設列表

### 不再凍結
- 已刪除分區的進入方式（tab / filter / toggle）
- 恢復觸發形式

---

## Flow: 恢復不存在的婚禮（not-found）

> 對應 Feature: 恢復婚禮 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST /api/v1/weddings/wedding-001/restore`（無既有資料）
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 恢復未被刪除的婚禮（condition / not-deleted）

> 對應 Feature: 恢復婚禮 → Scenario: 婚禮未被刪除

### 性質
API 邊界保護（UI 正常不對未刪除婚禮顯示恢復動作）。

### 驗證流程
- wedding-001 為未刪除狀態下，`POST /api/v1/weddings/wedding-001/restore`
- 期待：4xx，訊息含「婚禮未被刪除」

---

## Selector 策略（v2 通則）

1. role + name regex 找婚禮實體：`getByRole('row', { name: /王小明與李小美的婚禮/ })` 或 `getByRole('article', ...)`
2. 動作按鈕：`getByRole('button', { name: /建立婚禮|編輯|刪除|恢復/ })`
3. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/婚禮不存在|婚禮已被刪除|婚禮未被刪除/)`
4. 軟刪 / 恢復 outcome：`page.waitForRequest`（DELETE / restore 端點）
5. testid：fallback only（如同名碰撞時 `wedding-row-wedding-001`）

---

## Mock 假設
- seed：wedding-001（王小明與李小美的婚禮 / 台北君悅酒店 / 2026-10-10）
- `POST /api/v1/weddings` 回 201 + WeddingCreated
- `PATCH /api/v1/weddings/{id}` 回 200，不存在回 404「婚禮不存在」
- `DELETE /api/v1/weddings/{id}` 軟刪；已刪除回 409「婚禮已被刪除」；不存在回 404「婚禮不存在」
- `POST /api/v1/weddings/{id}/restore`；未刪除回 409「婚禮未被刪除」；不存在回 404「婚禮不存在」
