# OpenAPI 對齊慣例（輸出格式法典）

> 不論輸入來源是 `spec/api/api-spec.yml` 或 `spec/gherkin-feature/*.feature`，
> Phase 0 / 1 產出的 `app/types/api/*.ts`、`server/api/**/*.ts`、`server/mock/data/*.ts`
> 一律遵守本檔規範。
>
> 目標：未來補上 `api-spec.yml` 是「換 SoT 不換格式」，差異最小。

---

## 1. 命名規範

### 欄位名稱（property name）

| 規則 | 範例 |
|---|---|
| **欄位用 camelCase** | `accountId`、`siteName`、`newPassword`、`connectionStatus` |
| **絕不用 snake_case** | ❌ `account_id`、❌ `new_password` |
| **布林前綴用 `is` / `has`** | `isFavorited`、`hasPermission` |
| **時間欄位後綴 `At`** | `createdAt`、`startedAt`、`deletedAt` |
| **計數欄位後綴 `Count`** | `sightingCount`、`stationCount` |

> ⚠️ **codegen 例外（OpenAPI 模式）**：上述 camelCase 規則管的是「**手寫 / Feature 推導**的型別」。
> 由 `gen:api` 從 `api-spec.yml` **機器鏡像**的 `_schema.d.ts` 一律**忠實照 spec**，spec 是 snake_case
> （如裝置 ingestion 的 `raw_traj`、`sighting_traj_Xc0`）就照 snake_case——契約以後端為準，不可改寫，
> 改寫反而與真實後端漂移。view alias 直接沿用該欄名即可。詳見 [openapi-codegen.md](openapi-codegen.md) § 8。

### 型別名稱（interface name）

| 用途 | 命名規則 | 範例 |
|---|---|---|
| **寫入動作回應**（POST/PATCH/DELETE 的結果） | `XxxEvent`，動詞用過去式 | `SiteCreatedEvent`、`AccountPasswordChangedEvent`、`SightingFavoritedEvent` |
| **列表 view**（GET 列表的單筆 item） | `XxxListItem` | `SiteListItem`、`StationListItem`、`AccountListItem` |
| **詳情 view**（GET 單筆） | `XxxDetail` 或直接用實體名 | `WatchDetail` |
| **Request body** | `XxxBody` 或 `XxxRequest` | `CreateSiteBody`、`StartWatchBody` |
| **錯誤** | `ErrorResponse` | `ErrorResponse` |
| **enum 字串聯集** | TS literal union | `'connected' \| 'disconnected'` |

> ⚠️ 嚴禁用模糊命名（如 `SiteData`、`SiteInfo`）——區分是 event、view、body、detail 才能避免 schema 漂移。

---

## 2. Schema → TypeScript 對應

| OpenAPI | TypeScript |
|---|---|
| `type: string, format: uuid` | `string`（不要建 `UUID` 別名） |
| `type: string, format: date-time` | `string`（不要用 `Date`，JSON 不支援） |
| `type: string, enum: [a, b]` | `'a' \| 'b'` |
| `type: number` / `integer` | `number` |
| `type: boolean` | `boolean` |
| `nullable: true` | `string \| null`（聯集 null） |
| `required` 未列出的欄位 | `field?: T`（optional） |
| `type: array, items: $ref` | `T[]` |
| `$ref: '#/components/schemas/X'` | `X`（同檔 import） |

範例（OpenAPI → TS）：

```yaml
# OpenAPI
SiteCreatedEvent:
  type: object
  required: [siteId, siteName]
  properties:
    siteId: {type: string, format: uuid}
    siteName: {type: string}
```

```typescript
// TypeScript
export interface SiteCreatedEvent {
  siteId: string
  siteName: string
}
```

### 型別來源：手寫 interface vs codegen alias

上表的「OpenAPI → TypeScript」對應有兩種落地方式，依模式決定：

| 模式 | 底層型別 | view 型別 |
|------|---------|----------|
| **Feature 推導模式**（無 spec） | 無 | **手寫 interface**（依本節對應規則人工翻譯） |
| **OpenAPI 模式**（`spec/api/api-spec.yml` 存在） | `npm run gen:api` 產 `_schema.d.ts`（機器產、不漂移） | **手寫 alias** 疊在 `_schema` 上：`export type SiteListItem = components['schemas']['SiteListItem']` |

> 兩種模式的 **view 型別命名一致**（§ 1 的 Event / ListItem / Body / Detail），差別只在底層是「手抄」或「codegen」。
> OpenAPI 模式詳見 [openapi-codegen.md](openapi-codegen.md)（含 alias、合約測試、Sync 重生 loop）。

---

## 3. Response shape（mock 端點回傳）

回應外層分兩種模式，由 `runtimeConfig.public.apiEnvelope` 決定（預設 **envelope 模式**）。
**兩種模式下「型別」都不變**——view 型別永遠是 `data` 的裸 schema（`SiteListItem` / `SiteDetail` / `XxxEvent`），
因為 `useHttp` 在 envelope 模式會自動拆掉外層、回傳裸 data。差別只在「mock 端點要不要包」。

### 模式 A（預設）：Envelope —— 對齊團隊後端 `{ success, data, message, meta }`

mock 端點用 helper 包一層，回應 shape 與正式後端一致（`useHttp` 自動拆封，前端拿到裸 data）：

```typescript
// server/mock/envelope.ts —— envelope helper（envelope 模式產出）
export function ok<T>(data: T, message = '操作成功') {
  return { success: true, message, data }
}
export function page<T>(items: T[], pagination: { page: number, pageSize: number, totalItems: number, totalPages: number }) {
  return { success: true, data: { items }, meta: { pagination } }
}
```

```typescript
// GET 列表（無分頁）         return ok(mockSites)            // 前端拿到 SiteListItem[]
// GET 列表（分頁）           return page(items, pagination)  // useHttp 攤平成 SiteListItem[]，meta 存 response._meta
// GET 單筆                   return ok(site)                 // 前端拿到 SiteDetail
// POST 建立                  setResponseStatus(event, 201); return ok(createdEvent)
```

### 模式 B：裸 schema —— `apiEnvelope=false` 的後端

直接回 schema 裸物件 / 陣列（不包）：

```typescript
return mockSites      // → SiteListItem[]
return site           // → SiteDetail
return createdEvent   // → SiteCreatedEvent（POST 201）
```

> ⚠️ **絕不要自創第三種包裝**（如 `{ status, data, meta }`、snake_case 的 `page_size`）——
> 要嘛對齊後端 envelope（模式 A），要嘛裸回（模式 B）。`useHttp` 的拆封容忍裸回應（非 envelope 直通），
> 故模式 A 開著也不會弄壞偶爾裸回的端點，但**同一專案請固定一種**以免 shape 漂移。
> 判斷：`spec/api/api-spec.yml` 有 `SuccessEnvelope`/`success`+`data` 結構 → 模式 A；否則看 `apiEnvelope` 設定。

---

## 4. 錯誤格式

**前端一律用 `~/utils/api-error` 的 `readApiError(err, fallback)` 讀錯誤訊息**（同時容忍 envelope 與 createError 兩種來源），
不要自己 `e.statusMessage || ...` 散落各處：

```typescript
import { getErrorCode, readApiError } from '~/utils/api-error'

try {
  await useHttp().post('/auth/login', { body })
}
catch (e) {
  toast.error(readApiError(e, '登入失敗'))
  // 需對特定錯誤分支：if (getErrorCode(e) === 'ACCOUNT_LOCKED') { ... }
}
```

server / mock 端依模式拋錯：

- **模式 A（envelope）**：拋 `ErrorEnvelope` shape `{ success:false, code, message, errors? }`
  （`code` 用 CONSTANT_CASE；`errors` 為欄位層級驗證，供表單顯示）。

  ```typescript
  throw createError({ statusCode: 404, data: { success: false, code: 'ACCOUNT_NOT_FOUND', message: '帳號不存在' } })
  ```

- **模式 B（裸 schema）**：用 `createError({ statusCode, statusMessage })`，前端 `readApiError` 一樣讀得到。

  ```typescript
  throw createError({ statusCode: 409, statusMessage: '帳號名稱已存在' })
  ```

> `readApiError` 取值順序 `data.message → data.statusMessage → statusMessage → message → fallback`，兩種模式都涵蓋。
> 欄位錯誤用 `getFieldErrors(err)`，錯誤碼用 `getErrorCode(err)`。

---

## 5. HTTP Status Code

| 場景 | Code | 備註 |
|---|---|---|
| GET 成功 | 200 | |
| POST 建立 / 觸發動作（含 login / 收藏 / 結束觀測時段 / 匯出） | 201 | OpenAPI 明示 `'201'` 一律照辦 |
| PATCH 更新 | 200 | |
| DELETE 軟刪除 | 204 | **無 response body** |
| 驗證錯誤（refinement 違反） | 400 | |
| 未授權（無 token / token 失效） | 401 | |
| 權限不足 | 403 | 角色守門（`requireRole`）見 [rbac-scaffold.md](rbac-scaffold.md) |
| 資源不存在 | 404 | 含軟刪除後的查找 |
| 業務衝突（已收藏、已結束、唯一性衝突） | 409 | |

---

## 6. 路徑慣例

### 6.0 Domain / Path 分離原則（普世，所有專案適用）

> **產出永遠是相對 path，domain 由 env 注入**
>
> - `app/api/*.ts`、`server/api/**/*.ts`、`route-map.yaml` 的 `path:`、type 註解內的 endpoint 範例 ——**一律寫相對 path**
> - **絕不寫絕對 URL**：產出檔案中不得出現 `http://`、`https://`、host name、port
> - Runtime domain 由 env (`NUXT_PUBLIC_API_BASE`) 注入 `runtimeConfig.public.apiBase`，`app/composables/useHttp.ts` 自動套上 baseURL
> - 前綴取法見 `phase-0-prep.md`「Path 前綴偵測」：前綴的真相是**端點實際住在哪**，`servers.url` 只是線索之一（常只有 host 無 path）。取 servers.url path 段與 paths keys 最長共同前綴和解，衝突或 servers 無 path 段時以 **paths 共同前綴**為準。無論來源為何，產出只寫 path 段，host / port / protocol 全部丟棄
> - 換 domain = 改 `.env.production` 一行；spec、型別、產出程式碼**完全不動**

### 6.1 Path 樣式由專案決定

> **不假設任何特定前綴形式**
>
> 各專案後端習慣不同，常見前綴包括 `/api/v1`、`/v1`、`/api`、`/api/v2024-01`、空字串等。Prompt **不評價、不強制**任何形式：
>
> - **若 `spec/api/api-spec.yml` 存在**：和解 `servers.url` path 段與 `paths` keys 最長共同前綴；servers 無 path 段或兩者衝突 → 以 paths 共同前綴為準（詳見 `phase-0-prep.md`「Path 前綴偵測」步驟 2）
> - **若已有 `server/api/` 既有結構**：沿用其最長共同前綴，**不因 SoT 模式切換而重抽**
> - **完全空專案**：停下來詢問使用者前綴形式，不要默默猜
>
> 後續所有範例的 `/api/...` 寫法僅為**示意**，實際產出應以專案偵測到的前綴為準。

### 6.2 路徑結構慣例

優先以 OpenAPI 寫法為準。Feature 推導模式下，遵循下列規則：

| 動作類型 | 路徑風格 | 範例（假想 notes 領域示意，非本專案端點） |
|---|---|---|
| **CRUD 集合** | `/{resource}` | `/notebooks`、`/tags` |
| **CRUD 單筆** | `/{resource}/{id}` | `/notebooks/{notebookId}` |
| **子資源** | `/{resource}/{id}/{sub}` | `/notebooks/{notebookId}/notes` |
| **動作（含動詞）** | 用名詞化子路徑 + POST/PATCH | `/notes/{id}/archive`、`/members/{id}/reset-password`、`/notes/{id}/owner` |
| **狀態變更（對應布林切換）** | 一對動作端點 | `POST .../pin` ↔ `POST .../unpin`（**不要用 DELETE .../pin**） |

> ⚠️ 若已存在 spec，**完全照 spec 路徑與 method**，不要自作主張。

---

## 7. Pagination / Query

| OpenAPI 有定義 | 行為 |
|---|---|
| `parameters` 有 `page`、`page_size` | mock 端點實作分頁 |
| `parameters` 只有 filter（如 `siteId`、`stationId`） | mock 端點只實作 filter，**不要自加分頁**（避免 spec 偏離） |
| 無 parameters | 直接回完整陣列，無分頁、無 filter |

Feature 推導模式下，**列表預設不加分頁**，除非該頁明確需要（如歷史紀錄列表 ≥ 11 筆）。要加時請同步更新 `route-map.yaml` 與後續產 spec 的人。

---

## 8. Mock data 結構

- 欄位 camelCase
- 軟刪除用 `deletedAt: string | null`（OpenAPI 慣例），不用 `status: 'active' | 'deleted'`
- 角色 / 權限若需要：mock 使用者帶 `roles: string[]`、ownership 資源帶 `owner_field`（如 `createdBy`，accountId）。完整守門合約（端點 403 / 列表過濾 / 多角色種子 / token→角色橋接）由 `route-map.rbac` 驅動，**權威範本見 [rbac-scaffold.md](rbac-scaffold.md)**
- 不要在 mock data 加「mock 專用旗標」洩漏到 API response

---

## 9. 自我檢查清單（產出前必跑）

- [ ] 所有欄位都是 camelCase？grep `_` 應該只有檔名 / 註解 / 路徑
- [ ] response 外層只用「模式 A envelope（`{ success, data }`）」或「模式 B 裸 schema」其一，沒混用、沒自創 `{ status, ... }`？
- [ ] view 型別永遠是 `data` 的裸 schema（envelope 外層不寫進型別）？
- [ ] 前端讀錯誤一律走 `readApiError`，沒散落 `e.statusMessage || ...`？
- [ ] HTTP code 對齊（POST 不要回 200、軟刪除回 204 不帶 body）？
- [ ] 型別命名分清楚 Event / ListItem / Body / Detail？
- [ ] 每個 command（POST/PUT/PATCH）寫入的欄位，都有 GET 端點讀得回？詳情 GET 用 `XxxDetail` 完整型別，沒拿 `XxxListItem` 湊？
- [ ] 若 `spec/api/api-spec.yml` 存在，所有 endpoint 路徑 / method / response schema 都跟它逐字對齊？
- [ ] 沒有絕對 URL：`grep -rE "https?://" app/api/ server/api/` 應該為 0（SVG `xmlns` 等註解用途除外）
- [ ] 若 OpenAPI `servers.url` 含絕對 URL，產出只取了 path 段，host / port 未被寫進任何檔案？
- [ ] 所有產出 endpoint 的前綴一致（沒有半數帶 `/v1`、半數不帶的混雜情況）？

---

## 10. 與舊產出的差異（遷移備忘）

若專案內已存在舊版（snake_case + `{ status, data }` 包裝）的 types/endpoints/mock：

| 區域 | 舊 | 新 |
|---|---|---|
| 欄位 | `account_id` | `accountId` |
| 型別 | `AccountItem` | `AccountListItem` |
| 回應 | `{ status, data, meta }` | 裸物件 / 陣列 |
| 錯誤 | `{ message }` | `createError({ statusMessage })` |
| 收藏切換 | `DELETE .../favorite` | `POST .../unfavorite` |
| 密碼修改 | `PATCH /accounts/{id}/change-password` | `POST /accounts/{id}/password` |

下游 composable / store / page 必須同步調整。建議按資源批次遷移（accounts → sites → stations → watch → sightings → cameras → exports），每批跑一次 typecheck + lint。
