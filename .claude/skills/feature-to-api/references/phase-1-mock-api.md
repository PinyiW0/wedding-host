# Phase 1: Mock API

## 必讀規範

```
僅需讀取：
- ../references/openapi-conventions.md（輸出格式法典，必讀）
- app/types/api/*.ts（Phase 0 已建立的型別定義）
- spec/report/route-map.yaml > api_contract.path_prefix（API 路徑前綴，決定 server/api/ 資料夾結構）
- spec/report/route-map.yaml > api_contract.endpoints（端點規格）
- spec/report/route-map.yaml > enabled_features（若含 dragAndDrop → 需建 sort API；若含 fileUpload → 需建 upload API）
- spec/report/route-map.yaml > auth（**若存在** → 非 public 端點首行 `requireAuth`，未登入回 401；見步驟 6）
- spec/report/route-map.yaml > rbac（**若存在** → 角色守門：endpoints 套 requireRole 回 403（BFLA）、ownership 套列表過濾、object_ownership 套單筆歸屬檢查（BOLA，預設 404）、多角色種子；範本見 [rbac-scaffold.md](rbac-scaffold.md) §3a）
- spec/e2e-flows/*.flow.md（操作流程中引用的實體名稱、資料值）
- ui-config.yaml > testAccounts（測試帳號）
- rules.md [P1] 段落（Server API 類型規範）
- .claude/rules/server-security.md（**Server 安全慣例，必讀**——本檔在 subagent 內不會自動注入，產任何 server 端點前必須主動讀）

OpenAPI 模式必讀：
- spec/api/api-spec.yml（SoT，response shape 須逐欄對齊）

Sync 模式額外讀取：
- spec/report/sync-report.md（變更報告的「型別變更」+「端點變更」段落）
```

> ⚠️ **型別定義（`app/types/api/*.ts`）由 Phase 0 建立**。Phase 1 讀取這些型別檔作為 mock data 和 API 端點的合約依據，不再從 YAML 翻譯型別。
>
> ⚠️ **Mock 資料的實體名稱、數值等，必須優先使用 `.flow.md` 中出現的假設值**。若 `.flow.md` 引用了「觀測點C」，mock 補建時就用「觀測點C」，不要自行發明名稱。這確保 spec（從 flow 生成）的斷言值與 mock 資料一致，減少 green 階段的回修。
>
> ⚠️ **`server/api/` 資料夾結構必須對齊 `path_prefix`**
> - 例：`path_prefix = /api/v1` + endpoint `/api/v1/sites` → 檔案 `server/api/v1/sites/index.get.ts`
> - 例：`path_prefix = /api` + endpoint `/api/sites` → 檔案 `server/api/sites/index.get.ts`
> - 下方所有範例為示意，**實際資料夾與 endpoint 路徑以本專案 `route-map.yaml > api_contract.path_prefix` 為準**
> - route-map 標 `outside_prefix: true` 的離群端點（路徑不在 `/api` 下，如 `/upload-data`）放 `server/routes/`：Nitro 的 `server/api/` 只服務 `/api/*`

> ⚠️ **Business Invariant 常數檔**：滿足 [invariants.md](invariants.md) 適用條件時，Phase 1 須一併建立／更新 `app/constants/invariants.ts`（來源：`.flow.md` Business Invariants 段；與 mock data 並列產出，UI 與 spec 是消費端）。

> ⚠️ **Envelope helper（模式 A）**：首次建 mock 前，若 `server/mock/envelope.ts` 不存在，先依 [openapi-conventions.md](openapi-conventions.md) §3 的定義建立（`ok` / `page` helper），所有端點統一 import 使用。

---

## 增量模式判斷

Phase 1 開始前，先檢查 `spec/report/sync-report.md` 是否存在：

| 條件 | 模式 | 行為 |
|------|------|------|
| `sync-report.md` **不存在** | **全量模式** | 執行下方「全量模式執行步驟」（現有流程不動） |
| `sync-report.md` **存在** | **增量模式** | 讀取報告，只處理有變更的型別和端點 |

### 增量模式步驟

1. **讀取 sync-report.md** 的「型別變更」和「端點變更」表格
2. **新增的型別** → 建立新的 `app/types/api/{resource}.ts`，更新 `index.ts` 的 re-export
3. **修改的型別** → 讀取現有檔案 → Edit 受影響的欄位（新增/修改/刪除 interface 屬性）
4. **新增的端點** → 建立新的 `server/api/**/*.ts` + 對應 mock data
   - sync-report 標「新增 auth 守門」或「新增角色守門」時，先補齊缺的 scaffold 再做這一步，依「缺哪個」判斷，不看檔案在不在：沒有 `server/mock/auth-context.ts`（或缺 `requireAuth`）→ 照 [auth-scaffold.md](auth-scaffold.md) §3、§4b 補生 auth-context、種子、`00.security-guard.ts`、`rate-limit.ts`、auth mock 端點；有角色守門但 auth-context 缺 `requireRole`／`requireOwnership` 或種子沒有 `roles` → 照 [rbac-scaffold.md](rbac-scaffold.md) §3a 補上
   - 有 auth 的專案，既有 `server/plugins/00.security-guard.ts` 沒有 `MOCK_AUTH` 那段 → 照 auth-scaffold.md §4b① 補上（舊版範本沒有這段）
5. **修改的端點** → 讀取現有端點原始碼 → 根據型別變更調整回傳結構和 mock 資料
   - 第 4、5 步的端點一樣要套用下方全量模式步驟 6 的登入守門與角色守門（讀 `route-map.yaml` 最新的 `auth`／`rbac`，含 Sync 步驟 7.7 新增的規則）
6. **刪除項目** → **不執行刪除**，列在回報清單提醒使用者手動處理
7. **掃描影響擴散** → 修改型別後，掃描所有 import 該型別的端點檔案，若回傳結構受影響則補入修改清單
8. **回報增量變更清單後結束**（分身等不到回覆；使用者要調整就改檔，再執行下一步）

增量回報格式：
```
Phase 1 增量更新完成

型別變更：
- [done] app/types/api/sites.ts：CreateSiteBody 新增 description 欄位
- [done] app/types/api/observers.ts：新建（ObserverItem, CreateObserverBody）

端點變更：
- [done] server/api/sites/index.post.ts：調整 body 結構
- [done] server/api/observers/index.get.ts：新建
- [done] server/api/observers/index.post.ts：新建

待刪除（不自動執行）：
- ⚠️ server/api/sites/[siteId].delete.ts（05-刪除觀測點 已移除）
```

> 完成後提示：「Phase 1 增量更新完成。下一步：`/feature-to-api 1.5`（同步 client 層）」

---

## 全量模式執行步驟

1. **確認 API 合約型別**（Phase 0 已建立 `app/types/api/*.ts`）
   - 讀取 Phase 0 建立的 TypeScript 型別檔，確認型別定義正確且完整
   - 若發現遺漏或錯誤，直接修正 `app/types/api/*.ts`
   - ⚠️ **型別檔必須在 `app/types/api/`**，Nuxt 4 的 `~` 別名解析到 `app/`
2. **從 .feature Background 提取 mock 資料**
3. **交叉比對 .flow.md 引用的實體值**
   - 掃描所有 `spec/e2e-flows/*.flow.md`，提取操作步驟和預期結果中引用的實體名稱、數值
   - 補建資料時，優先使用 `.flow.md` 中出現的名稱/值
   - 若 `.flow.md` 未引用（純粹為了湊數量），可自行命名但風格需一致
4. **建立 mock data 檔案**（mock 資料結構必須符合 `types/api/` 定義）
5. **確保 Mock 資料最低數量**

   | 資料類型 | 最低數量 | 原因 |
   |----------|----------|------|
   | 列表頁面主要資料 | ≥ 11 筆 | 分頁每頁 10 筆，需 > 1 頁才能測試分頁 |
   | 關聯資料（子項目） | ≥ 3 筆/父項 | 確保列表不會因資料太少而隱藏 UI |
   | 下拉選單選項 | ≥ 3 項 | 確保選單可滾動、可篩選 |
   | 牆型／散佈型視覺元件資料（scatter、照片牆、標籤雲） | ≥ 8 筆且**多樣** | 1–2 筆時視覺完全不成立，無從評估佈局與密度 |

   > ⚠️ 不足時在步驟 4 補建，不要等到 Phase 5 才發現分頁無法測試

   **視覺充足量**（不只夠測，還要夠看）：資料餵給牆型／散佈型視覺元件時，除了數量還要**多樣性**——顏色、長度、分佈給出變化、含一兩筆極端值。重複性高的 seed 用參數化生成組合種子陣列，不要手寫 N 筆幾乎一樣的資料（實例：wedding-host 的賓客配花牆需 8 色 × 10 位賓客才能迭代視覺）：

   ```typescript
   // 參數化生成：組合種子陣列產生多樣 seed
   const colors = ['rose', 'amber', 'violet', 'sky', 'emerald', 'orange', 'pink', 'teal']
   export const mockFlowers = mockGuests.map((guest, i) => ({
     guestId: guest.guestId,
     color: colors[i % colors.length],
     size: 24 + (i * 7) % 20, // 尺寸做出散佈
   }))
   ```

   **擴充時必須維護 SSoT 一致性**（`.feature` Background 是 mock 資料的唯一真實來源）：

   | 規則 | 說明 |
   |------|------|
   | **保留既有實體** | `.feature` Background 定義的所有實體，欄位值與關聯關係不可變更 |
   | **只能新增** | 補足數量時只能新增額外實體，不能修改既有實體的任何欄位 |
   | **不新增未定義的父實體** | 新增的子實體必須分配到 `.feature` 已定義的父實體 |

   > ⚠️ 違反此規則會導致 `.flow.md` 預期值與 mock 不一致，E2E 測試被迫偏離 SSoT 鏈（`.feature` → `.flow.md` → `.spec.ts`）

6. **建立 API 端點**（回傳格式必須嚴格符合 `types/api/` 合約）
   - **登入守門（route-map 有 `auth` 區塊時，不論有無 `rbac`）**：除了下面列的例外，所有端點的 handler **首行** `requireAuth(event)`（`auth.public_paths` 是頁面路由，不是端點清單；公開判定照 OpenAPI 的有效 security：先看 operation 自己的 `security`，沒寫就用全域 `security`；結果是空陣列或含 `{}` 選項 → 公開，不加 `requireAuth`；spec 裡有其他 operation 寫了 `security`，這個 operation 和全域都沒寫 → 公開；整份 spec 的 operation 和全域都沒寫 `security`（只定義 `securitySchemes`）→ 當受保護，並在回報列出待確認；沒有 OpenAPI、從 `.feature` 推導時，`.feature` 寫明不登入也能用的端點才算公開，並列進回報）——無 token 或查無使用者 → **401**（不是 403；前端靠 401 才會換發 token 或導去登入頁）。`auth.token_endpoints` 的 login／refresh／logout 不加；`/auth/me` 本身就用 `requireAuth` 反查。`server/mock/auth-context.ts` 範本見 [rbac-scaffold.md](rbac-scaffold.md) §3a；無 `rbac` 時只建 `getMockCurrentUser` ＋ `requireAuth` 兩個函式，不做 ownership 過濾。
   - **角色守門（`rbac` 區塊存在時，疊在登入守門之上；讀 `route-map.rbac`，非臨場猜）**：phase-0 授權偵測已把角色規則萃取進 `route-map.yaml > rbac`（單一 SoT）。此處**一律讀該區塊套用**，不再從 `.feature` 散文重新偵測（避免漂移）。範本見 [rbac-scaffold.md](rbac-scaffold.md) §3a：
     1. **先建橋接 util** `server/mock/auth-context.ts`（`getMockCurrentUser` / `requireAuth` / `requireRole` / `requireOwnership`，由 Bearer mock-token 反查當前使用者 roles）——這是 token → 角色的唯一橋樑
     2. **多角色種子**：`mockUsers` 帶 `roles: string[]`，`rbac.roles` 每個角色**至少一帳號**（否則無從以該角色登入看差異）
     3. **`rbac.endpoints`**（端點存取控制 / OWASP BFLA）：對應 handler **首行** `requireRole(event, allow, message)`（內含 `requireAuth`）→ 未登入 401、不在 allow 內的角色 403
     4. **`rbac.ownership`**（列表級 ACL）：首行 `const me = requireAuth(event)`，`restricted_roles` 內的角色過濾 `owner_field === me.accountId`，其餘角色不過濾；該資源 mock data 需含 `owner_field`（如 `createdBy`，值為 accountId）
     5. **`rbac.object_ownership`**（單筆 object 級 ACL / **OWASP API #1 BOLA**）：`/{id}` 端點首行 `const me = requireAuth(event)`，**先查到該筆 object → `requireOwnership(me, obj.owner_field, restricted_roles)` → 才動作**，受限角色帶他人 id → 404（route-map 條目設 `deny_status: 403` 時傳 `{ denyStatus: 403 }`）；mock data 同需含 `owner_field`。**最常漏、卻是 OWASP 排名第 1**
     6. **`rbac.business_guards`** 只是登錄、不在此自動生（「不得刪最後一個全權角色」409、self-vs-others 改密疊加條件等留手寫）
     > 角色名一律用 `rbac.roles` 的實際值，**不寫死**範例角色名；判準是「受限 vs 全權」「哪些角色 allow」的語意。
   - **`rbac` 與 `auth` 都沒有** → 純公開專案，所有端點不加守門、不加 ownership 過濾。
6.5. **讀回完整性自查（產完端點必跑）**：逐一列出每個寫入 handler（`.post.ts` / `.put.ts` / `.patch.ts`）更新進 mock data 的欄位，確認：
   - 存在 GET handler 回傳含這些欄位（詳情 GET 回 `XxxDetail` 完整型別，不是 `XxxListItem`）
   - mock data 初始實體也帶這些欄位（否則 GET 回 `undefined`，UI 首次載入就壞）
   - 讀不回 → Feature 推導模式**直接補 GET 端點／欄位**；OpenAPI 模式端點不可自創，記入 sync-report「待 PM 處理」回報
   > wedding-host 實戰：只產寫入端點、UI 用 local state 兜著顯示，重新整理全丟，事後補了 7 個 GET。
6.6. **安全自查（產完端點必跑，判準見 `.claude/rules/server-security.md`）**：
   - □ 每個含 ≥2 個 path 參數的 handler，查詢條件含**全部**父層參數（巢狀範例的鐵律）
   - □ 同目錄兄弟 handler（GET/PATCH/DELETE）的 scope 過濾條件逐字等價
   - □ 每個寫入端點都經 `readValidatedBody` + schema；數字欄有 `.int()` 與範圍、enum 欄有白名單
   - □ grep 產出：無 `...body` 或 `Object.assign` 流入寫入語句（mock push／欄位更新）
   - □ 每個回應是白名單挑欄位；`password`／token／內部備註類欄位不在任何回應
   - □ 操作者身分取自 auth context／簽名憑證，無任何 handler 拿 body/query 的 id 當身分
   > wedding-host 實戰：DELETE 漏父層過濾（IDOR）、`{ weddingId, ...body }` 被覆蓋（跨租戶寫入）、數字欄 NaN／溢位進資料層——全是這張清單能擋下的。
7. **回報產出清單後結束**（不自動進 Phase 1.5）

## 輸出結構

```
app/
└── types/
    └── api/
        ├── index.ts           # 統一 re-export + 共用型別
        ├── auth.ts            # LoginBody, LoginResponse
        ├── sites.ts           # SiteListItem, SiteCreatedEvent, CreateSiteBody
        └── stations.ts         # StationListItem, CreateStationBody

server/
├── mock/
│   └── data/
│       ├── index.ts
│       ├── users.ts
│       ├── revoked-tokens.ts  # auth 命中時（auth-scaffold.md §3a）
│       ├── sites.ts
│       └── stations.ts
├── validation/
│   ├── auth.ts            # loginSchema／refreshSchema（auth 命中時）
│   └── sites.ts           # 寫入端點的 zod schema（server-security.md 第 4 條）
└── api/
    ├── auth/              # auth 命中時四個一定要生，不看 spec 有沒有寫；refresh／me／logout 範本見 auth-scaffold.md §3a
    │   ├── login.post.ts
    │   ├── refresh.post.ts
    │   ├── logout.post.ts
    │   └── me.get.ts
    └── sites/
        ├── index.get.ts
        ├── [siteId].get.ts
        └── [siteId].delete.ts
```

> ⚠️ 同一目錄的動態段參數名要一致（`[siteId].get.ts` 與 `[siteId].delete.ts`）；名稱不一致時 `getRouterParam` 可能取不到值。

## API 合約型別範例

```typescript
// app/types/api/sites.ts
export interface SiteListItem {
  siteId: string // uuid
  siteName: string
  stationCount: number
}

export interface SiteCreatedEvent {
  siteId: string
  siteName: string
}

export interface CreateSiteBody {
  siteName: string
}
```

```typescript
// app/types/api/index.ts — 統一 re-export
export type { LoginBody, LoginResponse } from './auth'
export type { CreateSiteBody, SiteCreatedEvent, SiteListItem } from './sites'
```

> ⚠️ **命名慣例**：欄位 `camelCase`、型別 `PascalCase`、UUID/日期皆用 `string`
> ⚠️ **不要定義 `ApiResponse<T>` 包裝型別**——型別只寫裸 schema（view 型別）；mock 回應的外層依 [openapi-conventions.md](openapi-conventions.md) §3 的模式（模式 A 用 `ok()` 包、模式 B 裸回）。

## Mock 資料範例

```typescript
// server/mock/data/users.ts
export const mockUsers = [
  // 角色值為假想（workspace_owner / member）；實際用 route-map.rbac.roles 萃取出的角色詞
  { accountId: 'acc-001', account: 'owner1', password: 'pass1234', name: '工作區擁有者', roles: ['workspace_owner'], deletedAt: null },
  { accountId: 'acc-002', account: 'member1', password: 'pass1234', name: '一般成員', roles: ['member'], deletedAt: null },
]
```

> ⚠️ **角色用 `roles: string[]`**（對齊 OpenAPI / auth-scaffold 的 `MeResponse.roles`），不要用單數 `role: 'x'`。
> ⚠️ **有 `route-map.rbac` 時**：`rbac.roles` 每個角色**至少一帳號**（否則無從以該角色登入看差異）；出現在 `rbac.ownership` 的資源其 mock data 需含 `owner_field`（如 `createdBy`，值為 accountId），分配給不同帳號以利過濾可測。詳見 [rbac-scaffold.md](rbac-scaffold.md) §3a。無 rbac 區塊的資源不需要這些欄位。
>
> ⚠️ 軟刪除用 `deletedAt: string | null`，不要用 `status: 'active' | 'deleted'`（對齊 OpenAPI 慣例）。

## API 端點範例

```typescript
// server/validation/auth.ts
import { z } from 'zod'

export const loginSchema = z.object({
  account: z.string().trim().min(1, '請輸入帳號').max(100, '帳號過長'),
  password: z.string().min(1, '請輸入密碼').max(200, '密碼過長'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, '缺少 refresh token').max(500, 'refresh token 格式錯誤'),
})
```

```typescript
// server/api/v1/auth/login.post.ts（假設 path_prefix = /api/v1，與 auth-scaffold §3a 的 refresh／me／logout 同層）
import type { H3Event } from 'h3'
import type { LoginResponse } from '../../../../app/types/api/auth'

import { REFRESH_TTL_MS } from '../../../mock/data/revoked-tokens' // auth-scaffold.md §3a
import { mockUsers } from '../../../mock/data/users'
import { assertNotRateLimited, clearFailures, recordFailure } from '../../../utils/rate-limit'
import { loginSchema } from '../../../validation/auth'

export default defineEventHandler(async (event: H3Event): Promise<LoginResponse> => {
  const parsed = await readValidatedBody(event, loginSchema.safeParse)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? '輸入格式錯誤' })
  }
  const body = parsed.data

  // 登入限流：同 IP＋帳號 15 分鐘內失敗 10 次 → 429；只計失敗、成功清零（rate-limit.ts 範本見 auth-scaffold.md §4b②）
  // 不讀 X-Forwarded-For：這個 header 由瀏覽器端自填，換一個值就換一個限流 key；部署在反向代理後面時才改讀代理設定的可信 header
  const key = `login:${getRequestIP(event)}:${body.account}`
  assertNotRateLimited(key, 10, 15 * 60 * 1000)

  // 帳號不存在與密碼錯回同一個 401、同一句文案：分開回，外人就能逐一試出哪些帳號存在
  const user = mockUsers.find(u => u.account === body.account && !u.deletedAt)
  if (!user || user.password !== body.password) {
    recordFailure(key)
    throw createError({ statusCode: 401, message: '帳號或密碼錯誤' })
  }
  clearFailures(key)

  // [O] 模式 B 示意：直接回 schema 物件（模式 A 用 ok() 包裝，見 openapi-conventions §3）
  // 回傳形狀對齊 auth-scaffold.md §3a 的 TokenPairData（LoginResponse 的唯一權威定義）
  return {
    accessToken: `mock-token-${user.accountId}-${Date.now()}`,
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    accountId: user.accountId,
    refreshToken: `mock-refresh-${user.accountId}-${Date.now()}`,
    refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
  }
})
```

> ⚠️ **Server 端 import 必須用相對路徑**，不能用 `~/`
> ⚠️ **event 必須標註 H3Event**、**陣列索引存取須處理 undefined** → 詳見 [rules.md](../references/rules.md)
> ⚠️ **錯誤格式以 [openapi-conventions.md §4](openapi-conventions.md) 為唯一真理來源**：server 端用 `createError({ statusCode, message })` 傳使用者文案，`statusMessage` 不傳文案；前端經 `readApiError` 讀（它讀 `data.message` 與 envelope 的 `data.data.message`，不讀 `statusMessage`）；要給使用者看的錯誤一律用 4xx（403／404 的 `message` 不會顯示在畫面上：前端對這兩類一律用 `ERROR_COPY` 固定文案，該欄位仍要寫，但讀者是 server log 與 API 直接消費者）。**本專案例外**：尚無 `readApiError`／`ERROR_COPY`，新端點沿用 `statusMessage`、403／404 文案會顯示在畫面上，以 §4 開頭「本專案現況」註記為準
>
> ⚠️ **BFF 警示：server route 內呼叫上游（`$fetch`、DB driver、HTTP SDK、驗證庫等任何可能丟出帶 `statusCode` 的非 H3Error 的東西）一律要 try/catch 後重新包成 `createError`**。ofetch 的 `FetchError` 只是最常見的一個；h3 會對任何非 H3Error 標 `unhandled = true`（`h3/dist/index.mjs:2419-2421`），與狀態碼無關；而 nitropack 的 `isSensitive = error.unhandled || error.fatal`（`error/prod.mjs:18-19`）。後果：
> - production：回應內容的 `message` 被換成 `"Server Error"`、`data` 被砍成 `undefined`（`prod.mjs:59-60`），連 envelope 都救不回來；前端守衛會擋掉這個字串，使用者只看到固定文案
> - dev：dev 錯誤處理器無條件寫 `message: error.message`（`error/dev.mjs:79-80`），內部原文會原樣上畫面。ofetch 自組的訊息 `[GET] "http://上游主機:8080/x": 409 Server Error`（`ofetch.CWycOUEr.mjs:13-18`）會洩漏上游主機位址；帶 `statusCode` 的非 H3Error 同理，例如 `ValidationError: duplicate key ... "users_pk"`。所以不能因為「production 看起來沒事」就不包
>
> ```typescript
> // [O] 重新包成 H3Error，才不會被標 unhandled
> // 就地讀 statusCode：server route 不能 import app/ 的 util（`~/` 不可用，相對 import 也不該為此引入）
> try {
>   return await $fetch<OrderItem>(`${upstream}/orders/${id}`)
> }
> catch (e) {
>   const status = (e as { statusCode?: number }).statusCode
>   // 只轉發對呼叫端有意義的上游 4xx 業務錯誤；上游 401 與所有 5xx（含取不到狀態碼）一律轉 502
>   // 原樣轉發上游 401 會讓前端 useHttp 的 401 攔截器對「上游的」認證失敗跑 refresh → retry → forceLogout()，把使用者登出
>   // 要給使用者看的中文 message 必須搭 4xx；5xx 前端一律顯示固定文案，message 不會上畫面
>   const forwardable = status !== undefined && status >= 400 && status < 500 && status !== 401
>   throw createError({
>     statusCode: forwardable ? status : 502,
>     message: '訂單服務暫時無法使用',
>   })
> }
> // [X] 不包：await $fetch(`${upstream}/orders/${id}`) 直接讓 FetchError 冒出去
> ```
>
> 前端 `readApiError` 已有守衛擋掉 `"Server Error"` 與 ofetch 自組字串，但那是最後一道防線，不該依賴它；dev 尤其擋不住無法識別來源的內部原文。
> ⚠️ **回應信封依 [openapi-conventions.md §3](openapi-conventions.md)（模式 A `ok()` envelope／模式 B 裸回），判定值讀 `route-map.yaml > response_conventions.envelope`；本頁範例為模式 B 示意**，絕不自創 `{ status, data }` 第三種包裝

### 列表端點範例（CRUD 標準模式）

> ⚠️ **回應信封依 openapi-conventions §3 模式回傳（見上方指讀），不挑欄位**

```typescript
// server/api/sites/index.get.ts
import type { SiteListItem } from '../../../app/types/api/sites'

import { mockSites } from '../../mock/data/sites'

// 用不到 event 就不宣告參數（專案 eslint 擋未使用參數）；auth 命中時首行要 requireAuth(event)，那時才帶 event
export default defineEventHandler((): SiteListItem[] => {
  return mockSites
    .filter(t => !t.deletedAt)
    .map(t => ({
      siteId: t.siteId,
      siteName: t.siteName,
      stationCount: t.stationCount,
    }))
})
```

> ⚠️ **預設不加分頁**——OpenAPI spec 沒寫 `page / page_size` 就不要自加，避免和 spec 偏離。若該頁面確實需要分頁（如歷史紀錄），請先在 `api-spec.yml` 加 `parameters`，再來實作 mock。
>
> ⚠️ `.map()` 只用在「mock data 結構含內部欄位（如 `deletedAt`、`password`）需要過濾」時——若 mock data 結構已與 type 完全一致，可直接 `return mockSites.filter(...)`。

### POST 端點範例（直接回 Event，含輸入驗證）

寫入端點一律經 runtime 驗證（`server-security.md` 第 4 條）：schema 住 `server/validation/{resource}.ts`，
數字 `.int().min().max()`、enum `z.enum([...])`、字串 `.trim().max()`——界限從 spec 萃取（OpenAPI `minimum`/`maximum`/`enum`），spec 沒寫的用型別常識界限（如數量非負、int32 上限）。

```typescript
// server/validation/sites.ts
import { z } from 'zod'

export const createSiteSchema = z.object({
  siteName: z.string().trim().min(1, '請輸入觀測點名稱').max(50, '觀測點名稱過長'),
})
// 數字欄示例（本型別無數字欄，示意）：z.number().int('須為整數').min(0, '不可小於 0').max(2147483647, '數值過大') 擋 NaN／浮點／負值／int4 溢位
// enum 欄示例：z.enum(['pending', 'done'], '狀態值不合法') —— runtime 白名單，值從 spec 的 enum 萃取
```

> ⚠️ **schema 定義時每條規則都要寫中文訊息**（如 `z.number().min(0, '不可小於 0')`、`z.enum([...], '狀態值不合法')`）。zod 預設 `issues[0].message` 是英文句子（如 `Too small: expected number to be >=0`），不是 `undefined`，所以後面的 `?? '輸入格式錯誤'` 不會生效，英文會原樣轉送上畫面。
> 前端擋不住這種「後端主動轉送英文」（zod 的英文訊息放進 `createError({ message })` 就會原樣進回應內容，前端讀到的就是那句英文），責任在 schema 定義處。

```typescript
// server/api/sites/index.post.ts
import type { H3Event } from 'h3'
import type { SiteCreatedEvent } from '../../../app/types/api/sites'

import { mockSites } from '../../mock/data/sites'
import { createSiteSchema } from '../../validation/sites'

export default defineEventHandler(async (event: H3Event): Promise<SiteCreatedEvent> => {
  const parsed = await readValidatedBody(event, createSiteSchema.safeParse)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? '輸入格式錯誤' })
  }
  const body = parsed.data

  if (mockSites.some(t => t.siteName === body.siteName && !t.deletedAt)) {
    throw createError({ statusCode: 409, message: '觀測點名稱已存在' })
  }

  // [O] 逐欄白名單手構；[X] 禁止 { ...body }——body 可覆蓋 server 決定的欄位（id／owner／租戶）＝跨租戶寫入（wedding-host 實戰）
  const siteId = crypto.randomUUID()
  mockSites.unshift({ siteId, siteName: body.siteName, stationCount: 0, deletedAt: null })

  setResponseStatus(event, 201)
  return { siteId, siteName: body.siteName }
})
```

### DELETE 端點範例（軟刪除回 204）

```typescript
// server/api/sites/[siteId].delete.ts
import type { H3Event } from 'h3'

import { mockSites } from '../../mock/data/sites'

export default defineEventHandler((event: H3Event) => {
  const siteId = getRouterParam(event, 'siteId')
  const site = mockSites.find(t => t.siteId === siteId && !t.deletedAt)
  if (!site) {
    throw createError({ statusCode: 404, message: '觀測點不存在' })
  }
  site.deletedAt = new Date().toISOString()

  setResponseStatus(event, 204)
  // 204 不帶 body
})
```

### 巢狀子資源端點範例（父層過濾鐵律）

> ⚠️ **鐵律：path 有幾個參數、查詢條件就用幾個參數；同目錄兄弟 handler 的 scope 條件逐字等價。**
> wedding-host 實戰：DELETE 漏帶父層參數而同目錄 PATCH 有——任何登入者換個父層 id 就能跨租戶刪除（IDOR）。
> （projects/tasks 為假想資源，僅示意巢狀寫法；上方 sites 範例是**平面**資源才只用自身 id。）

```typescript
// server/api/projects/[projectId]/tasks/[taskId].get.ts
export default defineEventHandler((event: H3Event): TaskDetail => {
  const projectId = getRouterParam(event, 'projectId')
  const taskId = getRouterParam(event, 'taskId')
  // scope 條件：兩個 path 參數都進查詢——GET/PATCH/DELETE 三兄弟共用同一行
  const task = mockTasks.find(t => t.taskId === taskId && t.projectId === projectId && !t.deletedAt)
  if (!task)
    throw createError({ statusCode: 404, message: '任務不存在' }) // 跨父層探測回 404，不洩漏存在性

  return { taskId: task.taskId, title: task.title, priority: task.priority, status: task.status }
})
```

```typescript
// server/api/projects/[projectId]/tasks/[taskId].patch.ts —— scope 條件與 GET 逐字相同
const task = mockTasks.find(t => t.taskId === taskId && t.projectId === projectId && !t.deletedAt)
if (!task)
  throw createError({ statusCode: 404, message: '任務不存在' })

// updateTaskSchema：priority: z.number().int('須為整數').min(1, '優先度須為 1 到 5').max(5, '優先度須為 1 到 5').optional()、status: z.enum(['pending', 'done'], '狀態值不合法').optional()
const parsed = await readValidatedBody(event, updateTaskSchema.safeParse)
if (!parsed.success)
  throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? '輸入格式錯誤' })

task.priority = parsed.data.priority ?? task.priority // 逐欄更新；[X] 禁止 Object.assign(task, body)
task.status = parsed.data.status ?? task.status
```

```typescript
// server/api/projects/[projectId]/tasks/[taskId].delete.ts —— scope 條件與 GET/PATCH 逐字相同
const task = mockTasks.find(t => t.taskId === taskId && t.projectId === projectId && !t.deletedAt)
if (!task)
  throw createError({ statusCode: 404, message: '任務不存在' })
task.deletedAt = new Date().toISOString()
setResponseStatus(event, 204)
```

### additionalFeatures 端點（`route-map.yaml > enabled_features` 有啟用時）

`feature-to-ui` 的 [features.md](../../feature-to-ui/references/features.md) 有些 wrapper 要後端端點，範本只放這裡。規則同上方 POST 範例：寫入一律 `readValidatedBody`＋schema、不 spread body；有 auth 時首行 `requireAuth`（步驟 6「登入守門」）；回應外層依 envelope 模式。

```typescript
// server/api/v1/notes/sort.put.ts —— dragAndDrop：依 ids 順序重排（假設 path_prefix=/api/v1；相對路徑依實際深度調整）
import type { H3Event } from 'h3'
import { z } from 'zod'

// 無 auth：刪掉下一行 `auth-context` 的 import 與 `const me = requireAuth(event)`，for 迴圈只留存在檢查（下面的重排靠它保證每個 id 都存在，刪掉會把 undefined 寫進陣列）。有 auth 無 rbac：import 只留 requireAuth、`const me =` 改回 `requireAuth(event)`，for 迴圈只留存在檢查
import { requireAuth, requireOwnership } from '../../../mock/auth-context'
import { mockNotes } from '../../../mock/data/notes'

// schema 照慣例放 server/validation/notes.ts，此處內嵌示意
const sortNotesSchema = z.object({
  // id 型別跟資源實際 ID 一致（notes 用字串）；features.md DraggableList 的 sorted payload 同型別
  ids: z.array(z.string().min(1, 'id 不可為空'))
    .min(1, '排序清單不可為空')
    .max(500, '排序清單過長')
    .refine(ids => new Set(ids).size === ids.length, '排序清單有重複 id'),
})

export default defineEventHandler(async (event: H3Event) => {
  const me = requireAuth(event)
  const parsed = await readValidatedBody(event, sortNotesSchema.safeParse)
  if (!parsed.success)
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? '輸入格式錯誤' })

  // 批次寫入也要逐筆驗歸屬：只靠 /{id} 端點的檢查，A 就能重排 B 的筆記
  for (const id of parsed.data.ids) {
    const note = mockNotes.find(n => n.noteId === id && !n.deletedAt)
    if (!note)
      throw createError({ statusCode: 404, message: '筆記不存在' })
    requireOwnership(me, note.createdBy, ['member']) // ['member'] 換成 route-map.rbac.object_ownership 的 restricted_roles
  }

  // 只重排清單內的筆記：它們原本佔的位置依 ids 順序填回；清單外（含別人的筆記）位置不動。
  // 不可整個陣列 sort：清單外的筆記會被擠到最後，A 的請求就改到 B 的排序
  const idSet = new Set(parsed.data.ids)
  const slots = mockNotes.flatMap((n, i) => (idSet.has(n.noteId) ? [i] : []))
  const byId = new Map(mockNotes.filter(n => idSet.has(n.noteId)).map(n => [n.noteId, n]))
  slots.forEach((slot, k) => {
    mockNotes[slot] = byId.get(parsed.data.ids[k]!)!
  })
  setResponseStatus(event, 204)
})
```

```typescript
// server/api/v1/upload.post.ts —— fileUpload：mock 不存檔，回假網址（假設 path_prefix=/api/v1）
import type { H3Event } from 'h3'

// 無 auth 專案刪掉下面兩行 import 與 handler 開頭的 requireAuth、限流三行（rate-limit.ts 只在 auth 命中時產出）
import { requireAuth } from '../../mock/auth-context'
import { assertNotRateLimited, recordFailure } from '../../utils/rate-limit' // auth-scaffold §4b②：上傳同套限流

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export default defineEventHandler(async (event: H3Event) => {
  requireAuth(event)
  const key = `upload:${getRequestIP(event)}`
  assertNotRateLimited(key, 30, 60 * 1000)
  recordFailure(key) // 上傳每次都記一筆（登入只記失敗），沒記就永遠不會觸發 429
  // 讀 body 前先擋大小：readMultipartFormData 會把整包讀進記憶體，沒有 content-length 或超過上限 → 413
  const length = Number(getRequestHeader(event, 'content-length'))
  if (!length || length > MAX_BYTES + 64 * 1024)
    throw createError({ statusCode: 413, message: '檔案過大' })
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename)
  if (!file)
    throw createError({ statusCode: 400, message: '請選擇檔案' })
  if (!ALLOWED_TYPES.has(file.type ?? ''))
    throw createError({ statusCode: 400, message: '檔案格式不支援' })
  if (file.data.length > MAX_BYTES)
    throw createError({ statusCode: 413, message: '檔案過大' })

  setResponseStatus(event, 201)
  return { url: `/uploads/mock-${crypto.randomUUID()}`, name: file.filename ?? 'file' }
})
```

> 大小與格式界限從 spec 萃取（OpenAPI `maxLength`／`format: binary` 旁的說明），spec 沒寫就用上方保守值，並在回報列為待確認。

### 角色守門範例（讀 route-map.rbac）

> **完整範本（橋接 util `auth-context.ts` + 端點 403 + ownership 過濾 + 多角色種子）見 [rbac-scaffold.md §3a](rbac-scaffold.md)，以該檔為唯一權威版本，勿在此複製。**角色名用 `rbac.roles` 實際值，勿寫死。

三種守門形狀（依 route-map 命中的 rbac 區塊選用）：

- **① 端點存取控制**（`rbac.endpoints`）——handler 首行 `requireRole(event, allow, message)`，當前角色不在 allow 內 → 403。
- **② 擁有權過濾**（`rbac.ownership` 的列表端點）——首行 `const me = requireAuth(event)` 取目前使用者，`restricted_roles` 內的角色只回自己 `owner_field` 的資料；全權角色不過濾。
- **③ 單筆 object 歸屬**（`rbac.object_ownership` 的 `/{id}` 端點，OWASP **BOLA / API #1**）——順序鐵律：**先查到 object → 再驗歸屬（`requireOwnership(me, owner, restrictedRoles)`，`me` 來自首行 `requireAuth(event)`）→ 才動作**；受限角色帶他人 id → 預設 404（route-map 條目設 `deny_status: 403` 時回 403）。先動作或只比對 id 不查 owner，就是 OWASP #1 漏洞。

> ⚠️ 這些 util 皆由 `server/mock/auth-context.ts` 提供（rbac-scaffold §3a）：`requireAuth`／`requireRole`／`getMockCurrentUser` 傳入 `event`，從 Authorization header 反查使用者；`requireOwnership` 傳入 `requireAuth` 回傳的使用者。
> ⚠️ 守門 / 過濾後直接回結果；E2E 斷言基於「該登入角色實際拿到的資料量」（見 spec.md 的多角色推算）。

## Auth Store 範例

auth 命中時的 store（login／isAuthenticated／clearAuth／persist）**完整範本見 [auth-scaffold.md §3a](auth-scaffold.md)（含 single-flight refresh、cookie 細節），以該檔為唯一權威版本，勿在此複製**。
login 為寫入操作走 `$fetch`，回傳直接是裸型別（`LoginResponse`，即 auth-scaffold.md 的 `TokenPairData`），無 `.data` 解包。

> ⚠️ **persist 儲存位置**：`pinia-plugin-persistedstate/nuxt` 預設 storage 是 **cookie**（SSR 可讀），不是 localStorage。
> **禁止**在註解或 middleware 寫「登入狀態存 localStorage、SSR 讀不到」——錯誤心智模型會導致 hydration mismatch
> （見 feature-to-ui `rules.md` > SSR / Hydration 安全）。cookie 上限 4KB：`pick` 只挑必要欄位，大型物件不進 persist。

> ⚠️ **錯誤捕捉**：`try { await login() } catch (e) { toast.add({ title: '登入失敗', description: readApiError(e, '帳號或密碼錯誤'), color: 'error' }) }`（`readApiError` 來自 `~/utils/api-error`，見 [openapi-conventions.md](openapi-conventions.md) §4）
