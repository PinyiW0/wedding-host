# Phase 1.5: Client API Layer

> 依據 `route-map.yaml > api_contract` + `app/types/api/*.ts`，自動產生 `app/api/*.api.ts` typed client 包裝層。
>
> **這層是前端呼叫 API 的唯一入口**：store / page / component 只 import `app/api/*.api.ts` 的 function，不直接寫 `useHttp` 路徑字串，避免 endpoint 散落各處。

---

## 必讀規範

```
僅需讀取：
- ../references/openapi-conventions.md（命名、HTTP method、path 樣式）
- app/types/api/*.ts（Phase 0 已建立，作為 function signature 來源）
- spec/report/route-map.yaml > api_contract.path_prefix
- spec/report/route-map.yaml > api_contract.endpoints
- app/composables/useHttp.ts（理解 useHttp().get / getOnce / post / put / patch / delete 的 options 形態，型別 HttpGetOptions / HttpRequestOptions）

Sync 模式額外讀取：
- 既有 app/api/*.api.ts（比對是否已有對應 function）
- spec/report/sync-report.md（端點變更段落）
```

> ⚠️ **Phase 1.5 不能跑在 Phase 0 / 1 之前**，因為它依賴 `route-map.yaml` 與 `app/types/api/*.ts`。

---

## 統一 HTTP 入口（單一 useHttp）

所有 client 呼叫只走一個 composable —— `useHttp()`，共用 `runtimeConfig.public.apiBase` 這個 domain。path 替換、baseURL 由 `useHttp` 內部統一處理，無副作用（本模板不含 auth / 401 / envelope）。

```
useHttp().get        ← page 層用，useFetch，SSR-friendly，reactive url，回 AsyncData
useHttp().getOnce    ← imperative 讀取，$fetch，回 Promise（Blob 下載、handler 內抓一次）
useHttp().post/put/patch/delete ← 寫入，$fetch，回 Promise
```

| 場景 | 用什麼 | 理由 |
|---|---|---|
| **GET 列表 / 詳情**（頁面載入時呼叫） | `useHttp().get` | useFetch：SSR、reactive url、auto-cancel |
| **POST / PATCH / DELETE**（寫入） | `useHttp().{method}` | 寫入永遠用 `$fetch`，不可用 `useFetch`（會在 SSR 重複觸發） |
| **登入 / 註冊**（POST） | `useHttp().post` | 與一般寫入相同（模板無 auth 層，不需特別處理 401） |
| **Blob 下載 / 二進位、event handler 內抓一次** | `useHttp().getOnce` + `responseType: 'blob'` | imperative GET 走 `$fetch`，`useFetch` 不能在 handler 內呼叫 |

> ⚠️ **嚴禁** 在產出的 `*.api.ts` 中：
> - 直接寫 `$fetch(...)`（必須走 `useHttp().{method}` / `getOnce`）
> - 直接寫 `useFetch(...)`（必須走 `useHttp().get`，否則沒帶 baseURL）
> - 寫絕對 URL（host 由 env 注入）

---

## 函式命名規則

| Endpoint pattern | Function name | 範例 |
|---|---|---|
| `GET /{resource}` | `list{Resource}` | `listTeams`, `listPlayers` |
| `GET /{resource}/{id}` | `get{Resource}` | `getTeam`, `getPracticeDetail` |
| `POST /{resource}` | `create{Resource}` | `createTeam`, `createPlayer` |
| `PATCH /{resource}/{id}` | `update{Resource}` | `updateTeam`, `updatePlayer` |
| `DELETE /{resource}/{id}` | `delete{Resource}` | `deleteTeam`, `deletePlayer` |
| `POST /{resource}/{id}/{action}` | `{action}{Resource}` | `endPractice`, `favoritePitch`, `unfavoritePitch` |
| `PATCH /{resource}/{id}/{action}` | `{action}{Resource}` | `changeAccountPassword`, `resetAccountPassword` |
| `POST /auth/login` | `login{Subject}` | `loginCoach`, `loginAdmin` |

> 命名遵循「動詞 + 資源」。多字資源用 PascalCase 連寫（`PracticePitch` 不是 `Practice_Pitch`）。

---

## 輸出模板（逐 endpoint）

### GET 列表（reactive，主流用法）

```typescript
import type { TeamListItem } from '~/types/api/teams'
import type { HttpGetOptions } from '~/composables/useHttp'
import { useHttp } from '~/composables/useHttp'

export function listTeams(options?: HttpGetOptions<TeamListItem[]>) {
  return useHttp().get<TeamListItem[]>('/api/v1/teams', options)
}
```

### GET 列表（含 path param，需 reactive url）

```typescript
import type { MaybeRefOrGetter } from 'vue'

export function listPracticePitches(
  practiceId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<PracticePitchItem[]>,
) {
  return useHttp().get<PracticePitchItem[]>(
    () => `/api/v1/practices/${toValue(practiceId)}/pitches`,
    options,
  )
}
```

> ⚠️ path param 用 reactive 時必須包成 getter 函式（`() => ...`），不可寫字串拼接 `/api/v1/practices/${practiceId}/pitches`（會在 ref 變動時不會重抓）。

### GET 詳情

```typescript
export function getPracticeDetail(
  practiceId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<PracticeDetail>,
) {
  return useHttp().get<PracticeDetail>(
    () => `/api/v1/practices/${toValue(practiceId)}`,
    options,
  )
}
```

### POST 建立

```typescript
import type { CreateTeamBody, TeamCreatedEvent } from '~/types/api/teams'
import { useHttp } from '~/composables/useHttp'

export function createTeam(body: CreateTeamBody) {
  return useHttp().post<TeamCreatedEvent>('/api/v1/teams', { body })
}
```

### PATCH 更新（含 path param）

```typescript
export function updatePlayer(playerId: string, body: UpdatePlayerBody) {
  return useHttp().patch<PlayerUpdatedEvent>('/api/v1/players/{playerId}', {
    pathParams: { playerId },
    body,
  })
}
```

> ⚠️ path 字串保留 `{paramName}` 原樣，path 變數透過 `pathParams` 物件傳入（由 `useHttp` 內部 path 替換處理）。**不要寫 `/api/v1/players/${playerId}`** —— 失去 endpoint template 的可追蹤性。

### DELETE 軟刪除

```typescript
export function deleteTeam(teamId: string) {
  return useHttp().delete<void>('/api/v1/teams/{teamId}', {
    pathParams: { teamId },
  })
}
```

> 軟刪除 server 回 204 無 body，回傳型別寫 `void`（即使型別檔有定義 `TeamDeletedEvent`，server 也不會回）。

### 動作端點（POST /resource/{id}/{action}）

```typescript
export function endPractice(practiceId: string) {
  return useHttp().post<PracticeEndedEvent>(
    '/api/v1/practices/{practiceId}/end',
    { pathParams: { practiceId } },
  )
}

export function favoritePitch(practiceId: string, pitchId: string) {
  return useHttp().post<PitchFavoritedEvent>(
    '/api/v1/practices/{practiceId}/pitches/{pitchId}/favorite',
    { pathParams: { practiceId, pitchId } },
  )
}
```

### PATCH 動作（含 body）

```typescript
export function changeAccountPassword(
  accountId: string,
  body: ChangePasswordBody,
) {
  return useHttp().patch<AccountPasswordChangedEvent>(
    '/api/v1/accounts/{accountId}/change-password',
    {
      pathParams: { accountId },
      body,
    },
  )
}
```

### 登入端點

```typescript
export function loginCoach(body: LoginBody) {
  return useHttp().post<CoachLoggedInEvent>('/api/v1/auth/login', { body })
}
```

> ℹ️ 本模板不含 auth / 401 攔截層，登入與一般寫入一樣用 `useHttp().post`。若日後加入 auth（token 注入 / 401 refresh），請在 `useHttp` 內以 `onRequest` / `onResponse` hook 擴充，並為「不需 token 即可呼叫」的端點（login / register）保留略過攔截的選項，不要散落在各 `*.api.ts`。

### Blob 下載（imperative GET，走 getOnce）

```typescript
export function getPitchVideo(
  practiceId: string,
  pitchId: string,
  angle?: 'front' | 'side',
) {
  return useHttp().getOnce<Blob>(
    '/api/v1/practices/{practiceId}/pitches/{pitchId}/video',
    {
      pathParams: { practiceId, pitchId },
      query: angle ? { angle } : undefined,
      responseType: 'blob',
    },
  )
}
```

> ⚠️ Blob 下載、或任何「在 event handler 裡抓一次」的 GET **一律用 `getOnce`**（`$fetch`），不可用 `get`（`useFetch` 只能在 setup 階段呼叫、會跟著 SSR 跑）。實際下載流程（`URL.createObjectURL` → `<a download>` → `revokeObjectURL`）寫在呼叫端的 handler，不在 `*.api.ts` 內。

---

## 檔案組織

```
app/api/
├── index.ts                  # 統一 re-export 所有 function
├── auth.api.ts               # login / register
├── accounts.api.ts           # /accounts/*
├── teams.api.ts              # /teams/*
├── players.api.ts            # /players/*
├── practices.api.ts          # /practices（不含子資源）
├── pitches.api.ts            # /practices/*/pitches/* （子資源獨立成檔）
├── cameras.api.ts            # /cameras/*
└── exports.api.ts            # /exports
```

### 分檔規則

- **一個資源一個檔**：`/teams` 與 `/teams/{id}/...` 全部進 `teams.api.ts`
- **子資源獨立成檔**：若子資源端點 ≥ 3 個（如 `/practices/{id}/pitches/*`），抽到 `{subresource}.api.ts`（避免父檔過大）
- **動作端點歸屬主資源**：`/practices/{id}/end` 進 `practices.api.ts`、`/accounts/{id}/change-password` 進 `accounts.api.ts`
- **`auth` 永遠獨立**：登入相關全部進 `auth.api.ts`

### index.ts 範例

```typescript
export {
  changeAccountPassword,
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  updateAccountRemark,
} from './accounts.api'
export { loginCoach } from './auth.api'
export { listCameras, registerCamera, updateCameraStatus } from './cameras.api'
// ...
```

> ⚠️ export 列表按字母排序（perfectionist eslint 規則會自動修），新增端點時記得補上對應名稱。

---

## 增量模式判斷

Phase 1.5 開始前，先掃描 `app/api/` 是否存在檔案：

| 條件 | 模式 | 行為 |
|---|---|---|
| `app/api/` 不存在或為空 | **全量模式** | 依 `route-map.yaml > api_contract.endpoints` 全產 |
| `app/api/*.api.ts` 已有檔 | **Sync 模式** | 比對 endpoint vs function，補缺漏、標漂移、不刪 |

### Sync 模式步驟

1. **讀取 `route-map.yaml > api_contract.endpoints`** 取得期望的 endpoint 清單（method + path + 回應 type）
2. **掃描 `app/api/*.api.ts`** 萃取既有 function 清單（function name + path + method + return type）
3. **三方比對**：
   - **缺漏** → 期望有但 codebase 沒 → 新增 function
   - **漂移** → codebase 有但期望沒（feature 已移除 / endpoint 改名） → **不自動刪**，列入 `sync-report.md > Client 層孤兒` 段
   - **型別不一致** → endpoint 存在但 return type 與 `app/types/api/*.ts` 不一致 → 更新 function 簽名
4. **更新 `app/api/index.ts`** 的 re-export 列表（新增 export，**不自動刪除已被標為孤兒的 export**）
5. **輸出補丁報告**附在 `sync-report.md` 末段

### 漂移報告格式

```markdown
## Client 層漂移（手動處理）

| Function | 狀態 | 建議動作 |
|---|---|---|
| `switchPracticePitcher` | 🟡 endpoint 已從 route-map 移除 | 確認 feature 是否真已移除，若是請手動刪除此 function 與其 import |
| `fetchPracticePitches` | 🟢 額外保留（route-map 無此「imperative GET 版本」標記，但 store 需要） | 保留，無須處理 |
```

> ⚠️ **絕不靜默刪除既有 function**——一旦刪除，所有 import 它的 store / page / component 會立即 typecheck 失敗，使用者無從追溯。永遠列在報告讓使用者自己決定。

---

## 自我檢查清單（產出前必跑）

- [ ] 每個 `route-map.yaml > api_contract.endpoints` 的端點都有對應 export function
- [ ] 函式名稱遵循「動詞 + 資源」命名表（list/get/create/update/delete/{action}）
- [ ] GET 列表 / 詳情（頁面載入）→ 使用 `useHttp().get`
- [ ] Blob 下載 / handler 內抓一次的 GET → 使用 `useHttp().getOnce` + `responseType`
- [ ] POST / PATCH / DELETE → 使用 `useHttp().{method}`
- [ ] login / register → `useHttp().post`（模板無 auth 層，不加 `handleUnauthorized`）
- [ ] 沒有任何 `$fetch(` 或 `useFetch(` 直接呼叫（grep 應為 0）
- [ ] 沒有殘留 `useApiFetch` / `useApiFetchAll` / `apiFetch`（grep 應為 0）
- [ ] 沒有絕對 URL：`grep -rE "https?://" app/api/` 為 0
- [ ] 所有 path 含參數時保留 `{paramName}` template 並用 `pathParams` 物件傳值
- [ ] reactive url（含 ref param）一律包成 getter `() => ...`
- [ ] 軟刪除 function 的回傳型別寫 `void`（即使有 `XxxDeletedEvent` 型別）
- [ ] Blob 下載端點加 `responseType: 'blob'`
- [ ] `app/api/index.ts` 已更新 re-export 列表
- [ ] Sync 模式下：漂移項目已列在 `sync-report.md`，未靜默刪除

---

## 與其他 Phase 的銜接

```
Phase 0    → app/types/api/*.ts + route-map.yaml
   ↓
Phase 1    → server/api/**/*.ts + server/mock/data/*.ts（mock 端點）
   ↓
Phase 1.5  → app/api/*.api.ts（client wrapper）  ← 本 Phase
   ↓
（人工 / /feature-to-ui） → stores、pages、components 直接 import `~/api`
```

> Phase 1.5 完成後，所有後續 store / page 應該**只 import `~/api`**，禁止再直接寫 `useHttp` / `$fetch`（除非是 `~/api` 本身的內部實作）。

完成提示：「Phase 1.5 完成。下一步：`/test e2e`（偵測 E2E 狀態並產出執行計畫）」
