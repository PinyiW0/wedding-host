# Phase 0: 準備工作

## 必讀規範

```
所有模式必讀：
- ../references/openapi-conventions.md（輸出格式法典）
- spec/ui-config/ui-config-pm.yaml（PM 設定）

OpenAPI 模式必讀：
- spec/api/api-spec.yml（SoT）

Feature 推導模式必讀：
- spec/gherkin-feature/*.feature（所有 feature 檔）

Sync 模式額外讀取：
- spec/report/route-map.yaml（現有路由對照表）
- app/types/api/*.ts（現有型別定義，欄位級比對基準）
```

---

## 來源判斷（先做）

| 條件 | 模式 | 行為 |
|------|------|------|
| `spec/api/api-spec.yml` 存在 | **OpenAPI 模式** | 跳過 `.feature` 推導，直接 1:1 從 OpenAPI 派生 types + endpoints |
| 僅 `spec/gherkin-feature/*.feature` 存在 | **Feature 推導模式** | 從 `.feature` 推欄位 + 端點；輸出格式遵守 `openapi-conventions.md` |

## 模式判斷（疊在來源判斷之上）

Phase 0 再檢查 `spec/report/route-map.yaml`：

| 條件 | 模式 | 行為 |
|------|------|------|
| `route-map.yaml` **不存在** | **全量模式** | 執行下方「全量模式執行步驟」 |
| `route-map.yaml` **存在** | **Sync 模式** | 執行下方「Sync 模式步驟」（增量偵測 + 變更報告） |

---

## Path 前綴偵測（兩種模式皆執行，先做）

> **目的**：path 前綴（如 `/api/v1`、`/v1`、`/api`、空）由後端習慣決定，各專案不同。Phase 0 偵測一次後鎖定在 `route-map.yaml > api_contract.path_prefix`，**後續執行不重抽**，SoT 模式切換時（OpenAPI ↔ Feature 推導）也不變。詳細原則見 `openapi-conventions.md § 6.0 / 6.1`。

### 偵測流程（依序檢查，遇到即停止）

```
1. route-map.yaml > api_contract.path_prefix 存在？
     → 是 → 沿用此值，跳過偵測（鎖定原則）
     → 否 → 繼續

2. spec/api/api-spec.yml 存在？
     → 是 → 讀 servers.url，取 path 段（去掉 protocol+host+port）
            例：servers.url = "https://api.example.com/v1" → path_prefix = "/v1"
            例：servers.url = "/api/v1"                    → path_prefix = "/api/v1"
            寫入 route-map.yaml，停止
     → 否 → 繼續

3. server/api/ 目錄存在且非空？
     → 是 → 掃描所有 endpoint 檔，取最長共同前綴
            例：server/api/v1/teams/, server/api/v1/cameras/ → path_prefix = "/api/v1"
            例：server/api/teams/, server/api/auth/         → path_prefix = "/api"
            寫入 route-map.yaml，停止
     → 否 → 繼續

4. 完全空專案（無 spec 也無既有 endpoint）
     → 停下來詢問使用者：「請指定 API path 前綴（例：/api/v1、/v1、/api、空字串）」
     → 不要默默猜
```

### 偵測完寫入 route-map.yaml

```yaml
api_contract:
  path_prefix: /api/v1  # 由 Phase 0 偵測產生，各專案不同；後續執行不重抽
  ...
```

> ⚠️ **產出永遠是相對 path**：若偵測來源含絕對 URL（如 `https://host/v1`），只取 path 段（`/v1`），host / port / protocol 全部丟棄。Domain 由 env (`NUXT_PUBLIC_API_BASE`) 在 runtime 注入。

---

## OpenAPI 模式執行步驟（api-spec.yml 存在時）

1. **讀取 PM 設定**（同下方全量模式步驟 1）
2. **讀取 OpenAPI**：`spec/api/api-spec.yml`
3. **派生 types**：每個 `components/schemas/*` → 對應 TS interface
   - 依語意分組到 `app/types/api/{resource}.ts`（一個資源一檔）
   - 同資源的 `XxxCreatedEvent` / `XxxListItem` / `XxxBody` 放同檔
   - 命名、null、enum 處理嚴格遵守 `openapi-conventions.md` § 2
   - 建立 `app/types/api/index.ts` 統一 re-export
4. **派生端點規格**：每個 `paths/*/{method}` → `endpoints` 條目
   - 路徑、method、request/response schema 引用全照抄
   - 不要自加分頁（除非 spec 有 `parameters`）
   - 不要改 method（如 spec 寫 `PATCH /practices/{id}/pitcher` 就照 spec）
5. **產生 route-map.yaml**：
   - 寫入 `api_contract.path_prefix`（來自上方「Path 前綴偵測」結果，**所有 endpoint 路徑都以此前綴開頭**）
   - 寫入 `api_contract.response_conventions`：
   ```yaml
   response_conventions:
     list: 'T[]（直接回陣列，不包裝）'
     single: T（直接回物件，不包裝）
     action: XxxEvent（POST 201；軟刪除 204 無 body）
     error: 'throw createError({ statusCode, statusMessage })'
   ```
6. **產出前自檢**：
   - □ `api_contract.path_prefix` 已寫入（值來自「Path 前綴偵測」）
   - □ 所有 `endpoints[*].path` 都以 `path_prefix` 開頭，且為相對 path（無 `http://` / host）
   - □ types 數量與 `components/schemas` 一致
   - □ endpoints 數量與 `paths` 一致（method 維度）
   - □ 全欄位 camelCase
   - □ 無 `{ status, data }` 包裝
   - □ HTTP code 對齊 spec
7. **詢問用戶確認**

---

## Feature 推導模式注意事項

走下方「全量模式執行步驟」，但有三個必改：

- **欄位命名 camelCase**（不再 snake_case）
- **型別命名分 Event / ListItem / Body / Detail**（見 `openapi-conventions.md` § 1）
- **mock 端點直接回 schema**（不包 `{ status, data }`；Phase 1 負責，這邊先在 `route-map.yaml > response_conventions` 標明「裸物件 / 陣列」）

---

## 全量模式執行步驟

1. **讀取 PM 設定**
   - 讀取 `ui-config-pm.yaml`
   - 同步到 `ui-config.yaml`（參考下方同步邏輯）
   - 記錄 `additionalFeatures` 中值為 `true` 的項目（後續步驟 6 寫入 route-map）

2. **掃描所有 .feature 檔**
   - 路徑：`spec/gherkin-feature/*.dsl.feature`
   - ⚠️ **必須讀取全部檔案**

3. **產出功能清單**（見下方格式）

4. **產出路由規劃**（見下方格式）

5. **建立 API 合約型別**（直接寫入 `app/types/api/*.ts`）
   - 根據 feature 分析結果，直接建立 TypeScript 型別定義檔
   - 每個資源一個檔案（如 `teams.ts`、`auth.ts`）
   - 建立 `index.ts` 統一 re-export
   - ⚠️ **欄位命名使用 `camelCase`**（對齊 OpenAPI 慣例，未來與 `api-spec.yml` 無痛對接；不再用 snake_case）
   - ⚠️ **型別命名分 Event / ListItem / Body / Detail**，見 `openapi-conventions.md` § 1
   - ⚠️ 日期欄位使用 `string`（JSON 不支援 `Date`）
   - ⚠️ **必須建在 `app/types/api/`**，Nuxt 4 的 `~` 別名解析到 `app/`
   - 見下方「API 合約型別範例」

6. **產生路由對照表**（`spec/report/route-map.yaml`）
   - 根據步驟 3-5 的分析結果，自動產生路由對照檔
   - 此檔案是後續所有 Phase 及 **update 迭代的唯一參照來源**
   - ⚠️ **`api_contract` 區塊**：包含 `path_prefix`（路徑前綴，由「Path 前綴偵測」決定）、`types`（型別欄位快照，作為 Sync diff 基準；程式碼 SSoT 仍是 `app/types/api/*.ts`）和 `endpoints`（端點規格，所有 `path:` 必以 `path_prefix` 開頭）
   - 見下方「路由對照表格式」

7. **產出前自檢**（寫入檔案前逐項確認）
   - □ `/` 根路由存在（`navigateTo` 到第一個主要頁面）
   - □ 每個 `.dsl.feature` 都有對應的路由
   - □ `app/types/api/*.ts` 涵蓋所有端點的 Request/Response 型別
   - □ `api_contract.path_prefix` 已寫入（值來自「Path 前綴偵測」）
   - □ 所有 `api_contract.endpoints[*].path` 與各路由 `api_endpoints` 都以 `path_prefix` 開頭，無例外
   - □ 沒有絕對 URL（grep `https?://` 在所有產出檔應為 0）
   - □ `api_contract.types` 的欄位與 `app/types/api/*.ts` 的 export interface 一一對應
   - □ `api_contract.endpoints` 與各路由的 `api_endpoints` 一致
   - □ `enabled_features` 反映 PM yaml 的 `additionalFeatures`（有啟用的功能才寫入）
   - □ 啟用功能的頁面已標註 `features_used`

7.6. **孤兒偵測（反向 audit）** ⚠️ 必跑

   全量模式通常用於首次設定（codebase 空），但若在已有 codebase 的情況下跑全量（如重置 route-map 後重建），仍需執行孤兒偵測。

   流程與輸出見 [phase-0-sync.md 步驟 7.6](phase-0-sync.md#步驟-76孤兒偵測反向-audit-必跑)。產出寫入新 `sync-report.md`（或全量模式下的 `initial-report.md`）的「🗑️ 孤兒清單」段。

8. **詢問用戶確認**（含路由對照表內容 + 孤兒清單若有）

---

## PM 設定同步邏輯

| PM 設定欄位 | ui-config.yaml 欄位 | 轉換規則 |
|------------|---------------------|----------|
| `project.*` | `project.*` | 直接複製 |
| `meta.*` | `meta.*` | 直接複製 |
| `theme.colors.*` | `theme.colors.*` | 非空值覆蓋預設，空值 fallback 到 Tailwind 內建色 |
| `colorMode.*` | `colorMode.*` | 直接複製 |
| `toast.displaySeconds` | `toast.duration` | 秒 → 毫秒 (×1000) |
| `toast.position` | `toast.position` | 中文轉英文（右上角→top-right 等） |
| `table.*` | `table.*` | 直接複製（結構已對齊） |
| `delete.*` | `delete.*` | 直接複製（結構已對齊） |
| `testAccounts` | `testAccounts` | 直接複製 |
| `additionalFeatures.*`（boolean） | `additionalFeatures.*.required` | `true` → `true`，`false` → `false` |

---

## 輸出格式：功能清單

```markdown
## 功能清單

### 認證相關
- [ ] 登入頁面 (01-使用者登入.dsl.feature)
- [ ] 登出功能 (02-使用者登出.dsl.feature)

### 球隊管理
- [ ] 球隊列表 (03-查詢球隊列表.dsl.feature)
- [ ] 建立球隊 (04-建立球隊.dsl.feature)

### 資料模型
| 實體 | 欄位 | 來源 |
|------|------|------|
| User | account, role, status | 01-使用者登入 |
| Team | id, name, playerCount | 03-查詢球隊列表 |

### API 端點規劃
> ⚠️ 路徑以本專案偵測到的 `path_prefix` 為前綴；下例假設 `/api/v1`

| 端點 | 方法 | 用途 | 來源 |
|------|------|------|------|
| /api/v1/auth/login | POST | 登入 | 01 |
| /api/v1/teams | GET | 球隊列表 | 03 |
```

---

## 輸出格式：路由規劃

```markdown
## 路由規劃

| 路由 | 頁面 | Layout | 功能來源 |
|------|------|--------|----------|
| /login | login.vue | auth | 01-使用者登入 |
| / | index.vue | default | 首頁/Dashboard |
| /teams | teams/index.vue | default | 03-查詢球隊列表 |
```

---

## API 合約型別範例

Phase 0 直接建立 `app/types/api/*.ts`，消除 YAML → TypeScript 翻譯誤差。

### 型別檔案結構

```
app/types/api/
├── index.ts     # 統一 re-export
├── auth.ts      # LoginData
├── teams.ts     # TeamItem, CreateTeamBody
└── players.ts   # PlayerItem, CreatePlayerBody
```

### 型別檔範例

```typescript
// app/types/api/teams.ts
export interface TeamListItem {
  teamId: string // uuid
  teamName: string
  playerCount: number
}

export interface TeamCreatedEvent {
  teamId: string
  teamName: string
}

export interface CreateTeamBody {
  teamName: string
}
```

```typescript
// app/types/api/index.ts — 統一 re-export
export type { CoachLoggedInEvent, LoginBody } from './auth'
export type { CreateTeamBody, TeamCreatedEvent, TeamListItem } from './teams'
```

> ⚠️ **命名慣例**：欄位 `camelCase`、型別 `PascalCase`、UUID 用 `string`、日期用 `string`
>
> ⚠️ **型別命名規則**（見 `openapi-conventions.md` § 1）：
> - 寫入動作回應 → `XxxEvent`（過去式動詞）
> - 列表 view → `XxxListItem`
> - Request body → `XxxBody`
>
> ⚠️ 此型別是前端自定義的合約，未來 `api-spec.yml` 到位後只需逐欄對齊 schema。

---

## 路由對照表格式（route-map.yaml）

用戶確認後，將此對照表寫入 `spec/report/route-map.yaml`。此檔案是後續 Phase 2-5 及 **update 迭代的唯一參照來源**。

```yaml
# spec/report/route-map.yaml
# 由 /feature-to-ui Phase 0 自動產生
# ⚠️ 可手動修改，修改後以此為準

generated_at: 2026-01-20
version: 1

# PM 啟用的額外功能（來自 ui-config-pm.yaml > additionalFeatures）
# 只列出值為 true 的項目；全部 false 時省略此區塊
# Phase 4 據此建立對應元件，Phase 5 據此在頁面中使用
# 各功能的實作規範 → 見 features.md
enabled_features:
  - charts # 統計圖表
  - dragAndDrop # 拖曳排序

# API 合約規格
api_contract:
  # API path 前綴（由 Phase 0「Path 前綴偵測」產生，各專案不同）
  # - 普世原則：產出永遠是相對 path；domain 由 env (NUXT_PUBLIC_API_BASE) runtime 注入
  # - 範例：/api/v1、/v1、/api、/api/v2024-01、'' (空字串皆合法)
  # - 鎖定原則：一旦寫入，後續執行不重抽；SoT 模式切換時不變
  path_prefix: /api/v1

  # 回傳格式慣例（對齊 OpenAPI，不包裝）
  response_conventions:
    list: 'T[]（直接回陣列，不包裝）'
    single: T（直接回物件，不包裝）
    action: XxxEvent（POST 201；軟刪除 204 無 body）
    error: 'throw createError({ statusCode, statusMessage })'

  # 型別欄位快照（鏡像 app/types/api/*.ts，作為 Sync diff 基準）
  # 程式碼層面的 SSoT 仍是 app/types/api/*.ts
  # 手動修改只改 *.ts，此區塊由 Phase 0 自動同步覆蓋
  types:
    TeamListItem:
      file: teams.ts
      fields:
        teamId: string
        teamName: string
        playerCount: number
    TeamCreatedEvent:
      file: teams.ts
      fields:
        teamId: string
        teamName: string
    CreateTeamBody:
      file: teams.ts
      fields:
        teamName: string

  # 端點規格（方法 + 路徑 + Request/Response 型別名引用）
  # ⚠️ 以下 path 假設 path_prefix = "/api/v1"，實際以本檔上方 path_prefix 為準
  # 所有 path 必以 path_prefix 開頭；不得寫絕對 URL
  # ⚠️ Phase 1.5 會依 method + path 推導 client function name（如 GET /teams → listTeams，
  #    POST /practices/{id}/end → endPractice），命名規則見 phase-1-5-client-api.md
  endpoints:
    - method: POST
      path: /api/v1/auth/login
      request: LoginBody
      response: CoachLoggedInEvent
    - method: GET
      path: /api/v1/teams
      request: '{}'
      response: 'TeamListItem[]'
    - method: POST
      path: /api/v1/teams
      request: CreateTeamBody
      response: TeamCreatedEvent

routes:
  - path: /login
    page: app/pages/login.vue
    layout: auth
    features:
      - file: 01-使用者登入.dsl.feature
        content_hash: a1b2c3d4
    api_endpoints:
      - POST /api/auth/login
    components: []
    store: auth

  - path: /teams
    page: app/pages/teams/index.vue
    layout: default
    features:
      - file: 03-查詢球隊列表.dsl.feature
        content_hash: e5f6g7h8
      - file: 04-建立球隊.dsl.feature
        content_hash: i9j0k1l2
    api_endpoints:
      - GET /api/teams
      - POST /api/teams
    components:
      - PageHeader
      - ListContainer
      - ConfirmModal
    store: null
    features_used: [] # 此頁面使用的 additionalFeature（空則省略或留空陣列）

  # 範例：使用 additionalFeature 的頁面
  # - path: "/analytics/[id]"
  #   features_used: [charts]   # Phase 5 據此引用圖表元件
```

### 欄位說明

| 欄位 | 說明 |
|------|------|
| `enabled_features` | PM 啟用的額外功能清單（來自 `additionalFeatures`，Phase 4/5 消費，見 `features.md`） |
| `api_contract` | API 合約規格 |
| `api_contract.path_prefix` | API path 前綴（Phase 0 偵測產生，鎖定後不重抽；所有 endpoint `path:` 必以此開頭） |
| `api_contract.response_conventions` | 回傳格式慣例 |
| `api_contract.types` | 型別欄位快照（鏡像 `app/types/api/*.ts`，Sync diff 基準；手動修改只改 `*.ts`，此區塊由 Phase 0 自動覆蓋） |
| `api_contract.endpoints` | 端點規格（方法 + 路徑 + Request/Response 型別引用） |
| `path` | 路由路徑 |
| `page` | 頁面檔案路徑（相對於專案根目錄） |
| `layout` | 使用的 Layout 名稱 |
| `features` | 對應的 .feature 檔案（物件陣列，含 `file` 和 `content_hash`） |
| `api_endpoints` | 會呼叫的 API 端點列表（引用 `api_contract.endpoints` 的路徑） |
| `components` | 使用的共用元件 |
| `store` | 使用的 Pinia store（null 表示不使用） |
| `features_used` | 此頁面使用的 `enabled_features` 項目（Phase 5 據此引用對應元件） |

### 推導規則

| Feature 類型 | 路由推導 | 說明 |
|-------------|---------|------|
| （無 feature 對應） | `/` → `index.vue` | **必建**：根路由，Phase 2 放空殼，Phase 5 填入 `navigateTo` |
| `使用者登入` / `使用者登出` | `/login` | 認證類功能合併到登入頁 |
| `查詢 XXX 列表` | `/xxx` (複數) | 列表頁 |
| `建立 XXX` / `編輯 XXX` / `刪除 XXX` | 同列表頁 | CRUD 合併到同一個列表頁 |
| `查看 XXX 詳情` | `/xxx/[id]` | 詳情頁 |
| `XXX 的子功能` | `/xxx/[id]/yyy` | 巢狀路由 |

> ⚠️ **根路由必建**：即使沒有 feature 對應 `/`，route-map.yaml 也必須包含 `/` 路由。Phase 2 建空殼，Phase 5 填入 client-side redirect。**禁止使用 `redirectCode`（HTTP redirect 會被瀏覽器快取，影響同 port 的其他專案）**，改用 `if (import.meta.client) { await navigateTo('/xxx', { replace: true }) }`。

> ⚠️ **一個頁面可對應多個 feature**：例如球隊列表頁同時處理「查詢」「建立」「編輯」「刪除」四個 feature。
>
> ⚠️ **Phase 2 必須讀取此檔案**：建立頁面骨架時，以 route-map.yaml 為準。
>
> ⚠️ **Phase 5 必須讀取此檔案**：實作頁面時，根據 features 欄位確認要實作哪些功能。

### features 格式說明

features 欄位使用物件陣列，每個物件包含 `file`（檔名）和 `content_hash`（內容雜湊）：

```yaml
features:
  - file: 03-查詢球隊列表.dsl.feature
    content_hash: a1b2c3d4
```

- `content_hash` 使用 `shasum -a 256` 計算 feature 檔案內容
- Sync 模式用此 hash 判斷 feature 是否有變更
- **向下相容**：讀到舊格式（字串陣列）→ 視為無 hash，全部標記為需要比對

計算方式（shell，統一使用 `shasum -a 256`，macOS/Linux 皆內建）：
```bash
shasum -a 256 spec/gherkin-feature/03-查詢球隊列表.dsl.feature | awk '{print $1}'
```

---

## Sync 模式步驟

Sync 模式的完整步驟（步驟 1-10）、變更報告格式、邊界情況處理 → 詳見 [phase-0-sync.md](phase-0-sync.md)
