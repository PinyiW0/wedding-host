# Flow: 喜餅款式管理

> 對應規格：spec/gherkin-feature/AddCakeBoxType.feature, UpdateCakeBoxType.feature, RemoveCakeBoxType.feature, ConfigureCakeBoxAssignment.feature
> 涵蓋頁面：/weddings/[weddingId]/cake-box（喜餅款式 CRUD + 指派規則設定）
>
> 註：喜餅「發放」（DistributeCakeBox）為接待端動作，歸於 07-reception.flow.md。

## Background
- 已登入為管理員（Admin）
- 已選定一場婚禮（wedding-001）

---

## Business Invariants（合約核心）

1. 管理員能新增喜餅款式（名稱、說明、是否預設）
2. 管理員能更新既有款式的名稱與說明
3. 管理員能移除既有款式
4. 管理員能為賓客 / 身分設定喜餅指派規則
5. 款式的識別欄位（name）可被使用者讀到
6. 對不存在款式的操作，使用者能感知失敗（「喜餅款式不存在」）

---

## Flow: 成功新增喜餅款式（happy-path）

> 對應 Feature: 新增喜餅款式 → Scenario: 成功新增喜餅款式

### 業務脈絡
- 系統無既有款式

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/cake-box`
2. 觸發「新增喜餅款式」
3. 填寫：
   - 名稱 → 經典禮盒
   - 說明 → 傳統經典喜餅禮盒
   - 設為預設 → 是（isDefault）
4. 提交

### Verification 策略
- API spy：`POST /api/v1/weddings/wedding-001/cake-box-types`，payload 含 name / description / isDefault
- UI：列表新增可識別的「經典禮盒」實體（`getByText(/經典禮盒/)`）

### 不再凍結
- 是否預設的元件（checkbox / switch / radio）、表單呈現

---

## Flow: 成功更新喜餅款式（happy-path）

> 對應 Feature: 更新喜餅款式 → Scenario: 成功更新喜餅款式

### 業務脈絡
- cakeboxtype-001（經典禮盒）已存在

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/cake-box`
2. 在 cakeboxtype-001（經典禮盒）範圍內觸發「編輯」
3. 修改：
   - 名稱 → 豪華禮盒
   - 說明 → 升級版豪華喜餅禮盒
4. 提交

### Verification 策略
- API spy：`PATCH/PUT .../cake-box-types/cakeboxtype-001`，payload 含 name / description
- UI：能讀到新名稱「豪華禮盒」

### 不再凍結
- 編輯入口位置

---

## Flow: 更新不存在的喜餅款式（not-found）

> 對應 Feature: 更新喜餅款式 → Scenario: 喜餅款式不存在

### 性質
API 邊界保護。

### 驗證流程
- `PATCH .../cake-box-types/cakeboxtype-999` 帶 payload
- 期待：4xx，訊息含「喜餅款式不存在」

---

## Flow: 成功移除喜餅款式（happy-path）

> 對應 Feature: 移除喜餅款式 → Scenario: 成功移除喜餅款式

### 業務脈絡
- cakeboxtype-001（經典禮盒）已存在

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/cake-box`
2. 在 cakeboxtype-001 範圍內觸發「移除」
3. 若有 confirm dialog，完成確認
4. 期待：
   - API spy：`DELETE .../cake-box-types/cakeboxtype-001`
   - 「經典禮盒」不再可見

### Verification 策略（destructive）
- 主要靠 API spy（DELETE）
- UI：移除後「經典禮盒」不可見

### 不再凍結
- confirm 形式、觸發位置

---

## Flow: 移除不存在的喜餅款式（not-found）

> 對應 Feature: 移除喜餅款式 → Scenario: 喜餅款式不存在

### 性質
API 邊界保護。

### 驗證流程
- `DELETE .../cake-box-types/cakeboxtype-999`
- 期待：4xx，訊息含「喜餅款式不存在」

---

## Flow: 成功設定喜餅指派（happy-path）

> 對應 Feature: 設定喜餅指派 → Scenario: 成功設定喜餅指派

### 業務脈絡
- cakeboxtype-001（經典禮盒）已存在

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/cake-box` 的指派規則入口
2. 觸發「設定指派規則」
3. 填寫 / 選擇：
   - 對象賓客 → guest-001
   - 指派規則 → 家人→大餅＋豪華禮盒
4. 提交

### Verification 策略
- API spy：`POST/PUT .../cake-box-types/cakeboxtype-001/assignment`，payload 含 guestId / assignmentRule
- UI：使用者能感知指派已設定（規則出現於列表 / 成功反饋）

### 不再凍結
- 規則輸入形式（自由文字 / 結構化選擇）

---

## Flow: 設定指派時喜餅款式不存在（not-found）

> 對應 Feature: 設定喜餅指派 → Scenario: 喜餅款式不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../cake-box-types/cakeboxtype-999/assignment` 帶 guestId / assignmentRule
- 期待：4xx，訊息含「喜餅款式不存在」

---

## Selector 策略（v2 通則）

1. role + name regex 找款式實體：`getByRole('row', { name: /經典禮盒/ })`
2. 動作按鈕：`getByRole('button', { name: /新增|編輯|移除|設定.*指派/ })`
3. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/喜餅款式不存在/)`
4. destructive / async outcome：`page.waitForRequest`
5. testid：fallback only

---

## Mock 假設
- seed：wedding-001、cakeboxtype-001（經典禮盒 / isDefault true）
- `POST .../cake-box-types` 回 201
- `PATCH/DELETE .../cake-box-types/{id}` 不存在回 404「喜餅款式不存在」
- `POST .../cake-box-types/{id}/assignment` 不存在回 404「喜餅款式不存在」
