# Phase 0: Sync 模式步驟

> 僅當 `spec/report/route-map.yaml` 存在時進入此流程。
> 全量模式步驟 → 詳見 [phase-0-prep.md](phase-0-prep.md)

> **先正規化 spec 檔名**：後端更新常以別名（如底線版 `api_spec.yml`）置入；Sync 開始前同樣先做 phase-0-prep 的「定位並正規化 spec 檔名」（別名 → 連字號 canonical），否則下方 codegen 重生會「找不到來源」。

> **OpenAPI 模式 Sync（`spec/api/api-spec.yml` 存在）先做 codegen 重生**：
> `npm run gen:api` 重生 `app/types/api/_schema.d.ts`（決定性、與 spec 永遠同步）→ `npm run typelint`
> → breaking change 的 view alias / client / page 編譯紅燈 → 依紅燈逐點修 → 重跑到綠。
> codegen 只定位不改寫（要編譯器尖叫，別默默編過）。完整 loop 見 [openapi-codegen.md](openapi-codegen.md) § 6。
> 下方步驟 4 / 9 的「型別比對 / 更新」在 OpenAPI 模式即「比對重生後的 `_schema` 與既有 view alias」。

---

### 步驟 1：讀取 PM 設定 + 設定檔變更偵測

同全量模式，讀取 `ui-config-pm.yaml` 並同步到 `ui-config.yaml`。

同步完成後，比對同步前後的 `ui-config.yaml` 差異，記錄變更的設定區塊：

| 變更的設定區塊 | 要跑的指令 |
|--------------|-------------|
| `theme.colors` | `/feature-to-ui 1` |
| `project.*`（name, description, favicon） | `/feature-to-ui 1` |
| `meta.*`（keywords, author, og） | `/feature-to-ui 1` |
| `colorMode.*` | `/feature-to-ui 1` |
| `table.*` | `/feature-to-ui 4` |
| `delete.*` | `/feature-to-ui 4` |
| `toast.*` | `/feature-to-ui 3`（UApp toaster 設定） |
| `responsive.sidebar.*` | `/feature-to-ui 3` |

> 指令寫全名：feature-to-api 與 feature-to-ui 各有自己的 Phase 編號，只寫「Phase 1」分不出是哪一支。

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
   - **OpenAPI 模式**：依 [phase-0-prep.md](phase-0-prep.md)「Path 前綴偵測」步驟 2 的和解規則重算（`servers.url` 的 path 段 × `paths` 最長共同前綴，含離群端點條款）；不可只讀 `servers.url`
   - **Feature 推導模式**：掃 `server/api/` 取最長共同前綴
3. 比對：

   | 情況 | 動作 |
   |------|------|
   | 既有 path_prefix **不存在**（舊版 route-map） | 寫入本次偵測值，sync-report 記錄「初始化 path_prefix = X」 |
   | 兩值相同 | 通過，繼續步驟 3 |
   | 兩值不同 | **維持既有值、不改寫**，sync-report「Path 前綴狀態」標 ⚠️ 待確認並附下方說明；使用者選 (a) 時手改 `route-map.yaml` 的 `path_prefix` 後重跑 Sync |

#### 不一致時寫進報告的說明

```
偵測到 API path 前綴漂移：
- route-map.yaml 既有：/api/v1
- 本次偵測（{OpenAPI servers.url / server/api/ 結構}）：/v1

可能原因：
  (a) 後端真的改了前綴（如 v1 → v2 升版） 
      → 我會更新 route-map.yaml + 列入 sync-report「待批次調整」（含 server/api/ 資料夾、app/api/ 引用）
  (b) spec / 程式碼狀態漂移（無心改動） 
      → 維持既有 path_prefix，提示你修正 spec 或還原誤改

目前維持既有值（等同 (b)）。若是 (a)，請改 route-map.yaml 的 path_prefix 後重跑 /feature-to-api。
```

#### 不要做的事

- ❌ 默默把 `route-map.yaml > path_prefix` 改成新值
- ❌ 默默把既有 endpoint 路徑全部改寫
- ❌ 把 host name 寫進 path_prefix（OpenAPI `servers.url` 含絕對 URL 時，**只取 path 段**）

### 步驟 3：掃描所有新版 .feature

- 路徑：`spec/gherkin-feature/*.feature`（含 `.dsl.feature` 變體）
- 計算每個檔案的 `content_hash`

### 步驟 3b：端點差集（OpenAPI 模式）

- 步驟 2 的前綴狀態是 ⚠️ 時，先把 spec 路徑的新前綴換成既有 `path_prefix` 再比；否則整批端點會同時被列成新增與刪除
- spec `paths` 的 method × path 與 `route-map.yaml > api_contract.endpoints` 取差集：spec 有、route-map 沒有 → 「新增」；route-map 有、spec 沒有 → 「刪除」
- 兩邊都有、但 request／response schema 引用變了 → 「修改」；codegen 重生後 `typelint` 紅燈的位置就是修改點
- 不影響型別的驗證限制變更（`maxLength`、`minimum`、`pattern`、`format` 等）typelint 抓不到：用 `git diff $(git log -1 --format=%H -- spec/report/route-map.yaml) -- spec/api/api-spec.yml` 比對上次 Sync 時的 spec 與現在的 spec（新 spec 已 commit 也比得到），被改到的 operation 與它引用的 schema 也列「修改」
- 結果寫入步驟 8 的「端點變更」表

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

> 下方 checklist 是判準起點，依序判定並在變更報告附上判定過程。#4 要判斷 Scenario 跟哪個欄位有關，屬語意判讀：模糊時寫出研判理由，並在報告標「待確認」。

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
        （如：「標題超過長度上限」對應新增的 title 欄位）
     b) 「新功能型」：無法對應到任何新增欄位
        （如：「搜尋筆記」「標籤篩選」「分頁」）

     → 存在任何「新功能型」Scenario → rebuild（停止）
     → 全部都是「欄位驗證型」→ patch（停止）

5. 以上皆否（僅措辭/數值微調、Background 資料微調）
     → patch
```

#### 判定結果記錄格式

在變更報告的「Feature 變更總覽」表格中，`說明` 欄須包含判定依據：

```markdown
| 04-建立筆記 | 修改 | patch | /notes | 新增 1 欄位(摘要) + 2 Scenario 皆為該欄位驗證 → checklist #4a → patch |
| 12-查詢筆記本列表 | 修改 | rebuild | /notebooks | 新增 6 Scenario 含搜尋/篩選/分頁(新功能型) → checklist #4b → rebuild |
```

> 判定依據是事後追溯的唯一線索，不可省略。

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

1. **抽取「合約 symbol 集」**（依模式換來源）：
   - **OpenAPI 模式**：spec `paths`（method × path）＋ `components.schemas` 名稱與其 view alias（如 `LoginResponse = TokenPairData`）；沒有 feature 對應的端點（health、資料上傳）照樣算合約
   - **Feature 推導模式**：從 DSL 抽（下列四條）
   - Commands：`When {Actor} sends {CommandName}` → `{CommandName}Body`
   - Events：`Then the {EventName} event is emitted` → `{EventName}Event`
   - Views：`When the {ViewName} view is queried` → `{ViewName}Item` / `{ViewName}Detail`
   - Operations failure：`Then the operation fails with: {message}` → error message 字串

2. **抽取 codebase 的「實作 symbol 集」**：
   - `app/types/api/*.ts` 的 `export interface` / `export type` 名稱
   - `server/api/` 下對應 `path_prefix` 的子目錄（如 `/api/v1` → `server/api/v1/**/*.ts`）的 endpoint 路由 + method（檔名 / HTTP verb）；`outside_prefix` 端點看 `server/routes/`
   - `app/**/*.vue`、`app/**/*.ts` 中 `from '~/types/api` 開頭的 import（含 `import type`、子路徑 `~/types/api/notes`）引用的 X 集合

3. **差集 = 孤兒**：
   - `type 孤兒` = codebase types ∖ feature contract types
   - `endpoint 孤兒` = codebase endpoints ∖ feature contract endpoints
   - `UI 孤兒` = 引用孤兒 type 的 .vue 檔（連帶相關 button / Modal / handler）

#### 不視為孤兒的例外（白名單）

| 例外類型 | 範例 | 處理 |
|---------|------|------|
| 過渡兼容欄位（feature 已遷移，server 為兼容 UI 保留） | `NoteHistoryItem.editedAt` 為兼容欄位 | type 加 `@deprecated` 註解，報告標「兼容」不視為孤兒 |
| 基礎設施路由 | `/api/__test__/reset`、`/api/health` | 跳過 |
| UI extension（feature 未定義但 UI 有額外需求） | `ExportType: 'selected-notes'` | 報告標「UI extension」，待 feature 補對應 Scenario，不視為孤兒 |

#### 偵測指令範例

```bash
# 從 feature 抽 Command 名稱
grep -oE "sends [A-Z][A-Za-z]+" spec/gherkin-feature/*.feature | sort -u

# codebase 中的 Body / Event interface
grep -rE "export (interface|type) [A-Z][A-Za-z]*(Body|Event|Item|Detail)" app/types/api/

# 誰引用了合約型別（含 import type、子路徑）
grep -rnE "from '~/types/api" app/

# 找差集（手動或腳本比對）
```

#### 輸出

填入步驟 8 的「🗑️ 孤兒清單」表格（見變更報告格式）。

### 步驟 7.7：重跑 auth／rbac 偵測（⚠️ 必跑）

- 照 [phase-0-prep.md](phase-0-prep.md)「Auth 偵測」「授權（RBAC）偵測」，用新版規格重跑一次，結果與 `route-map.yaml` 的 `auth`／`rbac` 區塊比對
- 新出現的守門規則（新的登入端點、新的角色限制端點、新角色）→ 步驟 9 寫進 `route-map.yaml`，報告標「新增 auth 守門」或「新增角色守門」（同 auth-scaffold.md §6、rbac-scaffold.md §5 的用詞）
- 被新守門命中的**既有端點**也列進步驟 8 的「端點變更」表、標「修改」，即使路徑與 schema 都沒變：新增 auth → 所有非公開端點；新增角色／歸屬規則 → 規則命中的端點。不列的話 Phase 1 增量模式不會碰它，端點仍是公開或未過濾
- 同一 method＋path 的權限**收緊**（`allow` 角色變少、新增 `restricted_roles`、公開端點改成要登入）→ 照新規格改掉原條目，該端點列「修改」。保留舊條目等於照舊放行
- 權限**放寬或整條守門被拿掉** → **不改**，報告列待確認（寧可多擋，不可漏擋；見 auth-scaffold.md §6、rbac-scaffold.md §5）

### 步驟 8：產出變更報告

先做步驟 8.5（讀取舊版報告、合併未解決的孤兒；模式切換時另遞延待 PM 處理清單），再把分析結果寫入 **`spec/report/sync-report.md`**。直接寫入會覆蓋舊版，舊版的孤兒清單就遺失了。

> 因為 `context: fork`，Phase 間無法共享對話記憶，所以必須持久化為檔案。後續 Phase 讀取此報告決定行為。

#### Phase 執行建議的強制規則

產出「Phase 執行建議」表格時，**必須依序檢查以下規則**：

| 指令 | 條件 | 建議 |
|-------|------|------|
| `/feature-to-api 1`、`/feature-to-api 1.5` | 型別變更或端點變更表格有任何「新增」或「修改」 | 執行 |
| `/feature-to-ui 1` | 設定檔變更偵測到 `theme.colors`、`project.*`、`meta.*`、`colorMode.*` 有變更 | 執行（否則跳過） |
| `/feature-to-ui 2` | 路由變更表格有任何「新增」 | 執行 |
| **`/feature-to-ui 3`** | **路由變更表格有任何「新增」，或設定檔變更偵測到 `toast.*`、`responsive.sidebar.*` 有變更** | **執行** |
| `/feature-to-ui 4` | 新路由使用了尚未建立的共用元件，或設定檔變更偵測到 `table.*`、`delete.*` 有變更 | 執行（否則跳過） |
| `/feature-to-ui 5` | 頁面實作指令有任何 build/patch/rebuild | 執行 |

> **`/feature-to-ui 3` 跟 `/feature-to-ui 2` 的觸發條件相同**：有新路由 → 兩者都必須執行。UI Phase 2 建空殼頁面，UI Phase 3 把新路由加入 sidebar 導航。

格式見下方「變更報告格式」。

### 步驟 8.5：保留前版未解決孤兒（防止覆蓋丟失）

> **背景**：sync-report.md 每次重生會整檔覆蓋。若前一版列出的孤兒「實際仍存在於 codebase」但這次步驟 7.6 沒列出（如重跑時誤判、模式切換），會丟失資訊。本步驟做最後保險。

**作法**：

1. 寫入新版 sync-report.md 前，**讀取舊版**的「🗑️ 孤兒清單」段
2. 對舊版每一項：
   - 若 symbol / path 在 codebase 中**仍存在** → 強制保留進新版（即使步驟 7.6 沒重新偵測到）
   - 若已不存在 → 視為已清理，可從新版移除（但建議在報告底部「本次已清理孤兒」段記錄一行）
3. 若是從 OpenAPI 模式切到 Feature 模式（或反向），**舊版的「待 PM 處理」清單必須完整遞延**進新版孤兒/待處理段，不可整段消失

### 步驟 9：更新 `spec/report/route-map.yaml`（直接寫入）

- `version` 遞增（如 1 → 2）
- 新增的 feature → 加入對應路由的 features 陣列（或建立新路由條目）
- hash 變更的 feature → 更新 `content_hash`
- 刪除的 feature → **不自動移除**，僅在報告中標記待刪除
- **`api_contract.path_prefix` 維持步驟 2.5 結果**（使用者未確認 (a) 升版前，不可變動）
- **同步更新 `api_contract`**：新增/修改的型別 → 更新 `api_contract.types`（鏡像 `app/types/api/*.ts` 的欄位）；新增/修改的端點 → 更新 `api_contract.endpoints`（`path:` 以 `path_prefix` 開頭。OpenAPI 模式下只有少數端點不在前綴底下時，照 phase-0-prep「Path 前綴偵測」的離群端點條款保留原始路徑並標 `outside_prefix: true`；步驟 2 的前綴狀態是 ⚠️ 時，先照步驟 3b 換成既有前綴，不標 `outside_prefix`）
- **同步更新 `enabled_features`**：反映 PM yaml 最新的 `additionalFeatures`
- **同步更新 `auth`／`rbac` 區塊**：照步驟 7.7 寫入新增守門與權限收緊；放寬或移除的規則不動
- 更新 `generated_at` 為今天日期

### 步驟 10：回報後結束

向使用者回報以下內容後結束（不自動進 Phase 1）。本 skill 在分身裡執行，等不到使用者回覆，所以步驟 10 只展示、不寫檔：
1. 變更報告摘要（Feature 變更總覽表格）
2. Phase 執行建議（哪些 Phase 需要跑、哪些可跳過）
3. 待刪除項目（提醒使用者手動處理）
4. **🗑️ 孤兒清單**（步驟 7.6 + 8.5 產出）——分 `UI` / `Backend` / `兼容` 三類明確標示
5. 更新後的 `spec/report/route-map.yaml` 變更
6. 步驟 7.7 的「新增 auth 守門」「新增角色守門」與待確認的 auth／rbac 孤兒

**⚠️ 孤兒清單必須在回報裡強調**：不能只放進報告就算數。若 `UI` 類孤兒存在，必須在回報中明確提示「下一步：清除 UI 層孤兒 [列項目]」，否則 claude 容易跳過此步直接進 Phase 1。

步驟 8、9 已把 `spec/report/sync-report.md` 與 `spec/report/route-map.yaml` 寫入磁碟。使用者要調整時，直接改這兩個檔，再執行 `/feature-to-api 1`。

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
| 本次偵測 | /api/v1 | 來自 prep 的和解規則（OpenAPI）或 server/api/ 結構（Feature） |
| 結論 | 一致，沿用 | （或「⚠️ 不一致，維持既有值待確認」／「使用者已改 route-map 升版 /api/v1 → /api/v2，列入待批次調整」） |

## 設定檔變更

| 設定區塊 | 變更內容 | 要跑的指令 |
|---------|---------|-----------|
| （若無變更則顯示「設定檔無變更」） | | |

## Feature 變更總覽

| Feature 檔 | 狀態 | 模式 | 影響頁面 | 說明 |
|------------|------|------|---------|------|
| 03-查詢筆記列表.dsl.feature | 無變化 | skip | — | hash 相同 |
| 04-建立筆記.dsl.feature | 修改 | patch | /notes | 新增 1 個欄位 |
| 12-新增成員.dsl.feature | 新增 | build | /members | 全新功能 |
| 05-刪除筆記.dsl.feature | 刪除 | — | /notes | feature 檔已不存在 |

## 型別變更

| 檔案 | 動作 | 詳細變更 |
|------|------|---------|
| app/types/api/notes.ts | 修改 | CreateNoteBody 新增 `summary` 欄位 |
| app/types/api/members.ts | 新增 | MemberItem, CreateMemberBody |

## 端點變更

| 端點 | 動作 | 影響型別 | 影響頁面 |
|------|------|---------|---------|
| POST /api/notes | 修改 | CreateNoteBody | /notes |
| GET /api/members | 新增 | MemberItem[] | /members |
| POST /api/members | 新增 | CreateMemberBody | /members |

## 路由變更

| 路由 | 動作 | 頁面 | Features |
|------|------|------|---------|
| /members | 新增 | app/pages/members/index.vue | 12-新增成員 |

## 頁面實作指令

| 頁面 | 模式 | 變更的 Features | 說明 |
|------|------|----------------|------|
| /notes | patch | 04-建立筆記 | 新增欄位，Edit 受影響區塊 |
| /members | build | 12-新增成員 | 全新頁面 |
| /login | skip | — | 無變化 |

## Phase 執行建議

| 指令 | 建議 | 原因 |
|-------|------|------|
| `/feature-to-api 0` | 已完成 | 本次執行 |
| `/feature-to-api 1`、`/feature-to-api 1.5` | 執行 | 有型別/端點新增或修改 |
| `/feature-to-ui 1` | 跳過 | 設定檔無變更（theme/project/meta/colorMode） |
| `/feature-to-ui 2` | 執行 | 有新增路由 |
| `/feature-to-ui 3` | 執行 | 有新增路由（需加入 sidebar 導航） |
| `/feature-to-ui 4` | 跳過 | 共用元件無變更 |
| `/feature-to-ui 5` | 執行 | 有 build/patch 頁面 |

## 待刪除項目（Phase 5 開始時確認後執行）

> Phase 5 增量模式會在最開始讀取此區塊，向用戶確認後再執行刪除。

| 類型 | 路徑 | 原因 |
|------|------|------|
| feature 參照 | route-map.yaml > /notes > 05-刪除筆記 | feature 檔已不存在 |
| 型別（待確認） | app/types/api/notes.ts > DeleteNoteBody | 若 05 是唯一使用者 |
| 端點（待確認） | DELETE /api/notes/[noteId] | 若 05 是唯一使用者 |

## 🗑️ 孤兒清單（codebase 有，feature 不再引用）

> 來源：步驟 7.6 反向 audit + 步驟 8.5 保留前版未解決項目。
> **每次 sync 都要重新評估，但已存在的項目不會被新 sync 覆蓋丟失**——只要 codebase 中還存在，就會繼續列出，直到實際清理為止。

| 類型 | 路徑 / symbol | feature 對應狀態 | 建議動作 | 負責方 |
|------|--------------|----------------|---------|--------|
| Type | `app/types/api/notebooks.ts > TransferNotebookBody` | feature 已移除「轉移筆記本擁有者」Feature（commit XXX）| 清除 interface + 所有 import | UI |
| Endpoint | `server/api/v1/notebooks/[notebookId]/owner.patch.ts` | 同上 | 刪除整檔 | Backend |
| UI 元素 | `app/pages/notebooks/[notebookId].vue` 轉移擁有者按鈕、Modal、form、handler | 同上 | 移除 UI 區塊 | UI |

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
