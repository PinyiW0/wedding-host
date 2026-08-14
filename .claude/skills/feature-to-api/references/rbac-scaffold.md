# RBAC Scaffold（條件式授權守門）

> **SDD workflow 對授權中立**：template 預設不帶角色守門。**只有偵測到角色分層 / 權限限制時**才套用本 scaffold。
> 無角色訊號的專案（單一身分、人人權限相同）一個 rbac 字都不生。
>
> **本檔是授權（authorization / RBAC）的 SSOT / 契約**：偵測規則、route-map.rbac schema、mock 守門範本、檔案落點。
> 與 `auth-scaffold.md` 是**姊妹關注點**：auth 管「你是誰」（認證 / token 生命週期），rbac 管「你能做什麼」（角色 → 端點 / 列表 / 路由）。**rbac 以 auth 為前提**——偵測到 rbac 必同時需要 auth（沒有登入主體就無從判角色）。
>
> 範本沿「消費階段」分流：**API 層由 feature-to-api 套用（範本在 §3a）**、**UI 層由 feature-to-ui 套用（§3b 指路）**。

---

## 觸發與消費鏈（一覽）

> 全貌索引；偵測在 **Phase 0**、SoT 是 **`route-map.rbac`**、下游讀到才消費。細節見各段與下游 phase 的 reference。

```text
flow  P0  立角色可見性不變式
api   P0  【主偵測】寫 route-map.rbac  ← SoT
api   P1  mock 套 requireRole / requireOwnership / ownership 過濾（§3a）
spec      產多角色登入 + 拒絕場景：403 / 導離 / BOLA
ui    P2  rbac.global.ts 路由守門（§3b）
ui    P5  入口 / 按鈕 v-if 角色隱藏（§3b）
```

**無 `rbac` 區塊 → 全部略過（中立預設）。**

> **守門落點（別越層）**：middleware 只管**路由級**（`protected_routes`）；**端點級**（BFLA）與**物件級**（BOLA）都在 API（`requireRole` / `requireOwnership`）—— BOLA 不放 middleware（導航階段不知道要動哪一筆 object）。**JWT 只負責認證**，roles 經 `/auth/me` 單向流入 `authStore.roles`，前端不解 JWT。

---

## 1. 偵測（語意判準；grep 訊號起手，AI 依現況收尾）

判準是**語意**——「這份 spec 描述的是一個**不同角色看到 / 能做的事不一樣**的 app 嗎」，不是「有沒有出現某個字串」。下表訊號是**常見範例非窮舉白名單**，命名不同但語意相同一樣命中。命中任一即視為「有角色分層」：

| 來源 | 訊號（範例，依語意判斷） |
|---|---|
| OpenAPI `spec/api/api-spec.yml` | 端點 description 含「僅 X 可操作 / X 不得 / X 才能」這類**操作者角色限制**散文（→ `endpoints`）；含「只能讀 / 改 / 刪**自己的** X」「不得存取**他人** Y」這類**單筆歸屬**散文，尤其在 `/{id}` 端點（→ `object_ownership`，BOLA）；schema 有 `roles` 列舉欄位（值如 `workspace_owner` / `member` / `admin` / `viewer`，皆範例）；`403` 回應帶 `errorCode`（語意為權限不足） |
| `.feature` / `.flow.md` | 不同身分操作同一資源有不同結果（「以工作區擁有者登入」vs「以一般成員登入」看到的清單 / 可按的鈕不同）、「無權限」「僅…可」「被拒」、「只能操作自己的」這類語意 scenario |

偵測到 → 寫入 `route-map.yaml > rbac`（§2）並套用 §3。**沒偵測到 → 完全略過本檔。** 訊號模糊、角色命名超出範例、或來源互相矛盾（散文說「僅工作區擁有者」但 feature 卻讓一般成員操作）時 → **不默默猜、也不硬比字面，列出研判與操作者確認再定**（與 `phase-0-prep.md`「偵測總則」一致）。

> ⚠️ **`security: []` 落差是 auth 訊號、不是 rbac 訊號**：端點間「免認證（`security: []`）vs 全域 bearer」的差別只代表「要不要登入」，與「登入後不同角色能做的事不同」無關。一份有公開端點（health / login / 內網 webhook / token-query SSE）卻無角色分層的 spec，rbac 仍應略過。認證的偵測與 scaffold 歸 `auth-scaffold.md`——別把登入與否的落差當角色訊號（這是 dogfood 流星觀測 spec 校出的破口：該 spec 多個 `security: []` 端點全是免認證，無一是角色分層）。

> ⚠️ **授權分四層，「自己 / own」語意尤其要分辨型別**——對照 [OWASP API 授權兩類漏洞 BFLA / BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)：
> - **① 端點存取**（→ `endpoints`，擋 OWASP **BFLA**）：「僅 X 角色可進這個功能」——看**角色**，`requireRole` 擋。
> - **② 列表級 ownership**（→ `ownership`）：「X 角色**只看自己建立的清單**」——對 GET 列表主動過濾，避免列表回傳他人資料。
> - **③ 單筆 object 歸屬**（→ `object_ownership`，擋 OWASP **BOLA / API #1**）：「只能讀 / 改 / 刪**自己的那一筆** `/{id}`」——角色對、端點對，但帶他人 id 不該成功。看**這筆資料的擁有者**，`owner !== me → 403`。**這層要自動生**（§2 ③、§3a），最常被漏，卻是 OWASP 排名第 1 的 API 漏洞。
> - **④ 動作級 self-scope**（→ `business_guards`，**不自動生、手寫**）：「`member` 改自己密碼**且需 oldPassword**、`workspace_owner` 改他人免帶」這種**歸屬 + 額外 domain 條件**的混合。
>
> 判型訣竅：純「這筆是不是我的」→ `object_ownership`（自動生）；「是不是我的 **且** 還要滿足別的條件（舊密碼、最後一個 admin…）」→ `business_guards`（手寫）。真實 spec 常 `ownership` 空、但可能有 `object_ownership`——別看到「自己」就一律塞列表過濾。



> ⚠️ **角色名與資源名一律從 spec 萃取，不寫死**。判準是**語意角色**（受限 vs 全權、哪些角色被 allow），非字面值。
>
> 本檔所有範例一律用**假想的 `workspace_owner`（全權）/ `member`（受限）**兩角色、與**假想的 members / notes 領域**（沿用 [phase-1-5-client-api.md](phase-1-5-client-api.md) 的 notes 領域宣告），**皆非本專案的實際端點與角色**。
>
> **為什麼刻意避開本 repo dogfood spec（流星觀測）的實際值**：範例若與「在本 repo 跑 `/feature-to-api` 應得的正確產出」同形，讀者就無從分辨哪句是示意、哪句是答案——照抄即產出**憑空的假權限**。故本檔範例與真實 spec **零撞名**；真實 spec 的值只在標明為「對照組 / 流星觀測 spec 的實際萃取值」時被指涉（見 §2 的 `ownership` / `object_ownership` 註解），那些地方是在論證「實際萃取結果就是空」，不是可照抄的範例。
>
> **例外——刻意保留真名，因為是「契約本身」而非領域範例**：
> - `/auth/me`（roles 的來源，見開頭守門落點與 §3 前提）屬 auth 契約，由 [auth-scaffold.md](auth-scaffold.md) 定義、本檔只消費；與真實 spec 同名是刻意的。（`openapi-codegen.md` 檔頭有同款的 envelope／auth 例外聲明。）
> - **識別欄位 `accountId` / `account`**：屬 auth 契約（`getMockCurrentUser` 回的 `MockCurrentUser.accountId`、mock token 的 `mock-token-${accountId}`、`requireOwnership` 比對的也是它），不隨資源改名。所以 members 的端點是 `/api/v1/members/{accountId}` 而**非** `{memberId}`——這是刻意的，不是漏改：種子、token 解析、`requireOwnership` 全都以 `accountId` 為鍵，改成 `memberId` 會讓四處一起脫鉤。對照 `/api/v1/notes/{noteId}`：notes 是純假想資源、沒有 auth 契約綁定，param 名才跟著資源走。

---

## 2. route-map.yaml 的 `rbac` 區塊（持久化事實，跨 phase 對照）

這是授權的**單一真理**。phase-0 偵測寫入後，下游 mock / spec / ui **一律讀此區塊**，不再各自從 `.feature` / OpenAPI 散文重新偵測（避免漂移）。

```yaml
rbac:
  required: true
  roles: # 從 roles enum + 散文萃取的角色全集（語意，非寫死）
    - workspace_owner
    - member

  # ① 端點存取控制：列出「有角色限制」的端點 → 允許角色清單
  #    未列入的端點 = 任意已登入者皆可（不過度限制）
  #    來源：description「僅 X 可操作」這類散文
  endpoints:
    - { method: GET, path: /api/v1/members, allow: [workspace_owner], message: 僅 workspace_owner 可操作 }
    - { method: POST, path: /api/v1/members, allow: [workspace_owner] }
    - { method: PATCH, path: /api/v1/members/{accountId}, allow: [workspace_owner] }
    - { method: DELETE, path: /api/v1/members/{accountId}, allow: [workspace_owner] }

  # ② 擁有權過濾（列表級 ACL）：受限角色只看自己建立的資料
  #    來源：spec / feature 明說「X 只能看自己建立的 / 名下的」這類語意
  #    owner_field = mock data 需含的擁有者欄位；restricted_roles = 被限縮的角色（其餘角色全量）
  #    ⚠️ 這是最少見的一型——多數 spec（凡「純 gating」「只有改密 self-scope」者）此區塊就是空陣列。
  #       【對照組】本 repo dogfood 的流星觀測 spec，實際萃取值就是 ownership: []
  #       （其 sites / stations 皆全量查詢、無「只看自己建立的」散文）——此處是在論證「實際結果就是空」，不是可照抄的範例。
  #       ❗別把真實端點名安上 ownership：下方假想例的 notes 純為示意 schema 形狀；
  #       把一個沒有 ownership 散文的真實端點硬安成 ownership = 憑空造假權限，正是 dogfood 校出的破口。
  #       只有 spec 真的寫「只看自己建立的列表」才填。
  ownership: [] # 多數專案的實際值（含上述流星觀測對照組）；下行假想例僅示意 schema、勿照抄
  #   假想例（若某 spec 寫「一般成員只看自己建立的 notes」才會長這樣）：
  #   - { method: GET, path: /api/v1/notes, owner_field: createdBy, restricted_roles: [member] }

  # ③ 單筆 object 歸屬檢查（OWASP API #1 BOLA）：受限角色操作 /{id} 單筆資源時，驗證這筆屬於自己
  #    來源：spec 明說「只能讀 / 改 / 刪自己的 X」「不得存取他人 Y」這類「單筆歸屬」散文（多在 /{id} 端點）
  #    與 ② 的差別：② 是 GET 列表主動只回自己的；③ 是 GET/PATCH/DELETE /{id} 單筆，角色對、端點對，但帶他人 id → 拒
  #    owner_field = 被操作資源的擁有者欄位；restricted_roles = 受此限的角色（全權角色不檢查）
  #    notfound: true 時改回 404（不洩漏「該筆存在但你無權」，OWASP 建議之一；預設 403）
  #    ⚠️ 【對照組】流星觀測 spec 的實際值也是空——它只有「全權角色 gating（→endpoints）+ 改密 self-scope（→business_guards）」，
  #       無 per-object ownership。同上，這是論證「實際結果就是空」，不是可照抄的範例。
  #       照「偵測到才生」：spec 真的寫「只能動自己的單筆」才填，別憑空加（憑空加 = 假權限）。
  object_ownership: [] # 多數專案的實際值（含上述流星觀測對照組）；下行假想例僅示意 schema
  #   假想例（若某 spec 寫「一般成員只能編輯 / 刪除自己建立的 note」才會長這樣）：
  #   - { method: PATCH, path: /api/v1/notes/{noteId}, owner_field: createdBy, restricted_roles: [member] }
  #   - { method: DELETE, path: /api/v1/notes/{noteId}, owner_field: createdBy, restricted_roles: [member] }

  # ④ 受角色保護的前端路由：feature-to-ui 據此做「入口隱藏 + 路由守門」
  protected_routes:
    - { path: /members, allow: [workspace_owner] }

  # ⑤ 業務守衛（僅登錄，不自動 scaffold）：太 domain-specific 的規則，留 feature/spec 散文實作
  #    供 spec 撰寫者與人工 review 參照，提醒「這條規則存在、別漏測」
  business_guards:
    - { rule: 不得刪除最後一個 active workspace_owner, endpoint: DELETE /api/v1/members/{accountId}, errorCode: CANNOT_DELETE_LAST_OWNER, http: 409 }
    - { rule: workspace_owner 不得以改密 API 變更自己密碼, endpoint: POST /api/v1/members/{accountId}/password, errorCode: CANNOT_CHANGE_OWN_PASSWORD_VIA_ADMIN, http: 403 }
```

| 子區塊 | 消費者 | 用途 |
|---|---|---|
| `roles` | spec（loginAs 每角色）、ui（v-if 判斷） | 角色全集 |
| `endpoints` | mock（requireRole → 403）、spec（拒絕場景） | 端點級存取控制 |
| `ownership` | mock（列表過濾）、spec（依角色推算斷言值） | 列表級 ACL |
| `object_ownership` | mock（單筆 owner 檢查 → 403/404）、spec（BOLA 拒絕場景） | 單筆 object 級 ACL（OWASP API #1） |
| `protected_routes` | ui（rbac.global.ts 守門 + 入口隱藏）、spec（打 URL → 導向） | 前端路由守門 |
| `business_guards` | spec / 人工 | 只登錄，不自動生 |

---

## 3. 檔案落點與歸屬

| 檔案 | 範本位置 | 套用者 | 說明 |
|---|---|---|---|
| `server/mock/auth-context.ts` | §3a | feature-to-api | `getMockCurrentUser` / `requireRole`（token → 當前 mock 使用者 + roles）。**補上目前 phase-1-mock-api 引用卻未定義的橋接** |
| `server/mock/data/users.ts` | §3a | feature-to-api | mock 使用者帶 `roles: string[]`，每個 `rbac.roles` 至少一帳號 |
| `server/api/**/*.ts`（受限端點） | §3a | feature-to-api | handler 首行 `requireRole(event, allow)` |
| `app/middleware/rbac.global.ts` | §3b → feature-to-ui `phase-2-skeleton.md` | feature-to-ui | 路由守門（讀 `protected_routes`，受限角色導向 `/403`） |
| 入口 / 操作鈕 `v-if` 角色判斷 | §3b → feature-to-ui `rules.md` | feature-to-ui | 選單入口 / 按鈕依 `authStore.roles` 隱藏 |

> **前提**：rbac 必同時有 auth（見開頭）。`authStore.roles` 由 auth-scaffold 的 `fetchProfile()`（`/auth/me` 回 `roles`）填入——auth-scaffold 的 store 已含 `roles` ref，rbac 直接消費，**不另立 store**。

### 3a. API 層範本（feature-to-api 套用）

```ts
// server/mock/auth-context.ts —— 由 Bearer mock-token 反查當前 mock 使用者與其 roles
// mock 登入發的 token 形如 `mock-token-${accountId}-${timestamp}`（見 phase-1-mock-api.md 登入範例）。
// 這裡反向解析出 accountId，再從 mockUsers 查 roles。token 格式若改，這裡的解析要對齊。
import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { mockUsers } from './data/users'

export interface MockCurrentUser {
  accountId: string
  account: string
  roles: string[]
}

// regex 提到 module scope（避免每次呼叫重編譯；專案 eslint `e18e/prefer-static-regex` 要求）
const BEARER_PREFIX = /^Bearer\s+/i
// accountId 可能含連字號（如 acc-001），故「去頭 mock-token-、去尾 -數字時間戳」greedy 擷取，避免切錯
const MOCK_TOKEN_RE = /^mock-token-(.+)-\d+$/

function parseAccountId(event: H3Event): string | null {
  const raw = getHeader(event, 'authorization')?.replace(BEARER_PREFIX, '') ?? ''
  const m = raw.match(MOCK_TOKEN_RE)
  return m?.[1] ?? null
}

export function getMockCurrentUser(event: H3Event): MockCurrentUser | null {
  const accountId = parseAccountId(event)
  if (!accountId)
    return null
  const u = mockUsers.find(x => x.accountId === accountId && !x.deletedAt)
  return u ? { accountId: u.accountId, account: u.account, roles: u.roles } : null
}

// 端點級守門：當前角色不在 allow 內 → 403。allow 來自 route-map.rbac.endpoints[*].allow。
export function requireRole(event: H3Event, allow: string[], message = '權限不足'): MockCurrentUser {
  const user = getMockCurrentUser(event)
  if (!user || !user.roles.some(r => allow.includes(r)))
    throw createError({ statusCode: 403, statusMessage: message })
  return user
}

// 物件級守門（OWASP BOLA / API #1）：受限角色操作單筆資源時，驗證該筆屬於自己。
// owner = 被操作資源的擁有者 accountId；restrictedRoles 來自 route-map.rbac.object_ownership[*].restricted_roles。
// notFound=true → 回 404（不洩漏「該筆存在但你無權」，OWASP 建議）；否則 403。全權角色（不在 restrictedRoles）直接放行。
export function requireOwnership(event: H3Event, owner: string, restrictedRoles: string[], opts: { notFound?: boolean } = {}): void {
  const user = getMockCurrentUser(event)
  const restricted = !!user && user.roles.some(r => restrictedRoles.includes(r))
  if (restricted && owner !== user!.accountId)
    throw createError({ statusCode: opts.notFound ? 404 : 403, statusMessage: opts.notFound ? '資源不存在' : '無權存取此資源' })
}
```

```ts
// server/mock/data/users.ts —— 每個 rbac.roles 至少一帳號（這是「看得到差異」的關鍵）
// ⚠️ 角色值為假想（workspace_owner / member）；實際用 route-map.rbac.roles 萃取出的角色詞。
export const mockUsers = [
  { accountId: 'acc-001', account: 'owner1', password: 'pass1234', name: '工作區擁有者', roles: ['workspace_owner'], deletedAt: null },
  { accountId: 'acc-002', account: 'member1', password: 'pass1234', name: '一般成員', roles: ['member'], deletedAt: null },
]
```

> ⚠️ **此種子與 [phase-1-mock-api.md](phase-1-mock-api.md)「Mock 資料範例」是同一個檔（`server/mock/data/users.ts`）的兩處示意**——那裡示範「登入要什麼欄位」、這裡示範「rbac 要多角色」。
>
> **目前兩處的角色值不一致**：本檔已中性化為 `workspace_owner` / `member`，`phase-1-mock-api.md` 仍是 流星觀測 spec 的實際角色（尚未中性化，收斂追蹤見 issue #103 §7）。
>
> **優先序無歧義：多角色種子以本檔 §3a 為準**——`phase-1-mock-api.md` 的「角色守門範例」段已明訂「完整範本（含多角色種子）見 rbac-scaffold.md §3a，**以該檔為唯一權威版本，勿在此複製**」。那邊「Mock 資料範例」的角色字面值屬已知待修的殘留複製品，**不要照抄**。

```ts
// server/api/v1/members/index.get.ts —— 受限端點：首行 requireRole 即擋
// ⚠️ members 為「假想資源」、workspace_owner / member 為「假想角色」，皆非本專案實際端點與角色。
//    此檔僅示意「rbac.endpoints 命中時」的寫法；實際端點與角色以 route-map.rbac 實列為準，勿照抄。
// 對應 route-map.rbac.endpoints: { GET /api/v1/members, allow: [workspace_owner] }
import type { H3Event } from 'h3'
import type { MemberListItem } from '../../../../app/types/api/members'
import { requireRole } from '../../../mock/auth-context'
import { mockUsers } from '../../../mock/data/users'

export default defineEventHandler((event: H3Event): MemberListItem[] => {
  requireRole(event, ['workspace_owner'], '僅 workspace_owner 可操作') // member 到這就 403
  return mockUsers
    .filter(u => !u.deletedAt)
    .map(u => ({ accountId: u.accountId, account: u.account, name: u.name, roles: u.roles }))
})
```

```ts
// server/api/v1/notes/index.get.ts —— ownership 過濾：受限角色只看自己建立的
// ⚠️ notes 為「假想資源」、member 為「假想角色」（對照組：流星觀測 spec 並無 ownership 端點，其 ownership: []）。
//    此檔僅示意「rbac.ownership 命中時」的寫法；真實專案請用 route-map.rbac.ownership 實際列出的端點，勿把無 ownership 散文的真實端點硬套。
// 對應 route-map.rbac.ownership: { GET /api/v1/notes, owner_field: createdBy, restricted_roles: [member] }
import type { H3Event } from 'h3'
import type { NoteListItem } from '../../../../app/types/api/notes'
import { getMockCurrentUser } from '../../../mock/auth-context'
import { mockNotes } from '../../../mock/data/notes'

export default defineEventHandler((event: H3Event): NoteListItem[] => {
  const me = getMockCurrentUser(event)
  let items = mockNotes.filter(n => !n.deletedAt)

  // 受限角色（restricted_roles）只看自己 createdBy 的；全權角色不過濾
  const restricted = ['member']
  if (me && me.roles.some(r => restricted.includes(r)))
    items = items.filter(n => n.createdBy === me.accountId)

  return items.map(n => ({ noteId: n.noteId, title: n.title }))
})
```

```ts
// server/api/v1/notes/[noteId].patch.ts —— 單筆 object 歸屬（OWASP BOLA）：受限角色帶他人 id → 403/404
// 對應 route-map.rbac.object_ownership: { PATCH /api/v1/notes/{noteId}, owner_field: createdBy, restricted_roles: [member] }
// ⚠️ notes 為假想資源、member 為假想角色（對照組：流星觀測 spec 的 object_ownership 為空）；真實專案用 route-map 實列端點與角色。
import type { H3Event } from 'h3'
import { getRouterParam, readBody } from 'h3'
import { requireOwnership } from '../../../mock/auth-context'
import { mockNotes } from '../../../mock/data/notes'

export default defineEventHandler(async (event: H3Event) => {
  const noteId = getRouterParam(event, 'noteId')
  // 順序很關鍵：先查到 object → 再驗歸屬 → 才動作。漏掉中間這步就是 BOLA。
  const note = mockNotes.find(n => n.noteId === noteId && !n.deletedAt)
  if (!note)
    throw createError({ statusCode: 404, statusMessage: '資源不存在' })

  requireOwnership(event, note.createdBy, ['member']) // member 帶他人 note id → 403（workspace_owner 全權放行）

  const body = await readBody(event)
  note.title = body.title ?? note.title
  return { noteId: note.noteId, title: note.title }
})
```

> ⚠️ **`server/api/` import 用相對路徑**（不能 `~/`）、**event 標 `H3Event`**、**錯誤用 `statusMessage`**——與 `rules.md` / `phase-1-mock-api.md` 既有規範一致。
> ⚠️ mock data 帶 `createdBy`（值為 accountId）在該資源出現在 `rbac.ownership` **或** `rbac.object_ownership` 時才需要；皆無則不加此欄。

### 3b. UI 層範本（feature-to-ui 套用）

- **`app/middleware/rbac.global.ts`**（路由守門）→ 範本見 feature-to-ui `references/phase-2-skeleton.md`「RBAC route guard」段。讀 `route-map.rbac.protected_routes`，當前角色不在 `allow` → `navigateTo('/403')`（never-nav-current、別導到自己造成 loop，比照 auth.global.ts）。
- **入口 / 操作鈕角色隱藏** → 規範見 feature-to-ui `references/rules.md`「角色導向 UI 可見性」段。選單入口與危險操作鈕用 `v-if="authStore.roles.includes('<role>')"` 隱藏。

> **雙層守門**：入口隱藏（看不到）+ 路由 middleware（直接打 URL 也進不去）+ mock requireRole（API 兜底回 403）。三層任一獨立成立，合起來才完整。

---

## 4. 範圍邊界（哪些不自動 scaffold）

| 不自動生 | 原因 | 怎麼處理 |
|---|---|---|
| `business_guards`（如「不得刪最後一個全權角色」409、「全權角色不得以此 API 改自己密碼」） | 規則高度 domain-specific，無通用範本；硬塞會猜錯 | 只登錄在 route-map.rbac.business_guards，實作邏輯留 feature/spec 散文，由 spec 撰寫者確保有測 |
| self-vs-others **疊加條件**（`member` 改自己密碼**且需 oldPassword**、`workspace_owner` 改他人免帶） | 屬端點內部商業邏輯；**純「是不是自己這筆」已由 `object_ownership` 自動生**，這裡只剩歸屬之上**再疊條件**（舊密碼、狀態…）的部分 | mock 端點內手寫條件分支，本 scaffold 不代勞 |
| field-level 角色可見性（同端點依角色回不同欄位） | OpenAPI 本身無法表達，自動猜必錯（多給＝洩漏、少給＝壞 UI） | **不默默略過**：偵測到「PII 語意欄位（電話／地址／證件／內部備註等，範例非白名單）× 多角色讀同一資源」→ **停下來問操作者**各角色可見哪些欄位，確認後在 mock 端點依角色白名單挑欄位（wedding-host 實戰：接待員拿到全賓客電話／住址，實際工作只需姓名＋桌次） |

> 未來若後端在 OpenAPI 補機器可讀的 `x-required-roles` vendor extension，§1 偵測可從「散文語意萃取」升級為「直接讀標註」，route-map.rbac schema 不變、下游無感。

---

## 5. Sync 模式

- spec 後來才出現角色限制端點（新增 `roles` 欄位 / 「僅 X」散文）→ phase-0 偵測補寫 route-map.rbac，sync-report 標「新增角色守門」，mock / ui 補套範本。
- spec 移除某端點的角色限制 → **不自動拆守門**（避免誤刪自訂邏輯），sync-report 標為待人工確認的 rbac 孤兒。
- 角色全集變動（新增 / 移除 role）→ 更新 `rbac.roles`，提示檢查 mock 種子是否仍每角色至少一帳號、UI v-if 是否涵蓋新角色。
