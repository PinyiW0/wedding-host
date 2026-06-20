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
| **欄位用 camelCase** | `accountId`、`teamName`、`newPassword`、`connectionStatus` |
| **絕不用 snake_case** | ❌ `account_id`、❌ `new_password` |
| **布林前綴用 `is` / `has`** | `isFavorited`、`hasPermission` |
| **時間欄位後綴 `At`** | `createdAt`、`startedAt`、`deletedAt` |
| **計數欄位後綴 `Count`** | `pitchCount`、`playerCount` |

### 型別名稱（interface name）

| 用途 | 命名規則 | 範例 |
|---|---|---|
| **寫入動作回應**（POST/PATCH/DELETE 的結果） | `XxxEvent`，動詞用過去式 | `TeamCreatedEvent`、`AccountPasswordChangedEvent`、`PitchFavoritedEvent` |
| **列表 view**（GET 列表的單筆 item） | `XxxListItem` | `TeamListItem`、`PlayerListItem`、`AccountListItem` |
| **詳情 view**（GET 單筆） | `XxxDetail` 或直接用實體名 | `PracticeDetail` |
| **Request body** | `XxxBody` 或 `XxxRequest` | `CreateTeamBody`、`StartPracticeBody` |
| **錯誤** | `ErrorResponse` | `ErrorResponse` |
| **enum 字串聯集** | TS literal union | `'connected' \| 'disconnected'` |

> ⚠️ 嚴禁用模糊命名（如 `TeamData`、`TeamInfo`）——區分是 event、view、body、detail 才能避免 schema 漂移。

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
TeamCreatedEvent:
  type: object
  required: [teamId, teamName]
  properties:
    teamId: {type: string, format: uuid}
    teamName: {type: string}
```

```typescript
// TypeScript
export interface TeamCreatedEvent {
  teamId: string
  teamName: string
}
```

---

## 3. Response shape（mock 端點回傳）

### ✅ 直接回 schema 裸物件 / 陣列

```typescript
// GET 列表
return mockTeams // → TeamListItem[]

// GET 單筆
return team // → TeamDetail

// POST 建立
return createdEvent // → TeamCreatedEvent
```

### ❌ 不要包 `{ status, data, meta }`

```typescript
// ❌ 舊慣例（已淘汰，與 OpenAPI 不一致）
return { status: 'success', data: items, meta: { total, page, page_size } }
```

> ⚠️ 包裝層會讓 OpenAPI schema 與實際回應 shape 不一致，前端 composable 需額外解 `.data`，未來接真實 API 時還要全部改回——所以**從一開始就不要包**。

---

## 4. 錯誤格式

統一用 Nuxt 內建 `createError`，前端讀 `error.statusMessage`：

```typescript
// server 端
throw createError({ statusCode: 404, statusMessage: '帳號不存在' })
throw createError({ statusCode: 409, statusMessage: '帳號名稱已存在' })
throw createError({ statusCode: 400, statusMessage: '請輸入帳號與密碼' })
```

```typescript
// 前端 composable
try {
  await $fetch('/api/auth/login', { method: 'POST', body })
}
catch (e: any) {
  toast.error(e.statusMessage || '操作失敗')
}
```

> 對應 OpenAPI 的 `ErrorResponse = { errorMessage: string }`：`statusMessage` 即扮演同等角色，差別是欄位名。**若團隊堅持要 `errorMessage` 欄位**，可在 `server/middleware/error.ts` 加一層 transformer，但目前先用 `statusMessage`。

---

## 5. HTTP Status Code

| 場景 | Code | 備註 |
|---|---|---|
| GET 成功 | 200 | |
| POST 建立 / 觸發動作（含 login / 收藏 / 結束練習 / 匯出） | 201 | OpenAPI 明示 `'201'` 一律照辦 |
| PATCH 更新 | 200 | |
| DELETE 軟刪除 | 204 | **無 response body** |
| 驗證錯誤（refinement 違反） | 400 | |
| 未授權（無 token / token 失效） | 401 | |
| 權限不足 | 403 | |
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
> - 若 OpenAPI `servers.url` 含絕對 URL（例：`https://api.example.com/v1`），**只取其 path 段**（`/v1`）作為前綴，host / port / protocol 全部丟棄
> - 換 domain = 改 `.env.production` 一行；spec、型別、產出程式碼**完全不動**

### 6.1 Path 樣式由專案決定

> **不假設任何特定前綴形式**
>
> 各專案後端習慣不同，常見前綴包括 `/api/v1`、`/v1`、`/api`、`/api/v2024-01`、空字串等。Prompt **不評價、不強制**任何形式：
>
> - **若 `spec/api/api-spec.yml` 存在**：以 `servers.url` 的 path 段為前綴（去掉 host）
> - **若已有 `server/api/` 既有結構**：沿用其最長共同前綴，**不因 SoT 模式切換而重抽**
> - **完全空專案**：停下來詢問使用者前綴形式，不要默默猜
>
> 後續所有範例的 `/api/...` 寫法僅為**示意**，實際產出應以專案偵測到的前綴為準。

### 6.2 路徑結構慣例

優先以 OpenAPI 寫法為準。Feature 推導模式下，遵循下列規則：

| 動作類型 | 路徑風格 | 範例 |
|---|---|---|
| **CRUD 集合** | `/{resource}` | `/teams`、`/players` |
| **CRUD 單筆** | `/{resource}/{id}` | `/teams/{teamId}` |
| **子資源** | `/{resource}/{id}/{sub}` | `/practices/{practiceId}/pitches` |
| **動作（含動詞）** | 用名詞化子路徑 + POST/PATCH | `/practices/{id}/end`、`/accounts/{id}/reset-password`、`/practices/{id}/pitcher` |
| **狀態變更（對應布林切換）** | 一對動作端點 | `POST .../favorite` ↔ `POST .../unfavorite`（**不要用 DELETE .../favorite**） |

> ⚠️ 若已存在 spec，**完全照 spec 路徑與 method**，不要自作主張。

---

## 7. Pagination / Query

| OpenAPI 有定義 | 行為 |
|---|---|
| `parameters` 有 `page`、`page_size` | mock 端點實作分頁 |
| `parameters` 只有 filter（如 `teamId`、`playerId`） | mock 端點只實作 filter，**不要自加分頁**（避免 spec 偏離） |
| 無 parameters | 直接回完整陣列，無分頁、無 filter |

Feature 推導模式下，**列表預設不加分頁**，除非該頁明確需要（如歷史紀錄列表 ≥ 11 筆）。要加時請同步更新 `route-map.yaml` 與後續產 spec 的人。

---

## 8. Mock data 結構

- 欄位 camelCase
- 軟刪除用 `deletedAt: string | null`（OpenAPI 慣例），不用 `status: 'active' | 'deleted'`
- 角色過濾若需要，加 `createdBy: string`（accountId）
- 不要在 mock data 加「mock 專用旗標」洩漏到 API response

---

## 9. 自我檢查清單（產出前必跑）

- [ ] 所有欄位都是 camelCase？grep `_` 應該只有檔名 / 註解 / 路徑
- [ ] 沒有任何 `{ status: 'success', data: ... }` 包裝？grep `status: 'success'` 應該是 0
- [ ] 所有錯誤都用 `createError({ statusCode, statusMessage })`？沒有 `message:` 欄位
- [ ] HTTP code 對齊（POST 不要回 200、軟刪除回 204 不帶 body）？
- [ ] 型別命名分清楚 Event / ListItem / Body / Detail？
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
| 密碼修改 | `/accounts/{id}/password` | `/accounts/{id}/change-password` |

下游 composable / store / page 必須同步調整。建議按資源批次遷移（accounts → teams → players → practice → pitches → cameras → exports），每批跑一次 typecheck + lint。
