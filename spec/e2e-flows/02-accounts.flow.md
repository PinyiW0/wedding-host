# Flow: 接待帳號管理

> 對應規格：spec/gherkin-feature/CreateReceptionAccount.feature, RemoveReceptionAccount.feature
> 涵蓋頁面：/weddings/[weddingId]/accounts（接待帳號列表 + 建立 + 移除）

## Background
- 已登入為管理員（Admin）
- 已選定一場婚禮（wedding-001），接待帳號隸屬於該婚禮

---

## Business Invariants（合約核心）

1. 管理員能為婚禮建立接待人員共用帳號（輸入帳號名稱 username）
2. 管理員能移除既有接待帳號
3. 接待帳號的識別資訊（username）可被使用者讀到
4. 同一婚禮下帳號名稱重複時，使用者能感知失敗（「帳號名稱已存在」）
5. 移除不存在的帳號時，使用者能感知失敗（「接待帳號不存在」）

---

## Flow: 成功建立接待帳號（happy-path）

> 對應 Feature: 建立接待帳號 → Scenario: 成功建立接待帳號

### 業務脈絡
- wedding-001 下尚無 `reception-desk-1` 帳號

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/accounts`
2. 觸發「建立接待帳號」
3. 填寫表單：
   - 帳號名稱 → reception-desk-1
4. 提交

### Verification 策略
- API spy：`POST /api/v1/weddings/wedding-001/reception-accounts`，payload 含 `username`
- UI：列表新增可識別的「reception-desk-1」實體（`getByText(/reception-desk-1/)`）

### 不再凍結
- 觸發按鈕形式與位置
- 表單呈現（modal / inline）
- 是否同時設定密碼（規格僅給 username，密碼欄位由 UI 自行決定，不納入合約）

---

## Flow: 帳號名稱已存在（integrity-constraint）

> 對應 Feature: 建立接待帳號 → Scenario: 帳號名稱已存在

### 業務脈絡
- wedding-001 下已有 `reception-desk-1` 帳號

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/accounts`
2. 觸發「建立接待帳號」
3. 填入相同帳號名稱 → reception-desk-1
4. 提交

### Verification 策略
- 使用者能看到錯誤訊息：含「帳號名稱已存在」（role=alert / inline error / toast）
- API spy：端點回 4xx，帳號未新增

### 不再凍結
- 錯誤呈現形式

---

## Flow: 成功移除接待帳號（happy-path）

> 對應 Feature: 移除接待帳號 → Scenario: 成功移除接待帳號

### 業務脈絡
- wedding-001 下已有 account-001（reception-desk-1）

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/accounts`
2. 在 account-001（reception-desk-1）實體範圍內觸發「移除」
3. 若有 confirm dialog，完成確認
4. 期待：
   - API spy：`DELETE /api/v1/weddings/wedding-001/reception-accounts/account-001`
   - account-001 不再可見於清單

### Verification 策略（destructive）
- 主要靠 API spy（DELETE）
- UI：執行後「reception-desk-1」實體不可見

### 不再凍結
- confirm 形式
- 觸發按鈕位置（cell / kebab menu）

---

## Flow: 移除不存在的接待帳號（not-found）

> 對應 Feature: 移除接待帳號 → Scenario: 帳號不存在

### 性質
API 邊界保護（UI 正常只對既有帳號顯示移除動作）。

### 驗證流程
- `DELETE /api/v1/weddings/wedding-001/reception-accounts/account-999`（無此帳號）
- 期待：4xx，訊息含「接待帳號不存在」

---

## Selector 策略（v2 通則）

1. role + name regex 找帳號實體：`getByRole('row', { name: /reception-desk-1/ })`
2. 動作按鈕：`getByRole('button', { name: /建立|新增|移除|刪除/ })`
3. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/帳號名稱已存在|接待帳號不存在/)`
4. 移除 outcome：`page.waitForRequest`（DELETE）
5. testid：fallback only

---

## Mock 假設
- seed：account-001（reception-desk-1 / wedding-001）
- `POST .../reception-accounts` 回 201；同名回 409「帳號名稱已存在」
- `DELETE .../reception-accounts/{id}` 回 200/204；不存在回 404「接待帳號不存在」
