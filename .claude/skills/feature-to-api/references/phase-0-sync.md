# Phase 0: Sync 模式步驟

> 僅當 `spec/report/route-map.yaml` 存在時進入此流程。
> 全量模式步驟 → 詳見 [phase-0-prep.md](phase-0-prep.md)

---

### 步驟 1：讀取 PM 設定 + 設定檔變更偵測

同全量模式，讀取 `ui-config-pm.yaml` 並同步到 `ui-config.yaml`。

同步完成後，比對同步前後的 `ui-config.yaml` 差異，記錄變更的設定區塊：

| 變更的設定區塊 | 影響的 Phase |
|--------------|-------------|
| `theme.colors` | Phase 2 |
| `project.*`（name, description, favicon） | Phase 2 |
| `meta.*`（keywords, author, og） | Phase 2 |
| `colorMode.*` | Phase 2 |
| `table.*` | Phase 4 |
| `delete.*` | Phase 4 |
| `toast.*` | Phase 3（UApp toaster 設定） |
| `responsive.sidebar.*` | Phase 3 |

> 此偵測結果會在步驟 8 產出「Phase 執行建議」時使用。

### 步驟 2：讀取現有 route-map.yaml

- 解析所有已登錄的路由、features（含 `content_hash`）
- 記錄當前 `version` 欄位值
- **記錄 `api_contract.path_prefix`**（給步驟 2.5 比對用）

### 步驟 2.5：Path 前綴漂移檢查（⚠️ 必跑）

> **目的**：path 前綴是專案級不變量，不可因 SoT 模式切換（OpenAPI ↔ Feature）、spec 改寫、Claude 重抽而默默變動。此步驟保護你從「OpenAPI 模式 → Feature 推導模式」或反向切換時不會搬動整批 `server/api/` 結構。

#### 流程

1. 取既有值：`route-map.yaml > api_contract.path_prefix`（步驟 2 已讀）
2. 重新偵測本次預期前綴：
   - **OpenAPI 模式**：讀 `spec/api/api-spec.yml > servers.url`，取 path 段（去掉 protocol+host+port）
   - **Feature 推導模式**：掃 `server/api/` 取最長共同前綴
3. 比對：

   | 情況 | 動作 |
   |------|------|
   | 既有 path_prefix **不存在**（舊版 route-map） | 寫入本次偵測值，sync-report 記錄「初始化 path_prefix = X」 |
   | 兩值相同 | 通過，繼續步驟 3 |
   | 兩值不同 | **停下來詢問使用者**（見下方），不要默默改寫 |

#### 不一致時的對話腳本

```
偵測到 API path 前綴漂移：
- route-map.yaml 既有：/api/v1
- 本次偵測（{OpenAPI servers.url / server/api/ 結構}）：/v1

可能原因：
  (a) 後端真的改了前綴（如 v1 → v2 升版） 
      → 我會更新 route-map.yaml + 列入 sync-report「待批次調整」（含 server/api/ 資料夾、app/api/ 引用）
  (b) spec / 程式碼狀態漂移（無心改動） 
      → 維持既有 path_prefix，提示你修正 spec 或還原誤改

請選 (a) 或 (b)，或描述其他情況。
```

#### 不要做的事

- ❌ 默默把 `route-map.yaml > path_prefix` 改成新值
- ❌ 默默把既有 endpoint 路徑全部改寫
- ❌ 把 host name 寫進 path_prefix（OpenAPI `servers.url` 含絕對 URL 時，**只取 path 段**）

### 步驟 3：掃描所有新版 .dsl.feature

- 路徑：`spec/gherkin-feature/*.dsl.feature`
- 計算每個檔案的 `content_hash`

### 步驟 4：讀取現有型別定義

- 讀取 `app/types/api/*.ts` 的所有 export interface / type
- 建立「型別名 → 欄位清單」對照表（作為欄位級比對基準）

### 步驟 5：逐一比對每個 feature

| 情況 | 判定 |
|------|------|
| route-map 中找不到此 feature | 標記「**新增**」 |
| 找到但 `content_hash` 不同 | 進入步驟 6 分析變更程度 |
| 找到且 `content_hash` 相同 | 標記「**無變化**」 |
| route-map 中有但 feature 檔已不存在 | 標記「**刪除**」 |

### 步驟 6：變更程度判斷

> 機械式規則，不是 AI 猜測。**必須按下方 checklist 逐步判定，並在變更報告中附上判定過程**。

#### 判定 Checklist（依序執行，遇到即停止）

```
1. 端點路徑是否有變更（改名/刪除）？
     → 是 → rebuild（停止）
     → 否 → 繼續

2. 是否出現全新的 Command 類型（如：從未有過的 API 操作）？
     → 是 → rebuild（停止）
     → 否 → 繼續

3. 計算欄位增減數量 = |新增欄位數| + |刪除欄位數|
     → > 2 → rebuild（停止）
     → ≤ 2 → 繼續

4. 計算新增 Scenario 數量，並逐一分類：
     a) 「欄位驗證型」：Scenario 名稱或內容可明確對應到新增欄位
        （如：「體重超出範圍」對應新增的 weight 欄位）
     b) 「新功能型」：無法對應到任何新增欄位
        （如：「搜尋球員」「AI 狀態篩選」「分頁」）

     → 存在任何「新功能型」Scenario → rebuild（停止）
     → 全部都是「欄位驗證型」→ patch（停止）

5. 以上皆否（僅措辭/數值微調、Background 資料微調）
     → patch
```

#### 判定結果記錄格式

在變更報告的「Feature 變更總覽」表格中，`說明` 欄須包含判定依據：

```markdown
| 04-建立球隊 | 修改 | patch | /teams | 新增 1 欄位(簡介) + 2 Scenario 皆為該欄位驗證 → checklist #4a → patch |
| 12-查詢訓練列表 | 修改 | rebuild | /trainings | 新增 6 Scenario 含搜尋/篩選/分頁(新功能型) → checklist #4b → rebuild |
```

> **不附判定依據 = 違規**。這是確保判定可追溯、可驗證的關鍵。

### 步驟 7：推導下游影響

根據步驟 5-6 的結果，推導受影響的下游產出：

| 變更 | 影響範圍 |
|------|---------|
| 欄位變更 | → 對應的 `types/api/*.ts` → import 該型別的 API 端點 → 使用該型別的頁面 |
| Scenario 變更 | → 對應頁面的 UI 邏輯 |
| 端點路徑變更 | → `server/api/` 端點 → 呼叫該端點的頁面 |
| 新增 feature | → 可能需要新型別、新端點、新路由、新頁面 |
| 刪除 feature | → 標記待刪除項目（Phase 5 開始時確認後執行） |

### 步驟 7.5：additionalFeatures 變更偵測

- 比對 PM yaml 的 `additionalFeatures` 與現有 `route-map.yaml > enabled_features`
- 新啟用的功能 → 在變更報告中標註，Phase 4 需要建立對應元件
- 關閉的功能 → 在待刪除項目中標記（不自動移除）

### 步驟 7.6：孤兒偵測（反向 audit，⚠️ 必跑）

> **目的**：當 feature 移除整個 Feature / Scenario / Command / Event，正向 rebuild 不會偵測到「codebase 仍殘留」，導致 UI / types / endpoints 變成孤兒（沒人測、沒人引用）。**本步驟反向掃描，補正向流程的缺口。**

#### 偵測流程

1. **抽取新版 feature 的「合約 symbol 集」**：
   - Commands：`When {Actor} sends {CommandName}` → `{CommandName}Body`
   - Events：`Then the {EventName} event is emitted` → `{EventName}Event`
   - Views：`When the {ViewName} view is queried` → `{ViewName}Item` / `{ViewName}Detail`
   - Operations failure：`Then the operation fails with: {message}` → error message 字串

2. **抽取 codebase 的「實作 symbol 集」**：
   - `app/types/api/*.ts` 的 `export interface` / `export type` 名稱
   - `server/api/v1/**/*.ts` 的 endpoint 路由 + method（檔名 / HTTP verb）
   - `app/pages/**/*.vue` 中 `import { X } from '~/types/api'` 的 X 集合

3. **差集 = 孤兒**：
   - `type 孤兒` = codebase types ∖ feature contract types
   - `endpoint 孤兒` = codebase endpoints ∖ feature contract endpoints
   - `UI 孤兒` = 引用孤兒 type 的 .vue 檔（連帶相關 button / Modal / handler）

#### 不視為孤兒的例外（白名單）

| 例外類型 | 範例 | 處理 |
|---------|------|------|
| 過渡兼容欄位（feature 已遷移，server 為兼容 UI 保留） | `PracticeHistoryItem.startedAt` 為兼容欄位 | type 加 `@deprecated` 註解，報告標「兼容」不視為孤兒 |
| 基礎設施路由 | `/api/__test__/reset`、`/api/health` | 跳過 |
| UI extension（feature 未定義但 UI 有額外需求） | `ExportType: 'selected-pitches'` | 報告標「UI extension」，待 feature 補對應 Scenario，不視為孤兒 |

#### 偵測指令範例

```bash
# 從 feature 抽 Command 名稱
grep -oE "sends [A-Z][A-Za-z]+" spec/gherkin-feature/*.feature | sort -u

# codebase 中的 Body / Event interface
grep -rE "export (interface|type) [A-Z][A-Za-z]*(Body|Event|Item|Detail)" app/types/api/

# 找差集（手動或腳本比對）
```

#### 輸出

填入步驟 8 的「🗑️ 孤兒清單」表格（見變更報告格式）。

### 步驟 8：產出變更報告

將分析結果寫入 **`spec/report/sync-report.md`**。

> 因為 `context: fork`，Phase 間無法共享對話記憶，所以必須持久化為檔案。後續 Phase 讀取此報告決定行為。

#### Phase 執行建議的強制規則

產出「Phase 執行建議」表格時，**必須依序檢查以下規則**：

| Phase | 條件 | 建議 |
|-------|------|------|
| Phase 1 | 型別變更或端點變更表格有任何「新增」或「修改」 | 執行 |
| Phase 2 | 設定檔變更偵測到 `theme.colors`、`project.*`、`meta.*`、`colorMode.*` 有變更 | 執行（否則跳過） |
| Phase 2 | 路由變更表格有任何「新增」 | 執行 |
| **Phase 3** | **路由變更表格有任何「新增」，或設定檔變更偵測到 `toast.*`、`responsive.sidebar.*` 有變更** | **執行** |
| Phase 4 | 新路由使用了尚未建立的共用元件，或設定檔變更偵測到 `table.*`、`delete.*` 有變更 | 執行（否則跳過） |
| Phase 5 | 頁面實作指令有任何 build/patch/rebuild | 執行 |

> **Phase 3 跟 Phase 2 的觸發條件相同**：有新路由 → 兩者都必須執行。Phase 2 建空殼頁面，Phase 3 把新路由加入 sidebar 導航。

格式見下方「變更報告格式」。

### 步驟 8.5：保留前版未解決孤兒（防止覆蓋丟失）

> **背景**：sync-report.md 每次重生會整檔覆蓋。若前一版列出的孤兒「實際仍存在於 codebase」但這次步驟 7.6 沒列出（如重跑時誤判、模式切換），會丟失資訊。本步驟做最後保險。

**作法**：

1. 寫入新版 sync-report.md 前，**讀取舊版**的「🗑️ 孤兒清單」段
2. 對舊版每一項：
   - 若 symbol / path 在 codebase 中**仍存在** → 強制保留進新版（即使步驟 7.6 沒重新偵測到）
   - 若已不存在 → 視為已清理，可從新版移除（但建議在報告底部「本次已清理孤兒」段記錄一行）
3. 若是從 OpenAPI 模式切到 Feature 模式（或反向），**舊版的「待 PM 處理」清單必須完整遞延**進新版孤兒/待處理段，不可整段消失

### 步驟 9：更新 route-map.yaml

- `version` 遞增（如 1 → 2）
- 新增的 feature → 加入對應路由的 features 陣列（或建立新路由條目）
- hash 變更的 feature → 更新 `content_hash`
- 刪除的 feature → **不自動移除**，僅在報告中標記待刪除
- **`api_contract.path_prefix` 維持步驟 2.5 結果**（使用者未確認 (a) 升版前，不可變動）
- **同步更新 `api_contract`**：新增/修改的型別 → 更新 `api_contract.types`（鏡像 `app/types/api/*.ts` 的欄位）；新增/修改的端點 → 更新 `api_contract.endpoints`（所有 `path:` 必以 `path_prefix` 開頭）
- **同步更新 `enabled_features`**：反映 PM yaml 最新的 `additionalFeatures`
- 更新 `generated_at` 為今天日期

### 步驟 10：詢問用戶確認

向用戶展示：
1. 變更報告摘要（Feature 變更總覽表格）
2. Phase 執行建議（哪些 Phase 需要跑、哪些可跳過）
3. 待刪除項目（提醒用戶手動處理）
4. **🗑️ 孤兒清單**（步驟 7.6 + 8.5 產出）——分 `UI` / `Backend` / `兼容` 三類明確標示
5. 更新後的 route-map.yaml 變更

**⚠️ 孤兒清單必須口頭強調**：不能只放進報告就算數。若 `UI` 類孤兒存在，必須在回應中明確提示「下一步：清除 UI 層孤兒 [列項目]」，否則 claude 容易跳過此步直接進 Phase 1。

確認後才寫入檔案。

---

## 變更報告格式（spec/report/sync-report.md）

```markdown
# Sync 變更報告

generated_at: YYYY-MM-DD
base_version: 1
sync_version: 2

## Path 前綴狀態

| 項目 | 值 | 備註 |
|------|-----|------|
| 既有 path_prefix | /api/v1 | 來自上一版 route-map.yaml |
| 本次偵測 | /api/v1 | 來自 servers.url 或 server/api/ 結構 |
| 結論 | 一致，沿用 | （或「使用者確認升版 /api/v1 → /api/v2，列入待批次調整」） |

## 設定檔變更

| 設定區塊 | 變更內容 | 影響 Phase |
|---------|---------|-----------|
| （若無變更則顯示「設定檔無變更」） | | |

## Feature 變更總覽

| Feature 檔 | 狀態 | 模式 | 影響頁面 | 說明 |
|------------|------|------|---------|------|
| 03-查詢球隊列表.dsl.feature | 無變化 | skip | — | hash 相同 |
| 04-建立球隊.dsl.feature | 修改 | patch | /teams | 新增 1 個欄位 |
| 12-新增教練.dsl.feature | 新增 | build | /coaches | 全新功能 |
| 05-刪除球隊.dsl.feature | 刪除 | — | /teams | feature 檔已不存在 |

## 型別變更

| 檔案 | 動作 | 詳細變更 |
|------|------|---------|
| app/types/api/teams.ts | 修改 | CreateTeamBody 新增 `description` 欄位 |
| app/types/api/coaches.ts | 新增 | CoachItem, CreateCoachBody |

## 端點變更

| 端點 | 動作 | 影響型別 | 影響頁面 |
|------|------|---------|---------|
| POST /api/teams | 修改 | CreateTeamBody | /teams |
| GET /api/coaches | 新增 | CoachItem[] | /coaches |
| POST /api/coaches | 新增 | CreateCoachBody | /coaches |

## 路由變更

| 路由 | 動作 | 頁面 | Features |
|------|------|------|---------|
| /coaches | 新增 | app/pages/coaches/index.vue | 12-新增教練 |

## 頁面實作指令

| 頁面 | 模式 | 變更的 Features | 說明 |
|------|------|----------------|------|
| /teams | patch | 04-建立球隊 | 新增欄位，Edit 受影響區塊 |
| /coaches | build | 12-新增教練 | 全新頁面 |
| /login | skip | — | 無變化 |

## Phase 執行建議

| Phase | 建議 | 原因 |
|-------|------|------|
| Phase 0 | 已完成 | 本次執行 |
| Phase 1 | 執行 | 有型別/端點新增或修改 |
| Phase 2 | 跳過 | 設定檔無變更（theme/project/meta/colorMode） |
| Phase 2 | 執行 | 有新增路由 |
| Phase 3 | 執行 | 有新增路由（需加入 sidebar 導航） |
| Phase 4 | 跳過 | 共用元件無變更 |
| Phase 5 | 執行 | 有 build/patch 頁面 |

## 待刪除項目（Phase 5 開始時確認後執行）

> Phase 5 增量模式會在最開始讀取此區塊，向用戶確認後再執行刪除。

| 類型 | 路徑 | 原因 |
|------|------|------|
| feature 參照 | route-map.yaml > /teams > 05-刪除球隊 | feature 檔已不存在 |
| 型別（待確認） | app/types/api/teams.ts > DeleteTeamBody | 若 05 是唯一使用者 |
| 端點（待確認） | DELETE /api/teams/[id] | 若 05 是唯一使用者 |

## 🗑️ 孤兒清單（codebase 有，feature 不再引用）

> 來源：步驟 7.6 反向 audit + 步驟 8.5 保留前版未解決項目。
> **每次 sync 都要重新評估，但已存在的項目不會被新 sync 覆蓋丟失**——只要 codebase 中還存在，就會繼續列出，直到實際清理為止。

| 類型 | 路徑 / symbol | feature 對應狀態 | 建議動作 | 負責方 |
|------|--------------|----------------|---------|--------|
| Type | `app/types/api/practice.ts > SwitchPitcherBody` | feature 已移除「切換投手」Feature（commit XXX）| 清除 interface + 所有 import | UI |
| Endpoint | `server/api/v1/practices/[practiceId]/pitcher.patch.ts` | 同上 | 刪除整檔 | Backend |
| UI 元素 | `app/pages/practice/[practiceId].vue` 切換投手按鈕、Modal、form、handler | 同上 | 移除 UI 區塊 | UI |

> **負責方分類**：
> - `UI`：claude 或前端工程師可直接清，主 spec 仍會綠
> - `Backend`：後端工程師處理，列入 task list（如 `task #N`）
> - `兼容`：刻意保留的過渡欄位，待 UI 收斂後拆除

## 本次已清理孤兒（自上次 sync 起）

| 路徑 / symbol | 清理 commit / 時間 |
|--------------|------------------|
| （無 / 上次列出已清掉的項目）| |
```

### 邊界情況處理

| 情況 | 處理方式 |
|------|---------|
| Scenario 邏輯變動但端點/欄位沒變 | content_hash 偵測到 feature 有改，標記為「修改」，Phase 5 patch |
| 多 feature 對應同一頁面，只有部分改 | patch 只改受影響的區塊，「頁面實作指令」列出變更的 Features |
| feature 改名（舊刪新增） | 報告同時列出刪除+新增，使用者確認時自行判斷 |
| route-map 手動加的路由（無 feature） | sync 不動此路由，不標記刪除 |
| Phase 1 改型別影響未標記的端點 | 修改型別後掃描所有 import 該型別的端點，補入報告 |
| 讀到舊格式 route-map（features 為字串陣列） | 視為無 hash，全部 feature 進入完整比對 |
