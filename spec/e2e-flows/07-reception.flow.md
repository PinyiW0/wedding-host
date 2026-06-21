# Flow: 接待端（報到 / 禮金 / 喜餅發放）

> 對應規格：spec/gherkin-feature/CheckInByReception.feature, SelfCheckIn.feature, RecordGiftMoney.feature, UpdateGiftMoney.feature, DistributeCakeBox.feature
> 涵蓋頁面：/reception（接待人員端：賓客報到 + 禮金登記 / 更正 + 喜餅發放）、賓客自助報到頁 /checkin（賓客掃 QRCode 端）

## Background
- 接待人員（Receptionist）於接待端操作報到、禮金、喜餅發放
- 賓客（Guest）透過共用 QRCode 進入自助報到頁
- 賓客報到狀態：未報到 / 已報到；禮金：未登記 / 已登記；喜餅：未發放 / 已發放

---

## Business Invariants（合約核心）

1. 接待人員能在接待端為賓客完成報到
2. 賓客能掃共用 QRCode、輸入姓名完成自助報到
3. 接待人員能登記賓客禮金金額，並能更正既有禮金
4. 接待人員能登記賓客喜餅已發放
5. 賓客的報到 / 禮金 / 喜餅狀態可被接待人員讀到
6. 各種不存在 / 重複 / 狀態不符的操作，使用者能感知失敗原因

---

## Flow: 成功接待報到（happy-path）

> 對應 Feature: 接待報到 → Scenario: 成功接待報到

### 業務脈絡
- guest-001（陳大明）已新增、尚未報到

### E2E 驗證流程
1. 進入 `/reception`（接待端賓客名單）
2. 找到 guest-001（陳大明），觸發「報到」
3. 期待：
   - API spy：`POST /api/v1/weddings/wedding-001/guests/guest-001/check-in`（接待報到端點）
   - UI：guest-001 顯示為「已報到」（`getByText(/已報到/)` 於該賓客範圍）

### Verification 策略
- API spy（check-in 端點）
- UI：報到狀態文字翻轉為「已報到」

### 不再凍結
- 報到觸發形式（按鈕 / 列表 action / 搜尋後確認）
- 已報到呈現（badge / 狀態欄）

---

## Flow: 接待報到時賓客不存在（not-found）

> 對應 Feature: 接待報到 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-001/check-in`（無此賓客）
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 接待報到時賓客已報到（condition / already-checked-in）

> 對應 Feature: 接待報到 → Scenario: 已報到

### 性質
API 邊界保護（UI 正常會顯示已報到、不再開放重複）。

### 驗證流程
- guest-001 已報到狀態下，再 `POST .../guests/guest-001/check-in`
- 期待：4xx，訊息含「賓客已報到」

---

## Flow: 成功自助報到（happy-path，賓客端）

> 對應 Feature: 自助報到 → Scenario: 成功自助報到

### 業務脈絡
- guest-001（陳大明）已新增、尚未報到
- 賓客掃共用 QRCode 進入自助報到頁

### E2E 驗證流程
1. 進入自助報到頁（如 `/checkin`，含 weddingId 情境）
2. 輸入姓名 → 陳大明（或選取對應賓客）
3. 提交報到

### Verification 策略
- API spy：`POST .../guests/guest-001/self-check-in`
- UI：使用者能感知報到成功（「報到成功」/「歡迎陳大明」反饋）

### 不再凍結
- 姓名輸入後的比對方式（輸入框 / 名單選取）
- 成功頁呈現

---

## Flow: 自助報到時賓客不存在（not-found，賓客端）

> 對應 Feature: 自助報到 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-001/self-check-in`（無此賓客）
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 自助報到時賓客已報到（condition / already-checked-in，賓客端）

> 對應 Feature: 自助報到 → Scenario: 已報到

### 性質
API 邊界保護。

### 驗證流程
- guest-001 已報到狀態下，再 `POST .../guests/guest-001/self-check-in`
- 期待：4xx，訊息含「賓客已報到」

---

## Flow: 成功登記禮金（happy-path）

> 對應 Feature: 登記禮金 → Scenario: 成功登記禮金

### 業務脈絡
- guest-001（陳大明）已新增、尚未登記禮金

### E2E 驗證流程
1. 進入 `/reception`
2. 在 guest-001 範圍內觸發「登記禮金」
3. 輸入金額 → 3600
4. 提交

### Verification 策略
- API spy：`POST .../guests/guest-001/gift-money`，payload 含 amount=3600
- UI：登記後能讀到禮金金額 3600（`getByText(/3600|3,600/)` 於 guest-001 範圍）

### 不再凍結
- 金額輸入元件、登記入口形式

---

## Flow: 登記禮金時賓客不存在（not-found）

> 對應 Feature: 登記禮金 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-001/gift-money`（無此賓客）帶 amount
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 成功更正禮金（happy-path）

> 對應 Feature: 更正禮金 → Scenario: 成功更正禮金

### 業務脈絡
- guest-001 已登記禮金 3600

### E2E 驗證流程
1. 進入 `/reception`
2. 在 guest-001 範圍內觸發「更正禮金」
3. 修改金額 → 6000
4. 提交

### Verification 策略
- API spy：`PATCH/PUT .../guests/guest-001/gift-money`，payload 含 amount=6000
- UI：更正後能讀到新金額 6000（`getByText(/6000|6,000/)`）

### 不再凍結
- 更正入口位置

---

## Flow: 更正禮金時賓客不存在（not-found）

> 對應 Feature: 更正禮金 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `PATCH .../guests/guest-001/gift-money`（無此賓客）帶 amount
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 尚未登記禮金時更正（condition / no-gift-recorded）

> 對應 Feature: 更正禮金 → Scenario: 尚未登記禮金

### 性質
API 邊界保護（UI 正常對未登記者只顯示「登記」而非「更正」）。

### 驗證流程
- guest-001 尚未登記禮金狀態下，`PATCH .../guests/guest-001/gift-money`
- 期待：4xx，訊息含「尚未登記禮金」

---

## Flow: 成功發放喜餅（happy-path）

> 對應 Feature: 發放喜餅 → Scenario: 成功發放喜餅

### 業務脈絡
- guest-001（陳大明）已新增、尚未領取喜餅

### E2E 驗證流程
1. 進入 `/reception`
2. 在 guest-001 範圍內觸發「發放喜餅」（選擇款式 cake-type-001）
3. 期待：
   - API spy：`POST .../guests/guest-001/cake-box-distribution`，payload 含 cakeBoxTypeId
   - UI：guest-001 顯示為「已發放喜餅」

### Verification 策略
- API spy（發放端點）
- UI：喜餅狀態翻轉為「已發放」（`getByText(/已發放/)` 於該賓客範圍）

### 不再凍結
- 款式選擇形式、發放觸發形式

---

## Flow: 發放喜餅時賓客不存在（not-found）

> 對應 Feature: 發放喜餅 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-001/cake-box-distribution`（無此賓客）帶 cakeBoxTypeId
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 重複發放喜餅（condition / already-distributed）

> 對應 Feature: 發放喜餅 → Scenario: 已發放喜餅

### 性質
API 邊界保護。

### 驗證流程
- guest-001 已發放喜餅狀態下，再 `POST .../guests/guest-001/cake-box-distribution`
- 期待：4xx，訊息含「喜餅已發放」

---

## Selector 策略（v2 通則）

1. role + name regex 找賓客實體：`getByRole('row', { name: /陳大明/ })`、`getByText(/陳大明/)`
2. 動作按鈕：`getByRole('button', { name: /報到|登記禮金|更正|發放喜餅/ })`
3. 狀態文字：`getByText(/已報到|已發放/)`、金額 `getByText(/3600|6000/)`
4. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/賓客不存在|賓客已報到|尚未登記禮金|喜餅已發放/)`
5. async outcome：`page.waitForRequest`（check-in / gift-money / cake-box-distribution 端點）
6. testid：fallback only

---

## Mock 假設
- seed：wedding-001、guest-001（陳大明 / 未報到 / 未登記禮金 / 未發放喜餅）、cake-type-001
- check-in / self-check-in：不存在回 404「賓客不存在」；已報到回 409「賓客已報到」
- gift-money POST：不存在回 404；PATCH：不存在回 404、未登記回 409「尚未登記禮金」
- cake-box-distribution：不存在回 404；已發放回 409「喜餅已發放」
