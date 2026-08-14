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
> **為什麼**：主 spec 依 v2 規範不用容器／表單欄位 testid（見 SSOT [testid-conventions.md](../../feature-to-flow/references/testid-conventions.md) 的禁止清單），所以 Phase 2 自創的 `{page}-page` 這類 testid **在生成的當下就註定不在合約白名單內**，只會變成 `/vibe-e2e` 抓的孤兒（`orphan-testid`）與日後的 dead testid 存量。需要新的合約定位點時走 `.flow.md` → `/test e2e spec` 重生流程，不在此自創。

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
     另檢查 `public_paths` 沒有任何一項是受保護路由的路徑前綴（middleware 前綴比對會把巢狀子路由一併放行）——有衝突停下回報路由規劃問題，不要默默產出漏守門的 middleware。
2.5. **RBAC route guard（條件式）**：檢查 `route-map.yaml > rbac.protected_routes`
   - **無 `rbac` 區塊 / 無 `protected_routes`** → 跳過，本專案不做角色路由守門
   - **有 `protected_routes`** → 確保 `app/middleware/rbac.global.ts` 存在（範本見下方「RBAC route guard 範本」），並建立守門目標頁空殼（如 `/403`，若 `route-map.routes` 未含則一併補一個 `app/pages/403.vue` 空殼）。角色名用 `rbac` 實際值、不寫死。入口 / 操作鈕的角色隱藏由 Phase 5 依 [rules.md](rules.md)「角色導向 UI 可見性」實作。
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

## Auth middleware 範本（僅 `route-map.auth.required` 時產出）

> 防迴圈設計見 feature-to-api `references/auth-scaffold.md` §4。`login.vue` 範本見 [page-builder.md](page-builder.md)「登入表單」。

```ts
// app/middleware/auth.global.ts
import { useAuthStore } from '~/stores/auth'

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

  const isPublic = publicPaths.some(p => to.path === p || to.path.startsWith(`${p}/`))

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
// app/middleware/rbac.global.ts
import { useAuthStore } from '~/stores/auth'

// 由 route-map.rbac.protected_routes 生成；path 前綴比對，allow = 允許角色
const PROTECTED_ROUTES: { path: string, allow: string[] }[] = [
  { path: '/accounts', allow: ['super_admin'] },
]

const DENIED_PATH = '/403'

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  const rule = PROTECTED_ROUTES.find(r => to.path === r.path || to.path.startsWith(`${r.path}/`))
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
