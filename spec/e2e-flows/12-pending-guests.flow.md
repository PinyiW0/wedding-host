# Flow: 賓客名單混合制 + 待確認區

> 對應規格：spec/gherkin-feature/SubmitPublicRsvp.feature, ResolvePendingGuest.feature
> 涵蓋頁面：公開自助 RSVP /rsvp/public/[weddingId]（賓客端，無 auth）、後台賓客名單 /weddings/[weddingId]/guests（待確認區）

## Background
- 賓客（Guest）透過公開連結自助回覆，不需登入，也不需專屬 guestId
- 公開回覆建立 status='pending_review' 的待確認賓客，**不直接進正式名單**
- 管理員（Admin）在待確認區人工處理：併入既有賓客 / 建為新賓客 / 略過
- 系統只給「姓名提示候選」（手機相同＝高、姓名+同側＝中、姓名相近＝低），**永不自動合併**

---

## Business Invariants（合約核心）

1. 賓客能透過公開連結自助提交 RSVP，無需登入或專屬連結
2. 公開回覆建立的賓客為「待確認」狀態，不混入正式名單（不影響統計 / 座位 / 報到）
3. 管理員能在待確認區看到每筆回覆與系統提供的姓名提示候選
4. 管理員能將待確認賓客「併入既有賓客」「建為新賓客」或「略過」
5. 系統永不自動合併，合併與否一律人工決定
6. 婚禮 / 待確認賓客不存在時操作失敗，使用者能感知原因

---

## Flow: 公開自助回覆（happy-path，賓客端）

> 對應 Feature: 公開自助 RSVP → Scenario: 公開自助回覆

### 業務脈絡
- wedding-001 已建立

### E2E 驗證流程
1. 進入公開頁 `/rsvp/public/wedding-001`
2. 填寫姓名、手機、出席等
3. 提交

### Verification 策略
- API spy：`POST .../weddings/wedding-001/guests/rsvp-public`，回應 status='pending_review'
- UI：提交成功反饋（「回覆已送出」）

### 不再凍結
- 公開頁視覺、欄位提示、是否要求手機

---

## Flow: 公開回覆到不存在的婚禮（not-found）

> 對應 Feature: 公開自助 RSVP → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../weddings/wedding-999/guests/rsvp-public` 帶 payload
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 待確認區併入既有賓客（happy-path）

> 對應 Feature: 處理待確認賓客 → Scenario: 併入既有賓客

### 業務脈絡
- guest-001（陳大明）為正式賓客
- 一筆待確認回覆存在（姓名 / 手機可能與 guest-001 相符）

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/guests`，切換到「待確認」
2. 在待確認回覆的候選中選擇 guest-001，按「併入」
3. 待確認區該筆消失、正式名單 guest-001 套用回覆

### Verification 策略
- API spy：`POST .../pending-guests/{guestId}/merge`，payload 含 targetGuestId
- UI：待確認筆數減少；正式名單該賓客出席狀態更新

### 不再凍結
- 待確認區呈現（卡片 / 列表）、候選顯示形式、動作按鈕位置

---

## Flow: 待確認區建為新賓客 / 略過（happy-path）

> 對應 Feature: 處理待確認賓客 → Scenario: 建為新賓客 / 略過

### 驗證流程
- 建新：`POST .../pending-guests/{guestId}/confirm` → 該賓客 status 轉 confirmed、進入正式名單
- 略過：`POST .../pending-guests/{guestId}/reject` → 該待確認筆移除

---

## Flow: 處理不存在的待確認賓客（not-found）

> 對應 Feature: 處理待確認賓客 → Scenario: 待確認賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../pending-guests/guest-999/confirm`
- 期待：4xx，訊息含「待確認賓客不存在」

---

## Selector 策略（v2 通則）
1. 公開頁提交鈕：`getByRole('button', { name: /送出|提交/ })`
2. 待確認分頁：`getByRole('button', { name: /待確認/ })`
3. 候選與動作：`getByRole('button', { name: /併入|建為新賓客|略過/ })`
4. async outcome：`page.waitForRequest`（rsvp-public / merge / confirm / reject）
5. testid：fallback only（建議 `vibe-pending-*`）

---

## Mock 假設
- seed：wedding-001、guest-001（陳大明 / 手機 0912345678）
- `POST .../guests/rsvp-public` 回 201 PublicRsvpSubmittedEvent（status pending_review）；婚禮不存在回 404
- `GET .../pending-guests` 回 status='pending_review' 且未略過者（GuestListItem[]）
- 正式名單 `GET .../guests` 已排除 pending_review，待確認賓客不影響既有統計 / 座位 / 報到
- merge / confirm / reject：待確認賓客不存在回 404「待確認賓客不存在」；merge 目標不存在回 404「賓客不存在」
