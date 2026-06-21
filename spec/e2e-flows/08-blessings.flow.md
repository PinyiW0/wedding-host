# Flow: 祝福留言審核

> 對應規格：spec/gherkin-feature/SubmitBlessing.feature, ApproveBlessing.feature, RejectBlessing.feature
> 涵蓋頁面：/weddings/[weddingId]/blessings（管理員端：審核通過 / 拒絕）、賓客 LIFF /blessing/[weddingId]（賓客端：提交祝福）

## Background
- 賓客（Guest）透過 LIFF 提交祝福留言或照片
- 管理員（Admin）審核（通過 / 拒絕）
- 祝福狀態：已提交（待審） / 已通過 / 已拒絕

---

## Business Invariants（合約核心）

1. 賓客能透過 LIFF 提交祝福留言與照片
2. 管理員能審核通過已提交的祝福
3. 管理員能審核拒絕已提交的祝福並記錄原因
4. 祝福的識別 / 內容（message）與審核狀態可被管理員讀到
5. 對不存在 / 已審核的祝福操作，使用者能感知失敗原因

---

## Flow: 成功提交祝福（happy-path，賓客端）

> 對應 Feature: 提交祝福 → Scenario: 成功提交祝福

### 業務脈絡
- 系統無既有祝福，賓客（guest-001）透過 LIFF 提交

### E2E 驗證流程
1. 進入賓客祝福頁（如 `/blessing/wedding-001`，含 guestId 情境）
2. 填寫祝福：
   - 留言 → 祝福新人百年好合！
   - 照片 → 上傳 / 帶入 photoUrl
3. 提交

### Verification 策略
- API spy：`POST /api/v1/weddings/wedding-001/blessings`，payload 含 guestId / message / photoUrl
- UI：使用者能感知提交成功（「祝福已送出」/「感謝您的祝福」反饋）

### 不再凍結
- 照片上傳元件、成功頁呈現

---

## Flow: 成功審核通過祝福（happy-path）

> 對應 Feature: 審核通過祝福 → Scenario: 成功審核通過祝福

### 業務脈絡
- blessing-001 已提交（祝福新人百年好合！），待審核

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/blessings`
2. 找到 blessing-001（內容「祝福新人百年好合！」），觸發「通過」
3. 期待：
   - API spy：`POST .../blessings/blessing-001/approve`
   - UI：blessing-001 顯示為「已通過」

### Verification 策略
- API spy（approve 端點）
- UI：審核狀態翻轉為「已通過」（`getByText(/已通過/)` 於該祝福範圍）

### 不再凍結
- 待審 / 已通過分區呈現、通過觸發形式

---

## Flow: 審核不存在的祝福（not-found）

> 對應 Feature: 審核通過祝福 → Scenario: 祝福不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../blessings/blessing-999/approve`
- 期待：4xx，訊息含「祝福不存在」

---

## Flow: 重複審核通過（condition / already-reviewed）

> 對應 Feature: 審核通過祝福 → Scenario: 祝福已審核通過

### 性質
API 邊界保護。

### 驗證流程
- blessing-001 已通過狀態下，再 `POST .../blessings/blessing-001/approve`
- 期待：4xx，訊息含「祝福已審核」

---

## Flow: 成功審核拒絕祝福（happy-path）

> 對應 Feature: 審核拒絕祝福 → Scenario: 成功審核拒絕祝福

### 業務脈絡
- blessing-001 已提交（不當內容），待審核

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/blessings`
2. 找到 blessing-001，觸發「拒絕」
3. 填寫拒絕原因 → 內容不適當
4. 提交

### Verification 策略
- API spy：`POST .../blessings/blessing-001/reject`，payload 含 reason
- UI：blessing-001 顯示為「已拒絕」（`getByText(/已拒絕/)`）

### 不再凍結
- 原因輸入形式（必填 textarea / 選單）、拒絕觸發形式

---

## Flow: 拒絕不存在的祝福（not-found）

> 對應 Feature: 審核拒絕祝福 → Scenario: 祝福不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../blessings/blessing-999/reject` 帶 reason
- 期待：4xx，訊息含「祝福不存在」

---

## Flow: 重複審核拒絕（condition / already-reviewed）

> 對應 Feature: 審核拒絕祝福 → Scenario: 祝福已被拒絕

### 性質
API 邊界保護。

### 驗證流程
- blessing-001 已拒絕狀態下，再 `POST .../blessings/blessing-001/reject` 帶 reason
- 期待：4xx，訊息含「祝福已審核」

---

## Selector 策略（v2 通則）

1. role + name regex 找祝福實體：`getByText(/祝福新人百年好合/)` 或 `getByRole('article', { name: /祝福/ })`
2. 動作按鈕：`getByRole('button', { name: /通過|核可|拒絕|提交|送出/ })`
3. 審核狀態文字：`getByText(/待審|已通過|已拒絕/)`
4. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/祝福不存在|祝福已審核/)`
5. async outcome：`page.waitForRequest`（approve / reject 端點）
6. testid：fallback only（如祝福內容相同需消歧時 `blessing-row-blessing-001`）

---

## Mock 假設
- seed：wedding-001、blessing-001（祝福新人百年好合！/ 已提交待審）
- `POST .../blessings` 回 201
- `POST .../blessings/{id}/approve`：不存在回 404「祝福不存在」；已審核回 409「祝福已審核」
- `POST .../blessings/{id}/reject`：不存在回 404「祝福不存在」；已審核回 409「祝福已審核」
