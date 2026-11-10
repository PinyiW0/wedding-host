# Phase 2: 路由骨架

## 必讀規範

```
僅需讀取：
- spec/report/route-map.yaml（`/feature-to-api` Phase 0 產生的路由對照表）

Sync 模式額外讀取：
- spec/report/sync-report.md（變更報告的「路由變更」段落）
```

> ⚠️ **Phase 2 不產 testid**。骨架只給語意結構（`<h1>` 標題、`<main>`/`<section>` 語意標籤、可見文字），testid 留給 Phase 5 依 `.spec.ts` 合約逐字複製。
>
> **為什麼**：主 spec 依抽象化原則不用容器／表單欄位 testid（見 SSOT [testid-conventions.md](../../feature-to-flow/references/testid-conventions.md) 的禁止清單），所以 Phase 2 自創的 `{page}-page` 這類 testid **在生成的當下就註定不在合約白名單內**，只會變成 `/vibe-e2e` 抓的孤兒（`orphan-testid`）與日後的 dead testid 存量。需要新的合約定位點時走 `.flow.md` → `/test e2e spec` 重生流程，不在此自創。

---

## 增量模式判斷

Phase 2 開始前，先檢查 `spec/report/sync-report.md` 是否存在：

| 條件 | 模式 | 行為 |
|------|------|------|
| `sync-report.md` **不存在** | **全量模式** | 執行下方「全量模式執行步驟」（現有流程不動） |
| `sync-report.md` **存在** | **增量模式** | 讀取報告，只處理新增的路由 |

### 增量模式步驟

1. **讀取 sync-report.md** 的「路由變更」表格
2. **新增的路由** → 建立空殼頁面（與全量模式相同範本）
3. **已存在的路由** → 跳過（不修改現有頁面骨架）
4. **刪除的路由** → **不執行刪除**，列在確認清單提醒用戶
5. **詢問用戶確認**

增量確認格式：
```
Phase 2 增量更新完成

新建頁面：
- [done] app/pages/observers/index.vue（空殼，含 testid）

跳過（已存在）：
- [skip] app/pages/login.vue
- [skip] app/pages/sites/index.vue

待刪除（不自動執行）：
- （無）

確認後繼續？
```

---

## 全量模式執行步驟

1. **讀取路由規劃表**（`spec/report/route-map.yaml`）
2. **Auth gate（條件式）**：檢查 `route-map.yaml > auth`
   - **無 `auth` 區塊** → 跳過，本專案不做登入守門
   - **`auth.required: true`** → 確保 `app/middleware/auth.global.ts` 存在（範本見下方「Auth middleware 範本」）且 `authPublicPaths` 含 `login_path`，
     並有 `app/pages/login.vue`（範本見 [page-builder.md](page-builder.md)「登入表單」）。API 層（useHttp auth 版 / store / auth.api / types / nuxt.config 追加）由 feature-to-api 依 [auth-scaffold.md](../../feature-to-api/references/auth-scaffold.md) §3a 套用。
     **不可默默跳過**——缺守門要報錯補上。防迴圈六道與收尾 checklist 見 auth-scaffold.md §4 / §5。
     另檢查 `public_paths` 裡含動態段（`[id]` 或 `:id`）的項目：動態段會吃任意非空值，要確認該段不會吃到受保護資源的路徑，範圍夠精準才放行。
     路徑段只能是具體字串、`[id]` 或 `:id`：出現 catch-all（`[...slug]`）、選填段（`[[id]]`）、帶正規式或修飾符的參數（`:id(\d+)`、`:id?`）就停下回報——比對函式不支援這些語法，照樣產出會靜默算錯守門範圍。
2.5. **RBAC route guard（條件式）**：檢查 `route-map.yaml > rbac.protected_routes`
   - **無 `rbac` 區塊 / 無 `protected_routes`** → 跳過，本專案不做角色路由守門
   - **有 `protected_routes`** → 確保 `app/middleware/rbac.global.ts` 存在（範本見下方「RBAC route guard 範本」），並建立守門目標頁空殼（如 `/403`，若 `route-map.routes` 未含則一併補一個 `app/pages/403.vue` 空殼）。角色名用 `rbac` 實際值、不寫死。入口 / 操作鈕的角色隱藏由 Phase 5 依 [rules.md](rules.md)「角色導向 UI 可見性」實作。
     另檢查 `protected_routes` 沒有重複的路徑（只差參數名或尾斜線也算，如 `/members/[id]` 與 `/members/:memberId`、`/members` 與 `/members/`）：有就停下回報路由規劃問題，不要默默產出——兩條 `allow` 不同時，套用哪一條會取決於清單順序。
     也檢查沒有任何具體路徑同時被某條 `protected_routes` 涵蓋、又被某條 `auth.public_paths` 命中（例如 `/members` 涵蓋公開的 `/members/[id]`；最常見是寫了 `/`，它涵蓋整站含 login）：有就停下回報——匿名者進該公開頁會被導去 `/403`，公開頁形同失效；撞到的是 login 時，還會在 login 與 `/403` 之間來回導向。
     路徑段的語法限制同步驟 2：不支援的語法（catch-all、選填段、正規式參數）停下回報。
3. **根據路由規劃建立所有頁面空殼**（**不帶 testid**，見上方必讀規範）
4. **每個頁面只包含基本結構**：語意標籤（`<main>`／`<section>`）＋ `<h1>` 頁面標題，讓後續 Phase 5 有語意 anchor 可用
5. **詢問用戶確認**

## 頁面空殼範例

```vue
<!-- app/pages/index.vue（根路由 redirect） -->
<!-- ⚠️ redirect 頁面必須在 Phase 2 直接實作，不留到 Phase 5 -->
<!-- ⚠️ 禁止使用 redirectCode（HTTP redirect 會被瀏覽器快取，影響同 port 的其他專案） -->
<!-- 從 route-map.yaml 的 note 欄位讀取 redirect 目標 -->
<script setup lang="ts">
if (import.meta.client) {
  await navigateTo('/<目標路由>', { replace: true })
}
</script>

<template>
  <div />
</template>
```

```vue
<!-- app/pages/login.vue -->
<!-- 空殼給語意 anchor（<main> + <h1>），不給容器 testid -->
<script setup lang="ts">
definePageMeta({ layout: 'auth' })
</script>

<template>
  <main>
    <h1>登入</h1>
    <!-- Phase 5 實作：登入表單 -->
    <p class="text-neutral-500">登入頁面（待實作）</p>
  </main>
</template>
```

```vue
<!-- app/pages/sites/index.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <main class="flex h-full flex-col">
    <h1>觀測點列表</h1>
    <!-- Phase 5 實作：觀測點列表 -->
    <p class="text-neutral-500">觀測點列表頁面（待實作）</p>
  </main>
</template>
```

```vue
<!-- app/pages/sites/[id].vue -->
<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const siteId = computed(() => route.params.id)
</script>

<template>
  <main class="flex h-full flex-col">
    <h1>觀測點詳情</h1>
    <!-- Phase 5 實作：觀測點詳情 -->
    <p class="text-neutral-500">觀測點詳情頁面 #{{ siteId }}（待實作）</p>
  </main>
</template>
```

> `<h1>` 的可見文字就是 Phase 5 / spec 用來定位頁面的語意 anchor（`page.getByRole('heading', { name: /觀測點列表/ })`）——比 `sites-page` 容器 testid 更穩、且不需要進合約白名單。

## 共用路由比對函式（Auth／RBAC 兩處 middleware 共用）

兩種比對，依清單性質選用：

| 函式 | 命中條件 | 用在 | 為什麼 |
|---|---|---|---|
| `matchesRoutePattern` | 段數相同、逐段對上 | Auth `public_paths`（白名單） | 公開頁不連帶放行子頁，漏列只會多擋、不會漏守 |
| `coversRoutePattern` | pattern 本身或其下子頁 | RBAC `protected_routes`（黑名單） | 守住 `/members` 也守住 `/members/42`，漏列子頁仍有守門 |
| `compareRouteSpecificity` | —（排序用） | RBAC 規則優先序 | 從左逐段比、具體段先，前段相同時深的先（較淺的具體前綴不會被較深的動態規則蓋掉）；`/members/me` 的例外不會被 `/members/[id]` 蓋掉，清單順序不影響結果（只差參數名或尾斜線的重複規則除外，由步驟 2.5 擋下） |

```ts
// app/utils/route-match.ts
// 不用 startsWith：它對 `/xxx/[id]` 這類樣板永遠比不中，且會誤中同前綴的兄弟路由（`/admin` 誤中 `/administrator`）。
// 只支援具體段、`[id]`、`:id`。catch-all（`[...slug]`）、選填段（`[[id]]`）、正規式參數（`:id(\d+)`）
// 會被當成單一動態段而算錯——route-map 推導表不產生這些語法，手動加入時由 Phase 2 步驟 2／2.5 在生成前擋下。
// E2E 的 test/e2e/helpers/route-match.ts 有同一份 matchesRoutePattern（見 .claude/skills/test/e2e/references/setup.md）——
// E2E 骨架先於 UI 產生、拿不到這個檔，所以各存一份；改判準要兩邊一起改。

// 動態段：`[id]`（route-map 推導表的寫法）或 `:id`，吃任意非空值
function isDynamicSegment(segment: string): boolean {
  return segment.startsWith(':') || (segment.startsWith('[') && segment.endsWith(']'))
}

function toSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

// pattern 的每一段都對得上 path 同位置的段（只比到 pattern 的長度）
function leadingSegmentsMatch(patternSegments: string[], pathSegments: string[]): boolean {
  return patternSegments.every((segment, index) => {
    const pathSegment = pathSegments[index] ?? ''
    return isDynamicSegment(segment) ? pathSegment.length > 0 : segment === pathSegment
  })
}

// 整條命中：段數相同且逐段對上（Auth 白名單用）
export function matchesRoutePattern(pattern: string, path: string): boolean {
  const patternSegments = toSegments(pattern)
  const pathSegments = toSegments(path)
  return patternSegments.length === pathSegments.length && leadingSegmentsMatch(patternSegments, pathSegments)
}

// 涵蓋：path 是 pattern 本身或其下子頁（RBAC 黑名單用）
export function coversRoutePattern(pattern: string, path: string): boolean {
  const patternSegments = toSegments(pattern)
  const pathSegments = toSegments(path)
  return patternSegments.length <= pathSegments.length && leadingSegmentsMatch(patternSegments, pathSegments)
}

// 比對優先序（給 sort 用，越具體越前面）：先從左逐段比，先出現具體段的那條先；前段具體性都相同時，段數多的先。
// 不可先比段數：/[team]/settings 會排在 /admin 前面，進 /admin/settings 時先命中動態規則，蓋掉 /admin 的嚴格守門
export function compareRouteSpecificity(a: string, b: string): number {
  const aSegments = toSegments(a)
  const bSegments = toSegments(b)
  const shared = Math.min(aSegments.length, bSegments.length)
  for (let index = 0; index < shared; index++) {
    const aDynamic = isDynamicSegment(aSegments[index]!)
    const bDynamic = isDynamicSegment(bSegments[index]!)
    if (aDynamic !== bDynamic)
      return aDynamic ? 1 : -1
  }
  return bSegments.length - aSegments.length
}
```

## Auth middleware 範本（僅 `route-map.auth.required` 時產出）

> 防迴圈設計見 feature-to-api `references/auth-scaffold.md` §4。`login.vue` 範本見 [page-builder.md](page-builder.md)「登入表單」。

```ts
// app/middleware/auth.global.ts（useAuthStore 由 @pinia/nuxt auto-import）
import { matchesRoutePattern } from '~/utils/route-match'

const base64UrlDash = /-/g
const base64UrlUnderscore = /_/g

// 解析 JWT exp 判斷效期（不驗簽，僅 UX gate；真正驗證在後端）。解析失敗→視為可用，交給後端 401。
function isJwtAlive(token: string): boolean {
  try {
    const payload = token.split('.')[1]
    if (!payload)
      return true
    const json = atob(payload.replace(base64UrlDash, '+').replace(base64UrlUnderscore, '/'))
    const exp = (JSON.parse(json) as { exp?: number }).exp
    return typeof exp !== 'number' || exp * 1000 > Date.now()
  }
  catch {
    return true
  }
}

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  const { public: config } = useRuntimeConfig()
  const loginPath = config.authLoginPath || '/login'
  const homePath = config.authHomePath || '/'
  const publicPaths: string[] = config.authPublicPaths?.length ? config.authPublicPaths : [loginPath]

  const isPublic = publicPaths.some(p => matchesRoutePattern(p, to.path))

  const accessAlive = !!authStore.token && !!authStore.accountId && isJwtAlive(authStore.token)
  const refreshAlive
    = !!authStore.refreshToken
      && !!authStore.refreshExpiresAt
      && new Date(authStore.refreshExpiresAt).getTime() > Date.now()
  const sessionUsable = accessAlive || refreshAlive

  // 未登入 + 非公開頁 → 導 login（公開頁含 login，故不會 /login → /login 自彈）
  if (!sessionUsable && !isPublic)
    return navigateTo(loginPath)
  // 已登入卻在 login 頁 → 導回 home（never-nav-to-current 保護）
  if (sessionUsable && to.path === loginPath && to.path !== homePath)
    return navigateTo(homePath)
})
```

## RBAC route guard 範本（僅 `route-map.rbac.protected_routes` 時產出）

> 條件式：無 `rbac.protected_routes` 不產此檔。角色守門以 auth 為前提——檔名 `rbac.global.ts` 在 `auth.global.ts` 之後（字母序），auth 先處理未登入，rbac 再判角色。
> `PROTECTED_ROUTES` 陣列**由 route-map.rbac.protected_routes 生成寫入**（角色名照 route-map 實際值，不寫死）。守門目標 `/403` 頁需存在（Phase 2 補空殼）。

```ts
// app/middleware/rbac.global.ts（useAuthStore 由 @pinia/nuxt auto-import）
import { compareRouteSpecificity, coversRoutePattern } from '~/utils/route-match'

// 由 route-map.rbac.protected_routes 生成；path 涵蓋其下子頁（寫 /accounts 也守 /accounts/42），allow = 允許角色
const PROTECTED_ROUTES: { path: string, allow: string[] }[] = [
  { path: '/accounts', allow: ['super_admin'] },
]

// 最具體的規則先比：子頁另列一條就能覆寫上層（如 /accounts/me 開放給其他角色）。
// 從左逐段比、具體段先，前段相同時深的先（/accounts/me 先於 /accounts/[id]），不受生成時的排列順序影響。
// 只差參數名或尾斜線的重複規則（/accounts/[id] 與 /accounts/:accountId）排不出先後，生成前就要擋下（見步驟 2.5）。
// 複製後 sort，不用 toSorted：它是 ES2023，Vite 預設支援的 Chrome 107／Firefox 104 沒有，Nuxt 也不補 polyfill
const RULES_BY_SPECIFICITY = [...PROTECTED_ROUTES].sort((a, b) => compareRouteSpecificity(a.path, b.path))

const DENIED_PATH = '/403'

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  const rule = RULES_BY_SPECIFICITY.find(r => coversRoutePattern(r.path, to.path))
  if (!rule)
    return // 非受保護路由

  const allowed = authStore.roles.some(role => rule.allow.includes(role))
  // 無權且不在目標頁 → 導離（never-nav-to-current，避免 /403 → /403 自彈）
  if (!allowed && to.path !== DENIED_PATH)
    return navigateTo(DENIED_PATH)
})
```

> ⚠️ 這是 UX 守門（前端可繞過）——真正的安全邊界在 mock / 後端的 `requireRole`（回 403）。兩層並存：middleware 擋導航、API 擋資料。

## 輸出結構

```
app/pages/
├── login.vue
├── index.vue
├── sites/
│   ├── index.vue
│   └── [id].vue
└── stations/
    └── index.vue
```
