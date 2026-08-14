# Phase 1.5: Client API Layer

> 依據 `route-map.yaml > api_contract` + `app/types/api/*.ts`，自動產生 `app/api/*.api.ts` typed client 包裝層。
>
> **這層是前端呼叫 API 的唯一入口**：store / page / component 只 import `app/api/*.api.ts` 的 function，不直接寫 `useHttp` 路徑字串，避免 endpoint 散落各處。

---

## 必讀規範

```
僅需讀取：
- ../references/openapi-conventions.md（命名、HTTP method、path 樣式）
- app/types/api/*.ts（Phase 0 已建立，作為 function signature 來源；OpenAPI 模式下為 `_schema.d.ts` 的 view alias，見 ../references/openapi-codegen.md）
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

所有 client 呼叫只走一個 composable —— `useHttp()`，共用 `runtimeConfig.public.apiBase` 這個 domain。path 替換、baseURL、envelope 拆封由 `useHttp` 內部統一處理（envelope 預設拆、`apiEnvelope=false` 可關；本模板尚不含 auth / 401，由 auth scaffold 偵測到登入需求時注入）。

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

> ⚠️ 以下範例一律用**假想的 notes 領域**（notebooks / notes / members / tags / attachments）示意，**不是本專案的實際端點**。實際產出以 `route-map.yaml > api_contract.endpoints` 為準，禁止照抄範例路徑。
>
> **唯一例外**：`/auth/login`（見下方命名表與「登入端點」段）刻意沿用跨專案通用的登入慣例，因此與 `spec/api/api-spec.yml` 的實際端點同名。它示範的是**命名規則**（`login{Subject}`），不是本專案的授權模型——實際路徑仍以 `route-map.yaml` 為準。

| Endpoint pattern | Function name | 範例 |
|---|---|---|
| `GET /{resource}` | `list{Resource}` | `listNotebooks`, `listNotes` |
| `GET /{resource}/{id}` | `get{Resource}` | `getNotebook`, `getNoteDetail` |
| `POST /{resource}` | `create{Resource}` | `createNotebook`, `createNote` |
| `PATCH /{resource}/{id}` | `update{Resource}` | `updateNotebook`, `updateNote` |
| `DELETE /{resource}/{id}` | `delete{Resource}` | `deleteNotebook`, `deleteNote` |
| `POST /{resource}/{id}/{action}` | `{action}{Resource}` | `archiveNote`, `pinNote`, `unpinNote` |
| `PATCH /{resource}/{id}/{action}` | `{action}{Resource}` | `moveNote`, `renameNotebook` |
| `POST /auth/login` | `login{Subject}` | `loginMember`, `loginAdmin` |

> 命名遵循「動詞 + 資源」。多字資源用 PascalCase 連寫（`NotebookNote` 不是 `Notebook_Note`）。

---

## 輸出模板（逐 endpoint）

### GET 列表（reactive，主流用法）

```typescript
import type { NotebookListItem } from '~/types/api/notebooks'
import type { HttpGetOptions } from '~/composables/useHttp'
import { useHttp } from '~/composables/useHttp'

export function listNotebooks(options?: HttpGetOptions<NotebookListItem[]>) {
  return useHttp().get<NotebookListItem[]>('/api/v1/notebooks', options)
}
```

### GET 列表（含 path param，需 reactive url）

```typescript
import type { MaybeRefOrGetter } from 'vue'

export function listNotebookNotes(
  notebookId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<NotebookNoteItem[]>,
) {
  return useHttp().get<NotebookNoteItem[]>(
    () => `/api/v1/notebooks/${toValue(notebookId)}/notes`,
    options,
  )
}
```

> ⚠️ path param 用 reactive 時必須包成 getter 函式（`() => ...`），不可寫字串拼接 `/api/v1/notebooks/${notebookId}/notes`（會在 ref 變動時不會重抓）。

### GET 詳情

```typescript
export function getNoteDetail(
  noteId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<NoteDetail>,
) {
  return useHttp().get<NoteDetail>(
    () => `/api/v1/notes/${toValue(noteId)}`,
    options,
  )
}
```

> 💡 **資料新鮮度**：`get()` 回傳的是 `AsyncData`，本來就帶 `refresh`。頁面需要「寫入後刷新」時，
> 解構出 `refresh` 即可（`const { data, refresh } = listNotebooks({ key: 'notebooks' })`），寫入成功後 `await refresh()`。
> 跨元件刷新傳穩定 `key` 並用 `refreshNuxtData(key)`。詳見 feature-to-ui `page-builder.md` 的「資料新鮮度」段。
> client function **不需**自己包刷新邏輯——保持薄包裝，刷新由呼叫端（page）決定時機。

### POST 建立

```typescript
import type { CreateNotebookBody, NotebookCreatedEvent } from '~/types/api/notebooks'
import { useHttp } from '~/composables/useHttp'

export function createNotebook(body: CreateNotebookBody) {
  return useHttp().post<NotebookCreatedEvent>('/api/v1/notebooks', { body })
}
```

### PATCH 更新（含 path param）

```typescript
export function updateNote(noteId: string, body: UpdateNoteBody) {
  return useHttp().patch<NoteUpdatedEvent>('/api/v1/notes/{noteId}', {
    pathParams: { noteId },
    body,
  })
}
```

> ⚠️ path 字串保留 `{paramName}` 原樣，path 變數透過 `pathParams` 物件傳入（由 `useHttp` 內部 path 替換處理）。**不要寫 `/api/v1/notes/${noteId}`** —— 失去 endpoint template 的可追蹤性。

### DELETE 軟刪除

```typescript
export function deleteNotebook(notebookId: string) {
  return useHttp().delete<void>('/api/v1/notebooks/{notebookId}', {
    pathParams: { notebookId },
  })
}
```

> 軟刪除 server 回 204 無 body，回傳型別寫 `void`（即使型別檔有定義 `NotebookDeletedEvent`，server 也不會回）。

### 動作端點（POST /resource/{id}/{action}）

```typescript
export function archiveNote(noteId: string) {
  return useHttp().post<NoteArchivedEvent>(
    '/api/v1/notes/{noteId}/archive',
    { pathParams: { noteId } },
  )
}

export function pinNote(notebookId: string, noteId: string) {
  return useHttp().post<NotePinnedEvent>(
    '/api/v1/notebooks/{notebookId}/notes/{noteId}/pin',
    { pathParams: { notebookId, noteId } },
  )
}
```

### PATCH 動作（含 body）

```typescript
export function moveNote(
  noteId: string,
  body: MoveNoteBody,
) {
  return useHttp().patch<NoteMovedEvent>(
    '/api/v1/notes/{noteId}/move',
    {
      pathParams: { noteId },
      body,
    },
  )
}
```

### 登入端點

```typescript
export function loginMember(body: LoginBody) {
  return useHttp().post<MemberLoggedInEvent>('/api/v1/auth/login', { body })
}
```

> ℹ️ 模板預設 auth 中立，登入與一般寫入一樣用 `useHttp().post`。偵測到 auth 時**不要自行在 `useHttp` 擴充攔截**——`useHttp` 已內建 Authorization / 401→refresh→retry 注入點，照 [auth-scaffold.md](auth-scaffold.md) §3a 覆蓋 `useHttpAuth.ts` 提供 handler 即啟用；login / refresh / logout 等免 token 端點以 `handleUnauthorized:false` 略過攔截（同見 §3a），不要散落在各 `*.api.ts`。

### Blob 下載（imperative GET，走 getOnce）

```typescript
export function getNoteAttachmentFile(
  noteId: string,
  attachmentId: string,
  variant?: 'thumbnail' | 'original',
) {
  return useHttp().getOnce<Blob>(
    '/api/v1/notes/{noteId}/attachments/{attachmentId}/file',
    {
      pathParams: { noteId, attachmentId },
      query: variant ? { variant } : undefined,
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
├── members.api.ts            # /members/*
├── notebooks.api.ts          # /notebooks（不含子資源）
├── notes.api.ts              # /notebooks/*/notes/* 與 /notes/*（子資源獨立成檔）
├── tags.api.ts               # /tags/*
└── attachments.api.ts        # /notes/*/attachments/*
```

### 分檔規則

- **一個資源一個檔**：`/notebooks` 與 `/notebooks/{id}/...` 全部進 `notebooks.api.ts`
- **子資源獨立成檔**：若子資源端點 ≥ 3 個（如 `/notebooks/{id}/notes/*`），抽到 `{subresource}.api.ts`（避免父檔過大）
- **動作端點歸屬主資源**：`/notes/{id}/archive` 進 `notes.api.ts`、`/notebooks/{id}/rename` 進 `notebooks.api.ts`
- **`auth` 永遠獨立**：登入相關全部進 `auth.api.ts`

### index.ts 範例

```typescript
export { loginMember } from './auth.api'
export {
  createMember,
  deleteMember,
  listMembers,
  updateMemberRole,
} from './members.api'
export { archiveNote, listNotebookNotes, moveNote } from './notes.api'
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
| `switchNotebookOwner` | 🟡 endpoint 已從 route-map 移除 | 確認 feature 是否真已移除，若是請手動刪除此 function 與其 import |
| `fetchNotebookNotes` | 🟢 額外保留（route-map 無此「imperative GET 版本」標記，但 store 需要） | 保留，無須處理 |
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
