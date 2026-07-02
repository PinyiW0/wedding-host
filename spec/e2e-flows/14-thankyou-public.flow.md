# Flow: 賓客公開謝卡 + 複製連結

> 對應規格：spec/gherkin-feature/ViewThankYouCard.feature
> 涵蓋頁面：賓客公開謝卡 /thankyou/[weddingId]/[guestId]（公開，RWD，信封開封）；後台 /weddings/[weddingId]/thank-you（複製專屬連結）

## Background
- 賓客透過專屬連結開啟謝卡：信封 → 開封 → 謝卡滑出（花田裝飾）
- 內容自動帶入賓客名（範本 {{guestName}} → guest.name）；客製內容優先，否則統一範本
- 信箋文字（致謝詞 / 署名 / 日期）留空時帶入婚禮資料
- 後台改以「複製專屬連結」分享（email / link 寄送與 LINE 群發仍保留為既有選項）

---

## Business Invariants（合約核心）

1. 賓客能透過專屬連結開啟自己的謝卡，內容帶入自己的姓名
2. 客製謝卡內容優先於統一範本
3. 婚禮 / 賓客不存在時讀取失敗，使用者能感知原因
4. 後台能為任一賓客複製專屬謝卡連結

---

## Flow: 讀取賓客謝卡（happy-path，賓客端）

> 對應 Feature: 賓客公開謝卡 → Scenario: 讀取賓客謝卡

### 業務脈絡
- wedding-001、guest-001（陳大明）已存在
- 已設定範本（含 {{guestName}}）

### E2E 驗證流程
1. 進入 `/thankyou/wedding-001/guest-001`
2. 點擊信封開封
3. 謝卡顯示，賓客名帶入

### Verification 策略
- API spy / 查詢：`GET .../thank-you-card/public/guest-001`，回應 guestName=陳大明、content 已替換 {{guestName}}
- UI：信封可開啟、謝卡顯示賓客名

### 不再凍結
- 信封樣式與開封動畫、花田裝飾密度、謝卡視覺

---

## Flow: 讀取不存在賓客的謝卡（not-found）

> 對應 Feature: 賓客公開謝卡 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `GET .../thank-you-card/public/guest-999`
- 期待：4xx，訊息含「賓客不存在」

---

## Mock 假設
- seed：wedding-001、guest-001（陳大明）
- `GET .../thank-you-card/public/{guestId}` 回 PublicThankYouCard（content 已替換 {{guestName}}、客製優先、信箋文字帶入婚禮資料）；婚禮不存在回 404「婚禮不存在」、賓客不存在回 404「賓客不存在」
- 後台複製連結為純前端（clipboard），不打 API
