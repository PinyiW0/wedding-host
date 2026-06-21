# Flow: 賓客管理

> 對應規格：spec/gherkin-feature/AddGuest.feature, UpdateGuest.feature, RemoveGuest.feature, RestoreGuest.feature, ImportGuestsBatch.feature, BindGuestLine.feature
> 涵蓋頁面：/weddings/[weddingId]/guests（賓客列表 + 新增 / 編輯 / 移除 / 恢復 / 批次匯入）、賓客專屬 LINE 綁定連結 /guest/[guestId]/bind（賓客端）

## Background
- 已登入為管理員（Admin）操作賓客 CRUD 與匯入
- 賓客綁定 LINE 為賓客（Guest）端透過專屬連結操作
- 賓客以事件源管理，狀態：未移除 / 已移除（軟刪）、LINE 未綁定 / 已綁定

---

## Business Invariants（合約核心）

1. 管理員能手動新增賓客（姓名、男女方、飲食、是否需兒童座椅、聯絡方式、分類、備註）
2. 管理員能更新既有賓客資料
3. 管理員能軟刪除賓客並能恢復已軟刪除的賓客
4. 管理員能透過 Excel 檔批次匯入賓客，並感知匯入結果（筆數）
5. 賓客能透過專屬連結綁定 LINE
6. 賓客的識別欄位（name）與關鍵屬性（side / diet / category）可被使用者讀到
7. 各種不存在 / 狀態不符的操作，使用者能感知失敗原因

---

## Flow: 成功新增賓客（happy-path）

> 對應 Feature: 新增賓客 → Scenario: 成功新增賓客

### 業務脈絡
- 系統無既有資料

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/guests`
2. 觸發「新增賓客」
3. 填寫表單：
   - 姓名 → 陳大明
   - 男女方 → 男方（groom）
   - 飲食 → 葷食（meat）
   - 分類 → 同事
   - 聯絡方式 → 0912345678
   - 是否需兒童座椅 → 否
   - 備註 → 需要靠近舞台
4. 提交

### Verification 策略
- API spy：`POST /api/v1/weddings/wedding-001/guests`，payload 含 name / side / diet / category / contact / needChildSeat / notes
- UI：列表新增可識別的「陳大明」實體（`getByText(/陳大明/)`），且能讀到 side（男方）與 category（同事）

### Business Invariant 必涵蓋
- 新增的賓客可被識別（name）
- 主要狀態欄（side / diet / category）可達

### 不再凍結
- side / diet / needChildSeat 的輸入元件（select / radio / segment / checkbox）
- 表單呈現（modal / 獨立頁）

---

## Flow: 成功更新賓客（happy-path）

> 對應 Feature: 更新賓客 → Scenario: 成功更新賓客

### 業務脈絡
- guest-001（陳大明 / 男方 / 葷食 / 同事）已存在

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/guests`
2. 在 guest-001（陳大明）實體範圍內觸發「編輯」
3. 修改欄位：
   - 飲食 → 素食（vegetarian）
   - 男女方 → 女方（bride）
   - 分類 → 朋友
   - 聯絡方式 → 0987654321
   - 是否需兒童座椅 → 是
   - 備註 → 改為素食
4. 提交

### Verification 策略
- API spy：`PATCH/PUT /api/v1/weddings/wedding-001/guests/guest-001`，payload 含更新後欄位
- UI：更新後能讀到新分類「朋友」或新飲食「素食」（抽樣）

### 不再凍結
- 編輯入口位置

---

## Flow: 更新不存在的賓客（not-found）

> 對應 Feature: 更新賓客 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `PATCH /api/v1/weddings/wedding-001/guests/guest-999` 帶 payload
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 成功移除賓客（happy-path）

> 對應 Feature: 移除賓客 → Scenario: 成功移除賓客

### 業務脈絡
- guest-001（陳大明）已存在、未移除

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/guests`
2. 在 guest-001 實體範圍內觸發「移除」
3. 若有 confirm dialog，完成確認
4. 期待：
   - API spy：`DELETE /api/v1/weddings/wedding-001/guests/guest-001`
   - guest-001 從未移除清單消失（或標示為已移除可恢復）

### Verification 策略（destructive）
- 主要靠 API spy（DELETE / 軟刪端點）
- UI：執行後「陳大明」不在預設清單

### 不再凍結
- confirm 形式、已移除賓客的呈現（隱藏 / 回收區）

---

## Flow: 移除不存在的賓客（not-found）

> 對應 Feature: 移除賓客 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `DELETE /api/v1/weddings/wedding-001/guests/guest-999`
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 重複移除賓客（condition / already-removed）

> 對應 Feature: 移除賓客 → Scenario: 賓客已移除

### 性質
API 邊界保護。

### 驗證流程
- guest-001 已移除狀態下，再 `DELETE .../guests/guest-001`
- 期待：4xx，訊息含「賓客已移除」

---

## Flow: 成功恢復賓客（happy-path）

> 對應 Feature: 恢復賓客 → Scenario: 成功恢復賓客

### 業務脈絡
- guest-001 已新增且已移除

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/guests`（含已移除分區 / 篩選）
2. 在已移除的 guest-001 範圍內觸發「恢復」
3. 期待：
   - API spy：`POST /api/v1/weddings/wedding-001/guests/guest-001/restore`
   - guest-001 回到未移除清單

### Verification 策略
- API spy（restore 端點）
- UI：恢復後「陳大明」重新出現於預設清單

### 不再凍結
- 已移除分區進入方式（tab / filter）

---

## Flow: 恢復不存在的賓客（not-found）

> 對應 Feature: 恢復賓客 → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-999/restore`
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 恢復未被移除的賓客（condition / not-removed）

> 對應 Feature: 恢復賓客 → Scenario: 賓客未被移除

### 性質
API 邊界保護。

### 驗證流程
- guest-001 未移除狀態下，`POST .../guests/guest-001/restore`
- 期待：4xx，訊息含「賓客未被移除」

---

## Flow: 成功批次匯入賓客（happy-path）

> 對應 Feature: 批次匯入賓客 → Scenario: 成功批次匯入賓客

### 業務脈絡
- 系統無既有資料，管理員上傳合法 Excel（guests-2026.xlsx）

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/guests`
2. 觸發「批次匯入」
3. 選擇 / 上傳檔案 guests-2026.xlsx（.xlsx）
4. 提交匯入

### Verification 策略
- API spy：`POST /api/v1/weddings/wedding-001/guests/import`（multipart 或 fileName payload）
- UI：使用者能感知匯入結果（含匯入筆數 25，如「成功匯入 25 位賓客」），`getByText(/25/)` 出現於反饋區

### 不再凍結
- 上傳元件形式（file input / drag-drop）
- 匯入結果呈現（toast / summary panel / 列表刷新）

---

## Flow: 匯入檔案格式不正確（field-validation）

> 對應 Feature: 批次匯入賓客 → Scenario: 檔案格式不正確

### 業務脈絡
- 上傳非 Excel 檔（guests.pdf）

### E2E 驗證流程
1. 進入批次匯入入口
2. 選擇 guests.pdf
3. 提交匯入

### Verification 策略
- 使用者能看到錯誤訊息：含「檔案格式不正確，僅支援 .xlsx 或 .xls 格式」
- API spy（若前端先擋）：可能不發 request；若送出則回 4xx 同訊息

### 不再凍結
- 前端先擋還是後端回錯（兩者皆可，但錯誤語意必須可見）

---

## Flow: 成功綁定 LINE（happy-path，賓客端）

> 對應 Feature: 綁定賓客 LINE → Scenario: 成功綁定 LINE

### 業務脈絡
- guest-001 已新增、尚未綁定 LINE
- 賓客透過專屬連結進入綁定頁

### E2E 驗證流程
1. 進入賓客專屬綁定頁（如 `/guest/guest-001/bind`，含 weddingId 與 token 情境）
2. 觸發 LINE 綁定（模擬完成 LINE 授權回傳 lineUserId）
3. 期待：
   - API spy：`POST /api/v1/weddings/wedding-001/guests/guest-001/line-binding`，payload 含 lineUserId
   - 使用者能感知綁定成功（「已綁定」/「綁定成功」反饋）

### Verification 策略
- API spy（綁定端點）
- UI：成功反饋（role=status / 「綁定成功」文字）

### 不再凍結
- LINE 授權流程的模擬方式（mock callback / 直接帶 lineUserId）
- 成功頁呈現

---

## Flow: 綁定不存在的賓客（not-found，賓客端）

> 對應 Feature: 綁定賓客 LINE → Scenario: 賓客不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../guests/guest-999/line-binding` 帶 lineUserId
- 期待：4xx，訊息含「賓客不存在」

---

## Flow: 重複綁定 LINE（condition / already-bound，賓客端）

> 對應 Feature: 綁定賓客 LINE → Scenario: 已綁定 LINE

### 性質
API 邊界保護。

### 驗證流程
- guest-001 已綁定 LINE 狀態下，再 `POST .../guests/guest-001/line-binding` 帶新 lineUserId
- 期待：4xx，訊息含「已綁定 LINE」

---

## Selector 策略（v2 通則）

1. role + name regex 找賓客實體：`getByRole('row', { name: /陳大明/ })`
2. 動作按鈕：`getByRole('button', { name: /新增|編輯|移除|恢復|匯入|綁定/ })`
3. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/賓客不存在|賓客已移除|賓客未被移除|已綁定 LINE|檔案格式不正確/)`
4. destructive / async outcome：`page.waitForRequest`（DELETE / restore / import / line-binding）
5. testid：fallback only（如同名賓客碰撞時 `guest-row-guest-001`）

---

## Mock 假設
- seed：guest-001（陳大明 / 男方 / 葷食 / 同事 / 未綁定 LINE）
- `POST .../guests` 回 201；`PATCH .../guests/{id}` 不存在回 404「賓客不存在」
- `DELETE .../guests/{id}` 軟刪；已移除回 409「賓客已移除」；不存在回 404
- `POST .../guests/{id}/restore` 未移除回 409「賓客未被移除」；不存在回 404
- `POST .../guests/import` 合法 .xlsx 回 200 + importedCount 25；非 Excel 回 4xx「檔案格式不正確，僅支援 .xlsx 或 .xls 格式」
- `POST .../guests/{id}/line-binding` 已綁定回 409「已綁定 LINE」；不存在回 404
