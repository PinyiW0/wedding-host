# Flow: 座位與場地佈局

> 對應規格：spec/gherkin-feature/AddTable.feature, UpdateTable.feature, RemoveTable.feature, ConfigureVenueLayout.feature, SeatGuest.feature, UnseatGuest.feature
> 涵蓋頁面：/weddings/[weddingId]/seating（場地平面圖：桌次 CRUD + 場地佈局 + 座位安排）

## Background
- 已登入為管理員（Admin）
- 已選定一場婚禮（wedding-001）
- 桌次以事件源管理；座位安排記錄賓客入座狀態

---

## Business Invariants（合約核心）

1. 管理員能在平面圖新增 / 更新 / 移除桌次（名稱、座位數、座標位置）
2. 桌次上仍有賓客入座時不可移除
3. 管理員能設定場地佈局（舞台位置與大小）
4. 管理員能將賓客（含同行與兒童椅嬰兒）安排至桌次、也能取消座位；一個賓客組依人數展開為多個席位（正常席「名字N」、兒童椅「名字-兒童N」）
5. 容量以「人頭」計：一桌正常席人頭（partySize − 兒童椅嬰兒數）不可超過 capacity（兒童椅額外加位、不佔正常席）；正常席已滿 / 賓客已有座位時不可重複安排；賓客不在此桌時不可取消
6. 桌次的識別欄位（tableName）與正常席容量（capacity）可被使用者讀到

---

## Flow: 成功新增桌次（happy-path）

> 對應 Feature: 新增桌次 → Scenario: 成功新增桌次

### 業務脈絡
- 系統無既有桌次

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 觸發「新增桌次」
3. 填寫 / 設定：
   - 桌次名稱 → 主桌
   - 座位數 → 10
   - 位置（positionX/Y → 100/200，可由拖放或表單）
4. 提交

### Verification 策略
- API spy：`POST /api/v1/weddings/wedding-001/tables`，payload 含 tableName / capacity / positionX / positionY
- UI：平面圖 / 列表新增可識別的「主桌」實體（`getByText(/主桌/)`），能讀到座位數 10（抽樣）

### 不再凍結
- 位置設定方式（拖放畫布 / 數字輸入）
- 桌次呈現（畫布節點 / 列表列 / 卡片）

---

## Flow: 成功更新桌次（happy-path）

> 對應 Feature: 更新桌次 → Scenario: 成功更新桌次

### 業務脈絡
- table-001（主桌 / 10 座）已存在

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 在 table-001（主桌）範圍內觸發「編輯」
3. 修改：
   - 桌次名稱 → 貴賓桌
   - 座位數 → 12
   - 位置 → 150/250
4. 提交

### Verification 策略
- API spy：`PATCH/PUT .../tables/table-001`，payload 含更新後 tableName / capacity / position
- UI：能讀到新名稱「貴賓桌」

### 不再凍結
- 編輯入口（雙擊節點 / kebab / 詳情面板）

---

## Flow: 更新不存在的桌次（not-found）

> 對應 Feature: 更新桌次 → Scenario: 桌次不存在

### 性質
API 邊界保護。

### 驗證流程
- `PATCH .../tables/table-999` 帶 payload
- 期待：4xx，訊息含「桌次不存在」

---

## Flow: 成功移除桌次（happy-path）

> 對應 Feature: 移除桌次 → Scenario: 成功移除桌次

### 業務脈絡
- table-001（主桌）存在且無人入座

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 在 table-001 範圍內觸發「移除」
3. 若有 confirm dialog，完成確認
4. 期待：
   - API spy：`DELETE .../tables/table-001`
   - 「主桌」不再可見

### Verification 策略（destructive）
- 主要靠 API spy（DELETE）
- UI：移除後「主桌」不可見

### 不再凍結
- confirm 形式、觸發位置

---

## Flow: 移除不存在的桌次（not-found）

> 對應 Feature: 移除桌次 → Scenario: 桌次不存在

### 性質
API 邊界保護。

### 驗證流程
- `DELETE .../tables/table-999`
- 期待：4xx，訊息含「桌次不存在」

---

## Flow: 桌次仍有賓客時拒絕移除（condition / has-seated-guests）

> 對應 Feature: 移除桌次 → Scenario: 桌次上還有賓客

### 業務脈絡
- table-001（主桌）已有 guest-001 入座

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 在 table-001 範圍內觸發「移除」並（若有）確認
3. 期待：使用者看到錯誤訊息：含「桌次上還有賓客，無法移除」；桌次仍存在

### Verification 策略
- `getByRole('alert')` 或 `getByText(/桌次上還有賓客，無法移除/)`
- API spy：DELETE 回 4xx，桌次未刪除

### 不再凍結
- 錯誤呈現形式（toast / banner / dialog inline）

---

## Flow: 成功安排座位（happy-path）

> 對應 Feature: 安排座位 → Scenario: 成功安排座位

### 業務脈絡
- table-001（主桌 / 10 座）存在且有空位

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 觸發將 guest-001 安排至 table-001 的座位 1（拖放賓客到桌 / 表單選擇皆可）
3. 期待：
   - API spy：`POST .../tables/table-001/seats`（或 seat 端點），payload 含 guestId / seatNumber
   - UI：guest-001 顯示為已入座於 table-001

### Verification 策略
- API spy（seat 端點）
- UI：在 table-001 範圍內能找到 guest-001 的入座呈現

### 不再凍結
- 安排方式（拖放 / 下拉指派 / 點座位）
- 入座呈現（座位圖 / 名單）

---

## Flow: 安排座位時桌次不存在（not-found）

> 對應 Feature: 安排座位 → Scenario: 桌次不存在

### 性質
API 邊界保護。

### 驗證流程
- `POST .../tables/table-999/seats` 帶 guestId
- 期待：4xx，訊息含「桌次不存在」

---

## Flow: 桌次已滿（condition / table-full）

> 對應 Feature: 安排座位 → Scenario: 桌次已滿

### 業務脈絡
- table-001 的正常席人頭已達 capacity（兒童椅額外、不佔正常席）

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 嘗試將賓客安排至正常席已滿的 table-001（其正常席人頭會超過 capacity）
3. 期待：使用者看到錯誤訊息：含「桌次已滿，無法再安排座位」

### Verification 策略
- `getByText(/桌次已滿，無法再安排座位/)`
- API spy：seat 端點回 4xx，未入座

---

## Flow: 賓客已有座位（integrity-constraint / guest-already-seated）

> 對應 Feature: 安排座位 → Scenario: 賓客已有座位

### 業務脈絡
- guest-001 已在 table-001 入座

### E2E 驗證流程
1. 嘗試再次將 guest-001 安排至 table-001 的另一座位
2. 期待：使用者看到錯誤訊息：含「賓客已有座位」

### Verification 策略
- `getByText(/賓客已有座位/)`
- API spy：seat 端點回 4xx

---

## Flow: 成功取消座位（happy-path）

> 對應 Feature: 取消座位 → Scenario: 成功取消座位

### 業務脈絡
- guest-001 已在 table-001（座位 3）入座

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 在 table-001 範圍內，對 guest-001 觸發「取消座位」
3. 期待：
   - API spy：`DELETE .../tables/table-001/seats/guest-001`（或取消端點），payload / path 含 guestId
   - guest-001 不再顯示於 table-001

### Verification 策略
- API spy（unseat 端點）
- UI：取消後 table-001 範圍內不再有 guest-001

### 不再凍結
- 取消觸發形式（座位上 X / 名單 action）

---

## Flow: 取消座位時桌次不存在（not-found）

> 對應 Feature: 取消座位 → Scenario: 桌次不存在

### 性質
API 邊界保護。

### 驗證流程
- `DELETE .../tables/table-999/seats/guest-001`
- 期待：4xx，訊息含「桌次不存在」

---

## Flow: 賓客不在此桌（not-found / guest-not-at-table）

> 對應 Feature: 取消座位 → Scenario: 賓客不在此桌

### 性質
API 邊界保護。

### 驗證流程
- table-001 存在但 guest-999 未入座，`DELETE .../tables/table-001/seats/guest-999`
- 期待：4xx，訊息含「賓客不在此桌」

---

## Flow: 成功設定場地佈局（happy-path）

> 對應 Feature: 設定場地佈局 → Scenario: 成功設定場地佈局

### 業務脈絡
- wedding-001 已建立

### E2E 驗證流程
1. 進入 `/weddings/wedding-001/seating`
2. 觸發「設定場地佈局 / 舞台」
3. 設定舞台位置與大小（stageWidth 300、stageHeight 150、stagePositionX 500、stagePositionY 100，可由拖放或表單）
4. 提交

### Verification 策略
- API spy：`PUT/POST .../venue-layout`，payload 含 stageWidth / stageHeight / stagePositionX / stagePositionY
- UI：使用者能感知舞台已設定（畫布出現舞台元素 / 成功反饋）

### 不再凍結
- 舞台設定方式（拖放畫布 / 數字輸入）

---

## Flow: 設定場地佈局時婚禮不存在（not-found）

> 對應 Feature: 設定場地佈局 → Scenario: 婚禮不存在

### 性質
API 邊界保護。

### 驗證流程
- `PUT /api/v1/weddings/wedding-999/venue-layout` 帶舞台 payload
- 期待：4xx，訊息含「婚禮不存在」

---

## Selector 策略（v2 通則）

1. role + name regex 找桌次 / 賓客實體：`getByRole('row', { name: /主桌/ })`、`getByText(/陳大明/)`
2. 動作按鈕：`getByRole('button', { name: /新增桌次|編輯|移除|安排|取消座位|設定佈局/ })`
3. 反饋 / 錯誤：`getByRole('alert')` 或 `getByText(/桌次不存在|桌次上還有賓客|桌次已滿|賓客已有座位|賓客不在此桌|婚禮不存在/)`
4. seat / unseat outcome：`page.waitForRequest`
5. testid（fallback）：畫布節點若無可見名稱可用 `table-row-table-001`；座位定位用 `table-001-seat-1`（僅在純畫布無語意角色時）

---

## Mock 假設
- seed：wedding-001、table-001（主桌 / 10 座 / 100,200）
- `POST .../tables` 回 201；`PATCH .../tables/{id}` 不存在回 404「桌次不存在」
- `DELETE .../tables/{id}`：有人入座回 409「桌次上還有賓客，無法移除」；不存在回 404
- seat 端點：依賓客 partySize / childChairCount 展開為多筆座位（正常席 normal + 兒童椅 childChair）；正常席人頭超過 capacity 回 409「桌次已滿，無法再安排座位」；重複回 409「賓客已有座位」；桌次不存在回 404
- unseat 端點：一次清除該賓客在該桌的所有座位；桌次不存在回 404「桌次不存在」；賓客不在桌回 404「賓客不在此桌」
- venue-layout：婚禮不存在回 404「婚禮不存在」
