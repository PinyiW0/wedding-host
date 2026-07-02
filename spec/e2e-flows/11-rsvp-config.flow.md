# Flow: RSVP 表單客製化

> 對應規格：spec/gherkin-feature/ConfigureRsvpForm.feature
> 涵蓋頁面：/weddings/[weddingId]/rsvp/questions（題目設定）、/weddings/[weddingId]/rsvp/appearance（外觀設定）、賓客 /rsvp/[guestId]（依設定渲染）

## Background
- 管理員（Admin）設定 RSVP 表單：系統題開關／標籤／排序、新增自訂題、選擇模板與 banner
- 賓客（Guest）開啟 RSVP 頁時，表單依該婚禮的設定渲染
- 設定為單一資源 RsvpFormConfig（GET 讀回、PUT 覆寫）；未設定過回「預設範本」（現有那套題目）

---

## Business Invariants（合約核心）

1. 管理員能設定 RSVP 表單的題目組成：系統題可開關、可改標籤、可排序
2. 管理員能新增自訂題（單行文字／單選／多選）
3. 管理員能選擇表單外觀模板（minimal／floral／photo）與上傳 banner
4. 設定能被讀回（重整後仍在）；未設定過時回預設範本，賓客表單一律有可用設定可渲染
5. 賓客 RSVP 表單依設定渲染：停用的系統題不出現、自訂題出現且答案隨提交送出
6. 婚禮不存在時設定操作失敗，使用者能感知原因

---

## Flow: 成功設定 RSVP 表單（happy-path）

> 對應 Feature: 設定 RSVP 表單 → Scenario: 成功設定 RSVP 表單

### 業務脈絡
- wedding-001 已建立

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/rsvp/questions`
2. 停用某系統題（如「接駁車」）
3. 新增一題自訂題（單選），填標籤與選項
4. 切換模板（appearance 頁，如 floral）
5. 儲存

### Verification 策略
- API spy：`PUT .../weddings/wedding-001/rsvp-config`，payload 含 theme / questions（含停用項 enabled=false、自訂題）
- UI：儲存後使用者能感知成功（「已儲存」反饋）；右欄即時預覽反映變更

### 不再凍結
- 題目編輯形式（inline / modal）、排序方式（拖曳 / 上下鈕）、預覽位置、模板切換元件

---

## Flow: 設定不存在的婚禮（not-found）

> 對應 Feature: 設定 RSVP 表單 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `PUT .../weddings/wedding-999/rsvp-config` 帶 payload
- 期待：4xx，訊息含「婚禮不存在」

---

## Flow: 賓客表單依設定渲染（happy-path，賓客端）

### 業務脈絡
- wedding-001 已設定（或採預設範本）

### E2E 驗證流程
1. 進入賓客 RSVP 頁 `/rsvp/guest-001?weddingId=wedding-001`
2. 表單依設定渲染：啟用的系統題與自訂題出現、停用題不出現
3. 填寫並提交（含自訂題答案）

### Verification 策略
- API spy：`POST .../guests/guest-001/rsvp`，payload 含 customAnswers（自訂題答案，key=自訂題 id）
- UI：提交成功反饋（沿用既有 RSVP 提交合約，不破壞既有出席統計）

### 不再凍結
- 各題輸入元件形式、theme/banner 視覺

---

## Selector 策略（v2 通則）
1. 設定頁系統題：`getByText(/接駁|餐點|喜帖|祝福/)` 於題目列範圍
2. 動作按鈕：`getByRole('button', { name: /儲存|新增題目|啟用|停用/ })`
3. 模板切換：`getByRole('button'|'radio', { name: /minimal|floral|photo|極簡|花卉|大圖/ })`
4. async outcome：`page.waitForRequest`（rsvp-config / rsvp 端點）
5. testid：fallback only（建議 `vibe-rsvp-config-*`）

---

## Mock 假設
- seed：wedding-001
- `GET .../rsvp-config` 回 200 RsvpFormConfigDetail（未設定過回預設範本，不回 null）
- `PUT .../rsvp-config` 回 200 RsvpFormConfiguredEvent；婚禮不存在回 404「婚禮不存在」
- 預設範本＝現有那套系統題（出席／餐點／攜伴／兒童椅／接駁限男方／喜帖三選／祝福／手繪花），theme=minimal、banner=null
- 賓客提交沿用 `POST .../rsvp`，customAnswers 為自訂題答案（選填，不影響既有出席統計）
