# Flow: 謝卡與感謝訊息

> 對應規格：spec/gherkin-feature/SetThankYouCardTemplate.feature, CustomizeThankYouCard.feature, SendThankYouBatch.feature, SendThankYouFallback.feature
> 涵蓋頁面：/weddings/[weddingId]/thank-you（謝卡範本設定 + 個別客製 + 群發 / 替代感謝）

## Background
- 已登入為管理員（Admin）
- 已選定一場婚禮（wedding-001）
- 群發感謝透過 LINE Bot 發給已綁定 LINE 的賓客；替代感謝走 Email 或連結

---

## Business Invariants（合約核心）

1. 管理員能設定謝卡範本（內容與圖片）
2. 管理員能為個別賓客客製謝卡內容
3. 管理員能群發感謝訊息給已綁定 LINE 的賓客，並感知發送結果（人數）
4. 管理員能對未加 LINE 好友的賓客發送替代感謝（Email / 連結）
5. 對不存在婚禮 / 無已綁定賓客的操作，使用者能感知失敗原因

---

## Flow: 成功設定謝卡範本（happy-path）

> 對應 Feature: 設定謝卡範本 → Scenario: 成功設定謝卡範本

### 業務脈絡
- wedding-001 已建立

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/thank-you`
2. 觸發「設定謝卡範本」
3. 填寫：
   - 範本內容 → 感謝您的祝福，我們會永遠珍惜！
   - 範本圖片 → 上傳 / 帶入 templateImageUrl
4. 儲存

### Verification 策略
- API spy：`PUT/POST .../thank-you-card/template`，payload 含 templateContent / templateImageUrl
- UI：使用者能感知已儲存（成功反饋 / 範本預覽更新）

### 不再凍結
- 圖片上傳元件、預覽呈現

---

## Flow: 設定謝卡範本時婚禮不存在（not-found）

> 對應 Feature: 設定謝卡範本 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `PUT /api/v1/weddings/wedding-001/thank-you-card/template`（無此婚禮）帶 payload
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 成功客製謝卡（happy-path）

> 對應 Feature: 客製謝卡 → Scenario: 成功客製謝卡

### 業務脈絡
- wedding-001 已建立，為 guest-001 客製

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/thank-you`，選擇個別賓客客製入口
2. 選擇對象 → guest-001
3. 填寫客製內容 → 親愛的王大明，特別感謝您遠道而來！
4. 儲存

### Verification 策略
- API spy：`POST/PUT .../thank-you-card/customizations`，payload 含 guestId / customContent
- UI：使用者能感知客製已儲存（成功反饋 / 該賓客客製內容出現）

### 不再凍結
- 賓客選擇形式、客製清單呈現

---

## Flow: 客製謝卡時婚禮不存在（not-found）

> 對應 Feature: 客製謝卡 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST /api/v1/weddings/wedding-001/thank-you-card/customizations`（無此婚禮）帶 guestId / customContent
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 成功群發感謝訊息（happy-path）

> 對應 Feature: 群發感謝訊息 → Scenario: 成功群發感謝訊息

### 業務脈絡
- wedding-001 已建立，且有已綁定 LINE 的賓客（guest-001）

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/thank-you`
2. 觸發「群發感謝訊息」
3. 若有 confirm，完成確認
4. 期待：
   - API spy：`POST .../thank-you/batch-send`
   - UI：使用者能感知發送結果（含人數 50，如「已發送給 50 位賓客」），`getByText(/50/)` 出現於反饋

### Verification 策略
- API spy（batch-send 端點）
- UI：成功反饋含 recipientCount 50

### 不再凍結
- confirm 形式、發送結果呈現（toast / summary）

---

## Flow: 群發時婚禮不存在（not-found）

> 對應 Feature: 群發感謝訊息 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST /api/v1/weddings/wedding-001/thank-you/batch-send`（無此婚禮）
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 群發時無已綁定 LINE 的賓客（condition / no-bound-guests）

> 對應 Feature: 群發感謝訊息 → Scenario: 沒有已綁定 LINE 的賓客

### 業務脈絡
- wedding-001 已建立，但無賓客綁定 LINE

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/thank-you`
2. 觸發「群發感謝訊息」
3. 期待：使用者看到錯誤訊息：含「沒有已綁定 LINE 的賓客」

### Verification 策略
- `getByRole('alert')` 或 `getByText(/沒有已綁定 LINE 的賓客/)`
- API spy：batch-send 回 4xx，未發送

### 不再凍結
- 是否前端先擋（顯示空狀態提示）或後端回錯

---

## Flow: 透過 Email 發送替代感謝（happy-path）

> 對應 Feature: 發送替代感謝 → Scenario: 透過 Email 發送替代感謝

### 業務脈絡
- wedding-001 已建立，對未加 LINE 好友的 guest-002 發送

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/thank-you` 的替代感謝入口
2. 選擇對象 → guest-002，管道 → Email
3. 發送

### Verification 策略
- API spy：`POST .../thank-you/fallback-send`，payload 含 channel=email / guestId
- UI：使用者能感知已發送（成功反饋）

### 不再凍結
- 管道選擇形式（email / 連結）、對象選擇形式

---

## Flow: 替代感謝時婚禮不存在（not-found）

> 對應 Feature: 發送替代感謝 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST /api/v1/weddings/wedding-001/thank-you/fallback-send`（無此婚禮）帶 channel / guestId
- 期待：4xx，訊息含「婚禮不存在」

---

## Selector 策略（v2 通則）

1. 動作按鈕：`getByRole('button', { name: /設定.*範本|客製|群發|發送/ })`
2. 賓客選擇：`getByRole('option', { name: /王大明|guest-002/ })` 或對應選單
3. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/婚禮不存在|沒有已綁定 LINE 的賓客/)`
4. 發送結果人數：`getByText(/50/)`
5. async outcome：`page.waitForRequest`（template / customizations / batch-send / fallback-send 端點）
6. testid：fallback only

---

## Mock 假設
- seed：wedding-001、guest-001（已綁定 LINE）、guest-002（未綁定 LINE）
- `PUT .../thank-you-card/template`、`POST .../thank-you-card/customizations`：婚禮不存在回 404「婚禮不存在」
- `POST .../thank-you/batch-send`：婚禮不存在回 404；無已綁定賓客回 409「沒有已綁定 LINE 的賓客」；成功回 recipientCount 50
- `POST .../thank-you/fallback-send`：婚禮不存在回 404「婚禮不存在」
