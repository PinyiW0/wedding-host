# Flow: RSVP 出席管理

> 對應規格：spec/gherkin-feature/SendRsvpInvitation.feature, SubmitRsvp.feature, OverrideRsvp.feature
> 涵蓋頁面：/weddings/[weddingId]/rsvp（管理員端：發送邀請 + 覆寫回覆）、賓客 LIFF /rsvp/[guestId]（賓客端：提交出席回覆）

## Background
- 管理員（Admin）發送邀請、覆寫回覆
- 賓客（Guest）透過 LIFF 提交出席回覆
- RSVP 狀態：未提交 / 已提交（attending / declined / absent）

---

## Business Invariants（合約核心）

1. 管理員能透過指定管道（如 LINE）發送 RSVP 邀請連結給賓客
2. 賓客能透過 LIFF 提交出席回覆（出席狀態、飲食、加一人數、是否需兒童座椅）
3. 管理員能手動覆寫賓客的出席狀態並記錄原因
4. 各種不存在 / 已提交的操作，使用者能感知失敗原因

---

## Flow: 透過 LINE 發送 RSVP 邀請（happy-path）

> 對應 Feature: 發送 RSVP 邀請 → Scenario: 透過 LINE 發送 RSVP 邀請

### 業務脈絡
- guest-001（陳大明）已新增

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/rsvp`（或賓客列表的 RSVP 動作）
2. 在 guest-001 範圍內觸發「發送 RSVP 邀請」，選擇管道 → LINE
3. 提交

### Verification 策略
- API spy：`POST /api/v1/weddings/wedding-001/guests/guest-001/rsvp-invitation`，payload 含 channel=line
- UI：使用者能感知已發送（「邀請已發送」反饋 / 賓客狀態標示已邀請）

### 不再凍結
- 管道選擇形式（下拉 / 按鈕）、批次或單發

---

## Flow: 發送 RSVP 邀請給不存在的賓客（not-found）

> 對應 Feature: 發送 RSVP 邀請 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-999/rsvp-invitation` 帶 channel
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 賓客提交出席（happy-path，賓客端）

> 對應 Feature: 提交 RSVP → Scenario: 提交出席

### 業務脈絡
- guest-001 已新增、尚未提交 RSVP
- 賓客透過 LIFF 連結進入回覆頁

### E2E 驗證流程
1. 進入賓客 RSVP 頁（如 `/rsvp/guest-001`，含 weddingId 情境）
2. 填寫回覆：
   - 出席狀態 → 出席（attending）
   - 飲食 → 葷食（meat）
   - 加一人數 → 1
   - 是否需兒童座椅 → 否
3. 提交

### Verification 策略
- API spy：`POST .../guests/guest-001/rsvp`，payload 含 attending / diet / plusOneCount / needChildSeat
- UI：使用者能感知提交成功（「回覆已送出」/「感謝您的回覆」反饋）

### 不再凍結
- 出席狀態元件（radio / segment）、加一人數元件（stepper / select）
- 成功頁呈現

---

## Flow: 提交 RSVP 時賓客不存在（not-found，賓客端）

> 對應 Feature: 提交 RSVP → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-001/rsvp`（無此賓客）帶 payload
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 重複提交 RSVP（condition / already-submitted，賓客端）

> 對應 Feature: 提交 RSVP → Scenario: 已提交過 RSVP

### 性質
API 邊界保護（UI 正常會顯示已回覆狀態，不再開放重複提交）。

### 驗證流程
- guest-001 已提交 RSVP 狀態下，再 `POST .../guests/guest-001/rsvp`
- 期待：4xx，訊息含「已提交過 RSVP」

---

## Flow: 成功覆寫 RSVP（happy-path）

> 對應 Feature: 覆寫 RSVP → Scenario: 成功覆寫 RSVP

### 業務脈絡
- guest-001 已提交 RSVP（出席）

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/rsvp`（或賓客詳情）
2. 在 guest-001 範圍內觸發「覆寫 RSVP」
3. 設定：
   - 出席狀態 → 缺席（absent）
   - 原因 → 賓客臨時通知無法出席
4. 提交

### Verification 策略
- API spy：`POST/PATCH .../guests/guest-001/rsvp-override`，payload 含 attending=absent / reason
- UI：覆寫後賓客出席狀態顯示為「缺席」（`getByText(/缺席/)` 於 guest-001 範圍）

### 不再凍結
- 覆寫入口位置、出席狀態與原因輸入形式

---

## Flow: 覆寫 RSVP 時賓客不存在（not-found）

> 對應 Feature: 覆寫 RSVP → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-001/rsvp-override`（無此賓客）帶 reason / attending
- 期待：4xx，訊息含「賓客不存在」

---

## Selector 策略（v2 通則）

1. role + name regex 找賓客實體：`getByRole('row', { name: /陳大明/ })`
2. 動作按鈕：`getByRole('button', { name: /發送.*邀請|提交|送出|覆寫/ })`
3. 出席狀態文字：`getByText(/出席|缺席|不出席/)`
4. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/賓客不存在|已提交過 RSVP/)`
5. async outcome：`page.waitForRequest`（invitation / rsvp / override 端點）
6. testid：fallback only

---

## Mock 假設
- seed：wedding-001、guest-001（陳大明 / 未提交 RSVP）
- `POST .../rsvp-invitation` 回 200；不存在回 404「賓客不存在」
- `POST .../rsvp` 回 201；不存在回 404；已提交回 409「已提交過 RSVP」
- `POST .../rsvp-override` 回 200；不存在回 404「賓客不存在」
- attending 值域：attending / declined / absent
