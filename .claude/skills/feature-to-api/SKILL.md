---
name: feature-to-api
description: 從 OpenAPI（spec/api/api-spec.yml）或 .feature 檔建立 API 合約型別、Mock 資料、Server 端點與前端 client 包裝層，產出永遠對齊 OpenAPI 慣例。Use when 需要建立或更新型別定義、Mock API、Client API 或 API 合約，或後端給了新版 api-spec 要同步（sync）。
argument-hint: "[phase]"
context: fork
agent: general-purpose
model: sonnet
---

# Feature to API 工作流程

> ✅ **輸出永遠對齊 OpenAPI 慣例**——不論輸入來源是 `spec/api/api-spec.yml`（優先）或 `.feature`（fallback），未來補上 OpenAPI 也能 1:1 對接。
> 格式法典（camelCase、回應模式、錯誤格式、型別命名、HTTP code）見 **[references/openapi-conventions.md](references/openapi-conventions.md)**（必讀）。
> 最容易踩的雷：自創 `{ status, data }` 第三種包裝——回應信封只有 §3 的模式 A（envelope）／模式 B（裸回）。

從 **OpenAPI 規格**（優先）或 `.feature` 規格檔建立 API 合約基礎設施：型別定義、Mock 資料、API 端點。

## 定位

API 合約是整個 TDD 流程的**基礎建設**，spec 生成和 UI 實作都依賴它：

```
.feature + .flow.md（雙輸入）
    ↓
/feature-to-api → types + mock data（資料值對齊 flow）+ API endpoints
    ↓                     ↓
/test e2e spec       /feature-to-ui
（生成測試合約）      （實作 UI）
```

> **前置條件**：`.flow.md` 必須已放入 `spec/e2e-flows/`（由 `/feature-to-flow` 產出）——**兩種輸入模式的 Phase 1 都會讀取**（mock 實體名稱與數值須對齊 flow）；僅跑 Phase 0 時可暫缺。

## 使用方式

```bash
/feature-to-api              # 從 Phase 0 開始（全量或 Sync）
/feature-to-api 0            # Phase 0: 準備工作（分析 feature、產出型別 + route-map）
/feature-to-api 1            # Phase 1: Mock API（mock data + API 端點）
/feature-to-api 1.5          # Phase 1.5: Client API Layer（app/api/*.api.ts 包裝層）
```

## 輸入來源優先級（兩路並存）

Phase 0 開始前先判斷：

| 條件 | 模式 | 行為 |
|------|------|------|
| `spec/api/api-spec.yml` **存在** | **OpenAPI 模式** | 以它為 SoT；`npm run gen:api` 產底層 `_schema.d.ts`、view 型別 alias 疊其上（見 [openapi-codegen.md](references/openapi-codegen.md)）、endpoints 1:1 對應 `paths`；`.feature` 僅供 BDD 測試比對 |
| 僅有 `.feature`（無 OpenAPI） | **Feature 推導模式** | 從 `.feature` 推欄位 + 端點；**輸出格式仍嚴格遵守 [openapi-conventions.md](references/openapi-conventions.md)**（camelCase、§3 回應模式、Event/ListItem 命名等） |

> ⚠️ **永遠不要產出 snake_case 欄位**（OpenAPI 模式由 codegen 忠實鏡像的欄位除外，見 openapi-conventions.md §1）——即使在 Feature 推導模式下，產出格式也必須對齊 OpenAPI 慣例（含開頭摘要的包裝紅線），這樣未來補上 `api-spec.yml` 是「換 SoT 不換格式」，差異最小。

## 全量模式 vs Sync 模式（疊在上述之上）

| 條件 | 模式 | 說明 |
|------|------|------|
| `spec/report/route-map.yaml` **不存在** | **全量模式** | 從零建立（首次使用） |
| `spec/report/route-map.yaml` **存在** | **Sync 模式** | 增量偵測來源變更，只更新受影響的部分 |

### Sync 模式運作方式

1. **Phase 0** 比對來源（OpenAPI 模式：spec `paths` 與 route-map 端點的差集，加上 codegen 重生後 `typelint` 的紅燈；Feature 模式：`*.feature` 的 `content_hash`），產出 `spec/report/sync-report.md`（變更報告）
2. **Phase 1** 讀取此報告，只新增/修改受影響的型別和端點

---

## 現有 Feature 檔案

!`ls -1 spec/gherkin-feature/*.feature 2>/dev/null || echo "(無)"`

---

## Phase 概覽

| Phase | 名稱 | 輸出 | 必讀規範 |
|-------|------|------|----------|
| 0 | 準備工作 | 功能清單、路由規劃、**route-map.yaml**、**app/types/api/** | [phase-0-prep.md](references/phase-0-prep.md) |
| 1 | Mock API | server/mock/, server/api/, `app/constants/invariants.ts`（滿足 [invariants.md](references/invariants.md) 適用條件時） | [phase-1-mock-api.md](references/phase-1-mock-api.md) + [rules.md](references/rules.md) + `.claude/rules/server-security.md`（rbac 命中時加 [rbac-scaffold.md](references/rbac-scaffold.md)；auth 命中時加 [auth-scaffold.md](references/auth-scaffold.md) 的 server 端檔） |
| 1.5 | Client API Layer | **app/api/*.api.ts**（typed client 包裝）；auth 命中時加 auth store 等前端檔 | [phase-1-5-client-api.md](references/phase-1-5-client-api.md)（auth 命中時加 [auth-scaffold.md](references/auth-scaffold.md) §3a） |

---

## 必讀文件

### 核心規範

- **[openapi-conventions.md](references/openapi-conventions.md)** ⭐ - 輸出格式法典（命名、回應、錯誤、HTTP code），不論輸入來源都要遵守
- **[openapi-codegen.md](references/openapi-codegen.md)** - OpenAPI 模式專用：`gen:api` 工具鏈 + view 型別 alias + 合約測試 + Sync 重生 loop（Feature 推導模式不適用）
- **[auth-scaffold.md](references/auth-scaffold.md)** - 條件式登入守門（偵測到登入主體才套用；SSOT + API 層範本內嵌，UI 層範本在 feature-to-ui；含防導向迴圈六道）
- **[rbac-scaffold.md](references/rbac-scaffold.md)** - 條件式角色守門（偵測到角色分層才套用；`auth-context.ts` 的 `requireAuth`／`requireRole`／`requireOwnership` 範本在此）
- **[rules.md](references/rules.md)** - Server API 類型規範
- **paths 規則要主動讀** ⭐——本 skill 跑在 fork context（空白對話分身），paths 規則不會自動注入：
  - `.claude/rules/server-security.md`：Phase 1 產端點前必讀（巢狀過濾／禁 spread body／輸入驗證／投影分級）
  - `.claude/rules/frontend-security.md`、`.claude/rules/framework-skills.md`：auth 命中、寫 `app/stores`／`app/composables`／`nuxt.config.ts` 前必讀
  - 每個 Phase 結束前跑 `npm run eslint` + `npm run typelint`（`.claude/rules/code-quality.md`）
- **[invariants.md](references/invariants.md)** - Business Invariant Constants 規範（UI / spec 共用的 typed 文字常數，強建議）
- **references/phase-N-*.md** - 各 Phase 的執行步驟與模板

### 輸入來源

- `spec/api/api-spec.yml`（OpenAPI 模式，若存在則為 SoT）
- `spec/gherkin-feature/*.feature`（Feature 推導模式 fallback；OpenAPI 模式時僅供 BDD 比對）

### 專案設定

- `spec/ui-config/ui-config-pm.yaml`（PM 設定，Phase 0 同步用）

---

## 自動執行規則

- 執行 `/feature-to-api`（無參數或參數為 `0`）時，**直接開始 Phase 0，不要在開工前詢問任何前置問題**
- **Phase 0 結束時回報並結束，不自動進 Phase 1**。OpenAPI／全量模式依 [phase-0-prep.md](references/phase-0-prep.md)「輸出格式：路由規劃」回報路由對照表（含孤兒清單，若有）；Sync 模式依 [phase-0-sync.md](references/phase-0-sync.md) 步驟 10 回報變更報告
- **來源判斷**：先檢查 `spec/api/api-spec.yml` 是否存在
  - 存在 → 進入 **OpenAPI 模式**（以 spec 為 SoT）
  - 不存在 → 進入 **Feature 推導模式**
  - **兩種模式進 Phase 1 前都須確認 `spec/e2e-flows/*.flow.md` 存在**（Phase 1 讀 flow 對齊 mock 資料值）；不存在則提示「請先執行 `/feature-to-flow`」
- **格式對齊**：兩種模式下，產出都必須遵守 [openapi-conventions.md](references/openapi-conventions.md)
- Phase 0 開始前，先讀取 `spec/ui-config/ui-config-pm.yaml`，按照 [phase-0-prep.md](references/phase-0-prep.md) 的「PM 設定同步邏輯」將資訊同步填入 `spec/ui-config/ui-config.yaml`
- **PM 設定同步完成後直接接續執行 Phase 0 的步驟**

### 分身只做、不問（確認點改為事後改檔）

本 skill 以 `context: fork` 在空白對話分身裡執行。分身不能問使用者，也等不到回覆，所以每個 Phase 都是：直接寫檔 → 回報產出 → 結束。

- 使用者看完回報要調整時，直接改產出檔（`route-map.yaml`、`sync-report.md`、`initial-report.md`、`app/types/api/*.ts`），再執行下一個 Phase
- references 裡寫「停下來問使用者／操作者」的地方，一律改成：選最保守的做法（不改寫既有值、該項不產出），把待確認項目寫進報告，並在回報裡列出
- 登入、角色權限、個資欄位白名單這三類例外：保守做法是「照受保護產生，並在回報列為待確認」，不可以不產出——不產出守門等於不設防

---

## 注意事項

- **每個 Phase 完成後，告知使用者下一步應執行的指令**
- **Phase 0 完成後提示：「Phase 0 產出已寫入（OpenAPI／全量：路由對照表；Sync：變更報告）。要調整請直接改檔，確認後執行 `/feature-to-api 1`」**
- **Phase 1 完成後提示：「下一步：`/feature-to-api 1.5`」**
- **Phase 1.5 完成後提示：「下一步：`/test e2e`（偵測 E2E 狀態並產出執行計畫）」**
- Phase 0 建立 `app/types/api/` 合約型別，Phase 1 建立 mock data + server API（+ 條件式 `app/constants/invariants.ts`），Phase 1.5 建立 `app/api/*.api.ts` client 包裝層
- 禁止自行決定設定，所有設定從 `ui-config.yaml` 讀取
- **⚠️ Phase 0 完成後若 `sync-report.md`／`initial-report.md` 含「🗑️ 孤兒清單」段且有 `UI` 類項目**，必須在回應中明確列出每個 UI 孤兒並提示「下一步：清除 UI 層孤兒 [列項目]」，不可只說「報告產出，請看 sync-report.md」就跳到下一個 Phase。`Backend` 類孤兒則加進 task list（不阻塞）
- **模式切換時（OpenAPI ↔ Feature 推導）**：必須把前一個模式 sync-report 中的「待處理 / 待 PM 處理」項目完整遞延進新模式報告，不可整段消失（見 phase-0-sync.md 步驟 8.5）
