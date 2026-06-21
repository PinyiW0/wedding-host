# Flow: LINE 官方帳號連結

> 對應規格：spec/gherkin-feature/ConnectLineOa.feature
> 涵蓋頁面：/weddings/[weddingId]/line（將 LINE 官方帳號連結至婚禮）

## Background
- 已登入為管理員（Admin）
- 已選定一場婚禮（wedding-001）

---

## Business Invariants（合約核心）

1. 管理員能將 LINE 官方帳號連結至婚禮（輸入 OA 名稱與 channelId）
2. 連結成功後使用者能感知（OA 名稱顯示為已連結）
3. 對不存在婚禮的連結操作，使用者能感知失敗（「婚禮不存在」）

---

## Flow: 成功連結 LINE 官方帳號（happy-path）

> 對應 Feature: 連結 LINE 官方帳號 → Scenario: 成功連結 LINE 官方帳號

### 業務脈絡
- wedding-001 已建立

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/line`
2. 觸發「連結 LINE 官方帳號」
3. 填寫：
   - OA 名稱 → 王李婚禮小助手
   - Channel ID → 1234567890
4. 提交

### Verification 策略
- API spy：`POST/PUT .../line-oa`，payload 含 oaName / channelId
- UI：連結後能讀到 OA 名稱「王李婚禮小助手」並顯示已連結狀態

### 不再凍結
- 表單呈現（modal / inline）
- 已連結狀態呈現（badge / 狀態文字）

---

## Flow: 連結時婚禮不存在（not-found）

> 對應 Feature: 連結 LINE 官方帳號 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST /api/v1/weddings/wedding-999/line-oa` 帶 oaName / channelId
- 期待：4xx，訊息含「婚禮不存在」

---

## Selector 策略（v2 通則）

1. 動作按鈕：`getByRole('button', { name: /連結|綁定|儲存/ })`
2. 表單欄位：`getByLabel(/OA 名稱|官方帳號名稱/)`、`getByLabel(/Channel ID|頻道/)`
3. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/婚禮不存在/)`、`getByText(/王李婚禮小助手/)`
4. async outcome：`page.waitForRequest`（line-oa 端點）
5. testid：fallback only

---

## Mock 假設
- seed：wedding-001
- `POST .../line-oa` 回 200/201 + LineOaConnected；婚禮不存在回 404「婚禮不存在」
