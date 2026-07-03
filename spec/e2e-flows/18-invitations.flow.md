# Flow: RSVP 喜帖管理

> 對應規格：spec/gherkin-feature/MarkInvitationSent.feature
> 涵蓋頁面：後台 RSVP 出席管理 /weddings/[weddingId]/rsvp（管理者/新人）

## Background
- 賓客於 RSVP 表單回覆喜帖需求（invitationPreference：e-card 電子 / physical 紙本 / none 不需要 / null 未填）
- 管理員在 RSVP 頁檢視喜帖需求統計（以賓客筆數計）、依需求篩選回覆清單，並逐位標記「喜帖已寄送」
- 寄送記號為冪等設值（sent: true/false），落庫後重整仍保留

---

## Business Invariants（合約核心）

1. 頁面可讀喜帖需求統計（電子/紙本，以賓客筆數計），且與賓客資料一致
2. 可依喜帖需求篩選回覆清單（篩選後僅該需求的賓客可見）
3. 每位賓客可標記「喜帖已寄送」，重整後仍保留
4. 對不存在賓客標記失敗可感知（「賓客不存在」）

---

## Flow: 喜帖需求統計（讀模型合約）

### 業務脈絡
- wedding-001 已建立，管理員已登入；統計自賓客名單推導，前端計算不落庫

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/rsvp`
2. 斷言「電子喜帖」「紙本喜帖」「已寄送」三個統計數字與賓客資料一致（僅計未移除者、以賓客筆數計）

### Verification 策略
- 以 `GET .../guests` 回應推算預期值（不寫死 seed 數字，凍結「一致」而非數值）

---

## Flow: 依喜帖需求篩選

### E2E 驗證流程
1. 進入頁面，依「電子喜帖」篩選回覆清單
2. e-card 賓客（seed guest-003）的列可見；非 e-card 賓客的列不可見

### Verification 策略
- 反向斷言對象由 `GET .../guests` 找一位非 e-card 賓客，不寫死 seed

---

## Flow: 標記喜帖已寄送（happy-path + 持久化）

> 對應 Feature: 標記喜帖已寄送 → Scenario: 成功標記喜帖已寄送

### E2E 驗證流程
1. 對 seed 賓客 guest-003 勾選「喜帖已寄送」
2. 重整頁面，記號仍保留（勾選狀態不變）

### Verification 策略
- API spy：`PUT .../guests/guest-003/invitation-sent`，payload `{ sent: true }`
- 持久化：`page.reload()` 後勾選狀態由 GET 讀模型帶回

---

## Flow: 標記不存在的賓客（not-found）

> 對應 Feature: 標記喜帖已寄送 → Scenario: 賓客不存在

### E2E 驗證流程
1. 直接對 `guest-999` 發 `PUT .../invitation-sent` → 404「賓客不存在」

### Verification 策略
- 404 以 `page.request` 直打驗證

### 不再凍結
- 統計卡呈現形式、篩選控件形式（下拉/膠囊）、勾選控件形式與位置、欄位排版、loading 視覺

---

## Mock 假設
- seed：guest-003（王志強）invitationPreference = e-card；全部 seed invitationSent = false
- 端點：PUT `.../guests/{guestId}/invitation-sent`（body `{ sent: boolean }`，冪等設值）；賓客不存在 → 404「賓客不存在」
- 統計與篩選皆自 `GET .../guests` 讀模型計算（僅計 !deletedAt 筆數）
