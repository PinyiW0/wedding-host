# Flow: 認證（管理員註冊）

> 對應規格：spec/gherkin-feature/RegisterAdmin.feature
> 涵蓋頁面：/register（管理員自助註冊）

## Background
- Anonymous 使用者（尚未登入）開啟註冊頁
- 系統可能已有既存管理員帳號（用於 email 重複驗證）

---

## Business Invariants（合約核心）

1. 全新使用者能透過註冊頁建立管理員帳號（填 email 與顯示名稱）
2. 註冊成功後使用者能感知成功（導向後台 / 成功反饋）
3. email 已被其他管理員使用時，使用者能感知失敗原因（「此電子郵件已被註冊」）

---

## Flow: 成功註冊管理員（happy-path）

> 對應 Feature: 註冊管理員 → Scenario: 成功註冊管理員

### 業務脈絡
- 系統無既有資料（no prior events）
- email `admin@example.com` 尚未被任何管理員使用

### E2E 驗證流程
1. 進入 `/register`
2. 填寫註冊表單：
   - 電子郵件 → admin@example.com
   - 顯示名稱 → 王小明
3. 提交註冊

### Verification 策略
- API spy：`POST /api/v1/admins`（或對應註冊端點）被呼叫，payload 含 `email`、`displayName`
- UI：出現成功反饋（role=alert / role=status / 「註冊成功」文字），或導向已登入後台

### 不再凍結（UX 自由區）
- 觸發提交的按鈕文字（「註冊」/「建立帳號」/「送出」皆可）
- 表單呈現（單頁 / 分步 / modal）
- 成功後是否自動登入或停留在成功頁

---

## Flow: Email 已被註冊（integrity-constraint）

> 對應 Feature: 註冊管理員 → Scenario: Email 已被註冊

### 業務脈絡
- 已有管理員使用 `admin@example.com`（AdminRegistered 已發生）
- 使用者用相同 email 嘗試註冊

### E2E 驗證流程
1. 進入 `/register`
2. 填寫表單：
   - 電子郵件 → admin@example.com（已被使用）
   - 顯示名稱 → 李小華
3. 提交註冊

### Verification 策略
- 使用者能看到錯誤訊息：含「此電子郵件已被註冊」語意（role=alert / inline error / toast）
- API spy：端點回 4xx，註冊未成立（未導向後台）

### 不再凍結
- 錯誤呈現形式（inline `*-register-error` / toast / banner）
- 是否即時（blur 驗證）或提交後才提示

---

## Selector 策略（v2 通則）

1. role + name regex：`getByRole('button', { name: /註冊|建立帳號|送出/ })`
2. 表單欄位用 `getByLabel(/電子郵件|email/i)`、`getByLabel(/顯示名稱|名稱/)`
3. 反饋用 `getByRole('alert')` 或 `getByText(/此電子郵件已被註冊/)`
4. testid：fallback only（如 inline error 需 `admin-register-error`）

---

## Mock 假設
- 成功情境：mock 無既有 admin，`POST` 註冊回 201 + AdminRegistered
- 失敗情境：mock seed 已有 `admin@example.com` 的 admin，`POST` 回 409 + 「此電子郵件已被註冊」
