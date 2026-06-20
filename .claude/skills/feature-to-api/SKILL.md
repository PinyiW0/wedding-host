---
name: feature-to-api
description: 從 OpenAPI（spec/api/api-spec.yml）或 .feature 檔建立 API 合約型別、Mock 資料、Server 端點與前端 client 包裝層，產出永遠對齊 OpenAPI 慣例。Use when 需要建立或更新型別定義、Mock API、Client API 或 API 合約。
argument-hint: "[phase]"
context: fork
agent: general-purpose
---

# Feature to API 工作流程

> ✅ **輸出永遠對齊 OpenAPI 慣例**
> 不論輸入來源是 `spec/api/api-spec.yml`（優先）或 `.feature`（fallback），
> 產出的型別 / 端點 / mock 一律遵守以下慣例，未來補上 OpenAPI 也能 1:1 對接：
> - 欄位 **camelCase**（不再 snake_case）
> - mock 端點**直接回 schema 裸物件 / 陣列**（不包 `{ status, data, meta }`）
> - 錯誤透過 `createError({ statusCode, statusMessage })`，前端讀 `statusMessage`
> - 型別命名依語意分兩類：寫入端用 `XxxEvent`（如 `TeamCreatedEvent`），讀取端用 `XxxListItem` / `XxxDetail`
> - HTTP code 嚴格對齊：POST 201、軟刪除 204、查詢 200、業務衝突 409、資源不存在 404
> - 詳細規範見 **[references/openapi-conventions.md](references/openapi-conventions.md)**（必讀）

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

> **前置條件**：`.flow.md` 必須已放入 `spec/e2e-flows/`（外部產出）。

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
| `spec/api/api-spec.yml` **存在** | **OpenAPI 模式** | 以它為 SoT；types 1:1 對應 `components/schemas`、endpoints 1:1 對應 `paths`；`.feature` 僅供 BDD 測試比對 |
| 僅有 `.feature`（無 OpenAPI） | **Feature 推導模式** | 從 `.feature` 推欄位 + 端點；**輸出格式仍嚴格遵守 [openapi-conventions.md](references/openapi-conventions.md)**（camelCase、直接回 schema、Event/ListItem 命名等） |

> ⚠️ **永遠不要產出 snake_case 欄位或 `{ status, data }` 包裝**——即使在 Feature 推導模式下，產出格式也必須對齊 OpenAPI 慣例，這樣未來補上 `api-spec.yml` 是「換 SoT 不換格式」，差異最小。

## 全量模式 vs Sync 模式（疊在上述之上）

| 條件 | 模式 | 說明 |
|------|------|------|
| `spec/report/route-map.yaml` **不存在** | **全量模式** | 從零建立（首次使用） |
| `spec/report/route-map.yaml` **存在** | **Sync 模式** | 增量偵測來源變更，只更新受影響的部分 |

### Sync 模式運作方式

1. **Phase 0** 比對來源 hash（OpenAPI 模式：`api-spec.yml`；Feature 模式：`.dsl.feature`），產出 `spec/report/sync-report.md`（變更報告）
2. **Phase 1** 讀取此報告，只新增/修改受影響的型別和端點

---

## 現有 Feature 檔案

!`ls -1 spec/gherkin-feature/*.dsl.feature 2>/dev/null || echo "(無)"`

---

## Phase 概覽

| Phase | 名稱 | 輸出 | 必讀規範 |
|-------|------|------|----------|
| 0 | 準備工作 | 功能清單、路由規劃、**route-map.yaml**、**app/types/api/** | [phase-0-prep.md](references/phase-0-prep.md) |
| 1 | Mock API | server/mock/, server/api/ | [phase-1-mock-api.md](references/phase-1-mock-api.md) + [rules.md](references/rules.md) |
| 1.5 | Client API Layer | **app/api/*.api.ts**（typed client 包裝） | [phase-1-5-client-api.md](references/phase-1-5-client-api.md) |

---

## 必讀文件

### 核心規範

- **[openapi-conventions.md](references/openapi-conventions.md)** ⭐ - 輸出格式法典（命名、回應、錯誤、HTTP code），不論輸入來源都要遵守
- **[rules.md](references/rules.md)** - Server API 類型規範
- **[invariants.md](references/invariants.md)** - Business Invariant Constants 規範（UI / spec 共用的 typed 文字常數，強建議）
- **references/phase-N-*.md** - 各 Phase 的執行步驟與模板

### 輸入來源

- `spec/api/api-spec.yml`（OpenAPI 模式，若存在則為 SoT）
- `spec/gherkin-feature/*.feature`（Feature 推導模式 fallback；OpenAPI 模式時僅供 BDD 比對）

### 專案設定

- `spec/ui-config/ui-config-pm.yaml`（PM 設定，Phase 0 同步用）

---

## 自動執行規則

- 執行 `/feature-to-api`（無參數或參數為 `0`）時，**直接開始 Phase 0，不要詢問使用者任何問題**
- **來源判斷**：先檢查 `spec/api/api-spec.yml` 是否存在
  - 存在 → 進入 **OpenAPI 模式**（以 spec 為 SoT）
  - 不存在 → 進入 **Feature 推導模式**，並確認 `spec/e2e-flows/*.flow.md` 存在；若不存在則提示「請先將 `.flow.md` 放入 `spec/e2e-flows/`」
- **格式對齊**：兩種模式下，產出都必須遵守 [openapi-conventions.md](references/openapi-conventions.md)
- Phase 0 開始前，先讀取 `ui-config-pm.yaml`，按照 `phase-0-prep.md` 的「PM 設定同步邏輯」將資訊同步填入 `ui-config.yaml`
- 同步完成後直接執行 Phase 0 的步驟，不需額外確認

---

## 注意事項

- **每個 Phase 完成後，告知用戶下一步應執行的指令**
- **Phase 0 完成後提示：「下一步：`/feature-to-api 1`」**
- **Phase 1 完成後提示：「下一步：`/feature-to-api 1.5`」**
- **Phase 1.5 完成後提示：「下一步：`/test e2e`（偵測 E2E 狀態並產出執行計畫）」**
- Phase 0 建立 `app/types/api/` 合約型別，Phase 1 建立 mock data + server API，Phase 1.5 建立 `app/api/*.api.ts` client 包裝層
- 禁止自行決定設定，所有設定從 `ui-config.yaml` 讀取
- **⚠️ Phase 0 完成後若 `sync-report.md` 含「🗑️ 孤兒清單」段且有 `UI` 類項目**，必須在回應中明確列出每個 UI 孤兒並提示「下一步：清除 UI 層孤兒 [列項目]」，不可只說「報告產出，請看 sync-report.md」就跳到下一個 Phase。`Backend` 類孤兒則加進 task list（不阻塞）
- **模式切換時（OpenAPI ↔ Feature 推導）**：必須把前一個模式 sync-report 中的「待處理 / 待 PM 處理」項目完整遞延進新模式報告，不可整段消失（見 phase-0-sync.md 步驟 8.5）
