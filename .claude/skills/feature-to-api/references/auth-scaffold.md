# Auth Scaffold（條件式登入守門）

> **SDD workflow 對 auth 中立**：template 預設不帶 auth。**只有偵測到登入需求時**才套用本 scaffold。
> 無 auth 訊號的專案（純展示 / 落地頁）一個 auth 字都不生，`useHttp` 維持中立 envelope 版。
>
> **本檔是 auth 的 SSOT / 契約**：偵測規則、route-map.auth schema、防迴圈鐵律、檔案落點與範本。
> 範本沿「消費階段」分流：**API 層由 feature-to-api 套用（範本在 §3a）**、**UI 層由 feature-to-ui 套用（範本在它既有的 login / middleware 段，§3b 指路）**。

---

## 1. 偵測（語意判準；grep 訊號起手，AI 依現況收尾）

判準是**語意**——「這份 spec 描述的是一個需要登入守門的 app 嗎」，不是「有沒有出現某個字串」。下表訊號是**常見範例非窮舉白名單**，命名不同但語意相同一樣命中。命中任一即視為「需要」：

| 來源 | 訊號（範例，依語意判斷） |
|---|---|
| OpenAPI `spec/api/api-spec.yml` | 語意上存在「收憑證換 token」+「刷新 token」的端點對（端點名 `/auth/login`、`/sessions`、`/oauth/token` 等皆為範例，依 path 語意 + requestBody / response 形狀判斷）；或 `components.securitySchemes` 有 `bearer` / `oauth2` |
| `.feature` / `.flow.md` | 有登入 scenario（「登入」「login」「帳號 + 密碼」「未登入導向」等語意，非限定字串） |

偵測到 → 寫入 `route-map.yaml > auth`（§2）並套用 §3。**沒偵測到 → 完全略過本檔。** 訊號模糊、命名超出範例、或來源互相矛盾時 → **不默默猜、也不硬比字面，列出研判與操作者確認再定**（與 `phase-0-prep.md`「偵測總則」一致）。

---

## 2. route-map.yaml 的 `auth` 區塊（持久化事實，跨 phase 對照）

```yaml
auth:
  required: true
  login_path: /login          # 登入頁
  home_path: /                # 登入後首頁（依專案，root redirect 目標）
  public_paths:               # 免驗證白名單（務必含 login_path）
    - /login
  token_endpoints:            # handleUnauthorized:false 的端點（避免自身 401 迴圈）
                              # 依 §1 實際偵測到的「登入 / 刷新 / 登出 / me」端點填入；
                              # 下列 /auth/* 僅範例，後端命名不同（/sessions、/oauth/token…）就換成實際端點
    - POST /auth/login
    - POST /auth/refresh
    - POST /auth/logout
    - GET  /auth/me
```

> `feature-to-ui` Phase 2 讀此區塊：`required: true` 但 `app/middleware/auth.global.ts` 不存在或白名單缺 login → **報錯並補上**，不可默默跳過。

---

## 3. 檔案落點與歸屬

| 檔案 | 範本位置 | 套用者 | 說明 |
|---|---|---|---|
| `app/types/api/auth.ts` | §3a | feature-to-api Phase 0 | TokenPairData / LoginBody / MeResponse… |
| `app/composables/useHttpAuth.ts` | §3a | feature-to-api Phase 1.5 | **覆蓋**中立 stub（回 null）→ 從 store + force-logout 組 handler。**useHttp.ts 不動**（已內建 Authorization / 401→refresh→retry 注入點） |
| `app/stores/auth.ts` | §3a | feature-to-api Phase 1.5 | 三層併發防護 refresh（single-flight＋跨分頁鎖＋cookie 重讀）、cookie persist（含 maxAge）、login/logout/clearAuth |
| `app/utils/force-logout.ts` | §3a | feature-to-api Phase 1.5 | **冪等單飛**登出出口（防並發導頁，§4） |
| `app/api/auth.api.ts` | §3a | feature-to-api Phase 1.5 | 登入/refresh/logout/me，全 `handleUnauthorized:false`。**auth 命中時本檔是唯一來源**：Phase 1.5 照本範本產，不照一般命名規則另產 `token_endpoints`，函式名以本檔為準（store 依賴） |
| `app/api/index.ts` | §3a | feature-to-api Phase 1.5 | re-export（已存在則合併） |
| `server/api/v1/auth/*`（`path_prefix` 去掉開頭的 `/api` 再對應到資料夾；`/api/v1` → `server/api/v1/`） | §3a（login 在 phase-1-mock-api「API 端點範例」） | feature-to-api Phase 1 | login／refresh／logout／me 四個 mock 端點，auth 命中時一定要生（store 的 `login()` 必打 me、換發必打 refresh），不看 spec 有沒有寫 |
| `server/mock/data/revoked-tokens.ts` | §3a | feature-to-api Phase 1 | refresh token 解析與登出作廢（每帳號一個登出時刻）；auth 命中時一定要生（refresh／logout 都 import 它） |
| `nuxt.config.ts` 追加 | §3a | feature-to-api | auth 路徑設定（編輯，非新檔） |
| `app/middleware/auth.global.ts` | §3b → feature-to-ui `phase-2-skeleton.md` | feature-to-ui | 全域守門（白名單 + never-nav-current） |
| `app/pages/login.vue` | §3b → feature-to-ui `page-builder.md` | feature-to-ui | 登入頁（**不得發 authed fetch**） |
| `server/plugins/00.security-guard.ts` | §4b | feature-to-api Phase 1 | production 啟動守衛（密鑰為 dev 預設值 → 拒絕啟動） |
| `server/utils/rate-limit.ts` | §4b | feature-to-api Phase 1 | 登入限流（僅計失敗、成功清零；fileUpload 時同套 presign） |
| `nuxt.config.ts` 安全標頭 | §4b | feature-to-api Phase 1 | 三個零調校標頭（編輯，非新檔） |

**端點路徑**：路徑與 method 照 `route-map.yaml > auth.token_endpoints` 的實際值（後端是 `POST /api/v1/sessions` 就打 `/api/v1/sessions`）。下列範本的 `/api/v1/auth/*` 只是預設命名，假設 `path_prefix = /api/v1`；改成實際端點時，`auth.api.ts` 的網址與 method、mock 檔名（含 `.post.ts` 等 method 後綴）、mock 檔內的相對 import 層數要一起換。`auth.api.ts` 的函式名（`loginUser`／`refreshAuthToken`／`logoutUser`／`fetchMe`）固定不改，store 靠這些名字呼叫。不可寫裸 `/auth/*`（本專案 `apiBase` 是空字串，裸路徑會打到不存在的 `/auth/login`；`apiBase` 為 `/api` 的專案則會打到 `/api/auth/login`，同樣偏離 `path_prefix`）。

### 3a. API 層範本（feature-to-api 套用）

> **欄位名以 spec 為準**：下方型別是 Feature 模式的預設形狀。OpenAPI 模式下 token 回應的欄位名照 spec（例如 spec 叫 `token` 而不是 `accessToken`），store 裡讀 `data.accessToken` 的地方要一起改，否則 typelint 會紅。

```ts
// app/types/api/auth.ts —— 認證型別（envelope 的 data 取具名 schema）
export interface LoginBody {
  account: string
  password: string
}
export interface TokenPairData {
  accessToken: string
  tokenType: string
  expiresAt: string
  accountId: string
  refreshToken: string
  refreshExpiresAt: string
}
export type LoginResponse = TokenPairData
export interface RefreshBody { refreshToken: string }
export type RefreshResponse = TokenPairData
export interface LogoutBody { refreshToken?: string }
export interface MeResponse {
  accountId: string
  account: string
  name: string
  roles: string[]
}
```

```ts
// app/composables/useHttpAuth.ts —— auth 版，覆蓋中立 stub（從 store + force-logout 組出 handler）
// 重點：useHttp.ts **不覆蓋**——中立版已內建 auth 注入點（Authorization / 401→refresh→retry），
//       只要本檔回傳真實 handler 即啟用。envelope / get / request 核心維持單一編譯來源，不複製。
// useAuthStore 由 @pinia/nuxt auto-import，不手動 import
import { forceLogout } from '~/utils/force-logout'

export interface HttpAuthHandler {
  // 目前 access token（無則回 null）→ useHttp 用來帶 Authorization
  getToken: () => string | null
  // 401 時換發 token，回傳是否成功（成功則 retry 原請求）
  refresh: () => Promise<boolean>
  // refresh 失敗 / retry 仍 401 → 冪等登出出口（並發 401 只導一次，§4 第 1 道）
  forceLogout: () => Promise<void>
}

export function useHttpAuth(): HttpAuthHandler | null {
  const authStore = useAuthStore()
  const nuxtApp = useNuxtApp()
  return {
    getToken: () => authStore.token,
    refresh: () => authStore.refresh(),
    forceLogout: () => forceLogout(nuxtApp),
  }
}
```

```ts
// app/stores/auth.ts —— 三層併發防護 refresh、cookie persist（含 maxAge）、clearAuth 含 server deleteCookie＋epoch 防殭屍
import type { LoginBody } from '~/types/api/auth'
import { deleteCookie } from 'h3'
import { fetchMe, loginUser, logoutUser, refreshAuthToken } from '~/api/auth.api'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const accountId = ref<string | null>(null)
    const token = ref<string | null>(null)
    const refreshToken = ref<string | null>(null)
    const refreshExpiresAt = ref<string | null>(null)
    const account = ref<string | null>(null)
    const name = ref<string | null>(null)
    const roles = ref<string[]>([])

    const isAuthenticated = computed(() => !!token.value && !!accountId.value)

    async function fetchProfile(): Promise<void> {
      const me = await fetchMe()
      accountId.value = me.accountId
      account.value = me.account
      name.value = me.name
      roles.value = me.roles
    }

    async function login(body: LoginBody): Promise<void> {
      const data = await loginUser(body)
      token.value = data.accessToken
      refreshToken.value = data.refreshToken
      refreshExpiresAt.value = data.refreshExpiresAt
      accountId.value = data.accountId
      await fetchProfile()
    }

    // 三層併發防護：
    // 1) 本分頁 single-flight（refreshing promise）：同時多個 401 共用同一次換發
    // 2) 跨分頁 navigator.locks：整個 origin 同一時刻只有一個分頁換發（分頁同時甦醒的併發風暴）
    // 3) 搶到鎖先重讀 cookie：別的分頁已 rotate → 直接沿用不打 API
    //    ——關鍵在防後端 reuse detection：拿舊 refresh token 過寬限期再換會撤銷整個 token family
    let refreshing: Promise<boolean> | null = null
    // 登出防殭屍：clearAuth 遞增 epoch，飛行中的 refresh 回來 epoch 對不上就丟棄結果，
    // 否則「登出瞬間背景 refresh 慢半拍成功」會把新 token 寫回已登出的 state
    let sessionEpoch = 0

    async function doRefresh(): Promise<boolean> {
      // 等鎖期間其他分頁可能已完成換發：先重讀 persist cookie，refresh token 變了就直接沿用
      const prevRefreshToken = refreshToken.value
      if (import.meta.client)
        useAuthStore().$hydrate({ runHooks: false })
      if (refreshToken.value && refreshToken.value !== prevRefreshToken)
        return true
      if (!refreshToken.value)
        return false
      const epoch = sessionEpoch
      try {
        const data = await refreshAuthToken({ refreshToken: refreshToken.value })
        if (epoch !== sessionEpoch)
          return false // 換發期間已登出：丟棄結果，不寫回 state
        token.value = data.accessToken
        refreshToken.value = data.refreshToken
        refreshExpiresAt.value = data.refreshExpiresAt
        accountId.value = data.accountId
        return true
      }
      catch {
        if (epoch === sessionEpoch)
          clearAuth()
        return false
      }
    }

    // 跨分頁鎖包裝：Web Locks 僅存在於 client。SSR／不支援／取鎖失敗（sandbox iframe 的 SecurityError、
    // 頁面非 fully active 的 InvalidStateError——分頁甦醒場景特別容易踩到）都退回直接執行；
    // 取鎖失敗時尚未打過 refresh API，直跑不會重複換發
    async function withRefreshLock(): Promise<boolean> {
      if (!import.meta.client || !('locks' in navigator))
        return doRefresh()
      try {
        // request 型別為 Promise<T>（T 即 doRefresh 的回傳 Promise），await 攤平後才是 boolean
        return await navigator.locks.request('auth-refresh', () => doRefresh()) as boolean
      }
      catch {
        return doRefresh()
      }
    }

    function refresh(): Promise<boolean> {
      if (refreshing)
        return refreshing
      refreshing = (async (): Promise<boolean> => {
        try {
          return await withRefreshLock()
        }
        catch {
          // 非預期例外一律收斂成 false，維持 Promise<boolean> 契約：useHttp 的呼叫端是裸 await
          // 不接 rejection，這裡拋錯會蓋掉原始 401 並跳過 forceLogout → 使用者卡在壞 token 又不被導去登入頁
          return false
        }
        finally {
          refreshing = null
        }
      })()
      return refreshing
    }

    function clearAuth(): void {
      sessionEpoch++ // 使飛行中的 refresh 結果作廢（登出殭屍防護）
      accountId.value = null
      token.value = null
      refreshToken.value = null
      refreshExpiresAt.value = null
      account.value = null
      name.value = null
      roles.value = []
      // SSR：Set-Cookie 延遲到 app:rendered；登出後立刻 navigateTo 會讓清除送不出去 → 壞 token 殘留造成迴圈。
      // 故在 server 直接對 H3 event 寫刪除 header。cookie 名須對齊 persist 實際使用的 key
      // （預設 = store id 'auth'；若 persist 自訂 key 則改用該值，否則刪錯 cookie → 壞 token 殘留成迴圈）。
      if (import.meta.server) {
        const event = useRequestEvent()
        if (event)
          deleteCookie(event, 'auth', { path: '/' })
      }
    }

    async function logout(): Promise<void> {
      try {
        await logoutUser(refreshToken.value ?? undefined)
      }
      finally {
        clearAuth()
      }
    }

    return {
      accountId,
      token,
      refreshToken,
      refreshExpiresAt,
      account,
      name,
      roles,
      isAuthenticated,
      login,
      fetchProfile,
      refresh,
      logout,
      clearAuth,
    }
  },
  {
    persist: {
      // cookie 而非 localStorage：SSR 讀得到 token，避免 hydration 不一致。
      // maxAge 必須設且 ≥ 後端 refresh token 存活期：不設＝session cookie，瀏覽器行程被回收
      // （手機切背景、關瀏覽器）cookie 即蒸發 → 「閒置一陣子回來就被登出」（wedding-host 實戰）
      storage: piniaPluginPersistedstate.cookies({ sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 }),
      pick: ['accountId', 'token', 'refreshToken', 'refreshExpiresAt', 'account', 'name', 'roles'],
    },
  },
)
```

```ts
// app/utils/force-logout.ts —— 冪等單飛登出出口（防並發導頁，§4 第 1 道）
import type { NuxtApp } from 'nuxt/app'
// useAuthStore 由 @pinia/nuxt auto-import，不手動 import

// 並發 401 收斂旗標：同時多個 401 只允許一次「登出 + 導頁」→ 根治 Vue Router 重複導向錯誤
let loggingOut = false

// 唯一合法的「登出 + 導回登入頁」出口。必須包在 runWithContext（401 常在 await 後 / hook 內，SSR context 已失）。
export function forceLogout(nuxtApp: NuxtApp): Promise<void> {
  return nuxtApp.runWithContext(async () => {
    const loginPath = useRuntimeConfig().public.authLoginPath || '/login'
    if (loggingOut)
      return
    if (useRoute().path === loginPath) {
      useAuthStore().clearAuth() // 已在 login：清壞 token 即可，不再導
      return
    }
    loggingOut = true
    try {
      useAuthStore().clearAuth()
      await navigateTo(loginPath)
    }
    finally {
      loggingOut = false
    }
  })
}
```

```ts
// app/api/auth.api.ts —— auth 端點全 handleUnauthorized:false（防自身迴圈）
import type {
  LoginBody,
  LoginResponse,
  MeResponse,
  RefreshBody,
  RefreshResponse,
} from '~/types/api/auth'
import { useHttp } from '~/composables/useHttp'

export function loginUser(body: LoginBody) {
  return useHttp().post<LoginResponse>('/api/v1/auth/login', { body, handleUnauthorized: false })
}
export function refreshAuthToken(body: RefreshBody) {
  return useHttp().post<RefreshResponse>('/api/v1/auth/refresh', { body, handleUnauthorized: false })
}
export function logoutUser(refreshToken?: string) {
  return useHttp().post<null>('/api/v1/auth/logout', { body: { refreshToken }, handleUnauthorized: false })
}
export function fetchMe() {
  return useHttp().getOnce<MeResponse>('/api/v1/auth/me', { handleUnauthorized: false })
}
```

```ts
// app/api/index.ts（已存在則合併）
export * from './auth.api'
```

```ts
// server/api/v1/auth/me.get.ts —— Bearer 反查當前使用者；無 token 或查無使用者 → 401
import type { H3Event } from 'h3'
import type { MeResponse } from '../../../../app/types/api/auth'
import { requireAuth } from '../../../mock/auth-context'

export default defineEventHandler((event: H3Event): MeResponse => {
  const me = requireAuth(event)
  return { accountId: me.accountId, account: me.account, name: me.name, roles: me.roles }
})
```

```ts
// server/api/v1/auth/refresh.post.ts —— 解析 mock refresh token 後重發一組（形狀同 login）
// mock 登入發的 refresh token 形如 `mock-refresh-${accountId}-${timestamp}`（見 phase-1-mock-api.md 登入範例）
import type { H3Event } from 'h3'
import type { RefreshResponse } from '../../../../app/types/api/auth'
import { parseMockRefreshToken, REFRESH_TTL_MS } from '../../../mock/data/revoked-tokens'
import { mockUsers } from '../../../mock/data/users'
import { refreshSchema } from '../../../validation/auth' // 範本見 phase-1-mock-api.md 登入範例

export default defineEventHandler(async (event: H3Event): Promise<RefreshResponse> => {
  const parsed = await readValidatedBody(event, refreshSchema.safeParse)
  const oldToken = parsed.success ? parsed.data.refreshToken : undefined
  // 已登出或已過期的 refresh token 一律拒絕（換發不讓舊 token 失效：同時兩個換發請求時，後到的會被踢出登入）
  const info = oldToken ? parseMockRefreshToken(oldToken) : undefined
  const user = mockUsers.find(u => u.accountId === info?.accountId && !u.deletedAt)
  if (!user)
    throw createError({ statusCode: 401, message: '登入已過期，請重新登入' })
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

```ts
// server/mock/data/revoked-tokens.ts —— 登出後作廢 refresh token（mock 單一實例，重啟就清空）
// mock 登入發的 refresh token 形如 `mock-refresh-${accountId}-${timestamp}`（見 phase-1-mock-api.md 登入範例）
// 每個帳號只記一個「登出時刻」，該時刻以前發的 refresh token 全部作廢：筆數最多等於帳號數，不必設上限或清理
const MOCK_REFRESH_RE = /^mock-refresh-(.+)-(\d+)$/
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // login／refresh 回應的 refreshExpiresAt 也用這個值
const loggedOutAt = new Map<string, number>() // accountId → 登出時刻

// 格式不符、發行時間在未來、已過期、或登出前發的 → undefined
export function parseMockRefreshToken(token: string): { accountId: string, issuedAt: number } | undefined {
  const match = token.match(MOCK_REFRESH_RE)
  const issuedAt = Number(match?.[2])
  const now = Date.now()
  if (!match?.[1] || !Number.isFinite(issuedAt) || issuedAt > now || now - issuedAt >= REFRESH_TTL_MS)
    return undefined
  if (issuedAt <= (loggedOutAt.get(match[1]) ?? -1))
    return undefined
  return { accountId: match[1], issuedAt }
}

export function revokeRefreshTokens(accountId: string): void {
  loggedOutAt.set(accountId, Date.now())
}
```

```ts
// server/api/v1/auth/logout.post.ts —— 讓 refresh token 失效後回 204
// 不加 requireAuth：token 過期的人也要能登出
import type { H3Event } from 'h3'
import { parseMockRefreshToken, revokeRefreshTokens } from '../../../mock/data/revoked-tokens'
import { mockUsers } from '../../../mock/data/users'
import { refreshSchema } from '../../../validation/auth'

export default defineEventHandler(async (event: H3Event) => {
  const parsed = await readValidatedBody(event, refreshSchema.safeParse)
  const info = parsed.success ? parseMockRefreshToken(parsed.data.refreshToken) : undefined
  // 只對有效 token 的帳號記登出時刻：亂寫的字串不會寫入任何東西
  if (info && mockUsers.some(u => u.accountId === info.accountId))
    revokeRefreshTokens(info.accountId)
  setResponseStatus(event, 204)
})
```

```ts
// nuxt.config.ts 追加（apiBase／apiEnvelope 模板已有，不要重複寫；以下值依 route-map.auth）
runtimeConfig: {
  public: {
    authLoginPath: '/login',
    authHomePath: '/',
    // = route-map.auth.public_paths：login ＋賓客端/公開場景路由，不只 login（漏列會被 middleware 誤擋）
    authPublicPaths: ['/login'] as string[],
  },
},
// 若 home_path 不是 '/'，加 root redirect（勿 redirect 到自己造成 loop）：
// routeRules: { '/': { redirect: '/dashboard' } },
```

### 3b. UI 層範本（feature-to-ui 套用）

- **`app/middleware/auth.global.ts`** → 範本見 feature-to-ui `references/phase-2-skeleton.md`「Auth gate / middleware 範本」段。
- **`app/pages/login.vue`** → 範本見 feature-to-ui `references/page-builder.md`「登入表單（含 Auth Store）」段（**唯一** login 範本，勿另建）。

---

## 4. 防「導向迴圈」硬性要求（某前端專案實戰：此 bug 一直復發）

**根因**：middleware 信任 `refreshAlive` 放行但自己不 refresh → 進受保護頁 → 該頁並發多個 API 帶過期 token →
**同時噴多個 401** → 每個各自 `forceLogout` → **各自 `navigateTo('/login')`** → Vue Router「redundant / duplicated navigation」錯。
參照專案只修了 SSR cookie 時序，**沒修並發導頁**，故一直復發。

六道防線（改範本時不可拿掉）：

1. **`forceLogout` 單飛冪等**（`loggingOut` flag）→ 並發 401 只導一次。**根治此錯的關鍵。**
2. **顯式公開白名單**（`authPublicPaths`，務必含 login）→ middleware 只在非白名單時導。
3. **never navigate to current**（middleware 與 forceLogout 都檢查目標 path）。
4. **login 頁與其 layout 禁發 authed fetch**；`auth.api.ts` 端點全 `handleUnauthorized:false`。
5. **clearAuth cookie 確實落地**（store server 端 `deleteCookie`）。
6. **home/login 路徑用 config**（不寫死），可攜。

---

## 4a. 公開面資料分級（有免登入可達端點時）

`public_paths` 上的頁面所打的 API、或簽名連結／分享碼場景的端點，對「未帶登入身分的請求」適用兩條鐵律（對應 `server-security.md` 第 5、6 條）：

1. **公開 GET 只回已發布資料的公開層欄位**：資源 schema 有審核／發布狀態語意欄位（submitted／approved／rejected、draft／published 等，範例非白名單）時，匿名請求過濾到已發布狀態，且白名單投影排除內部欄位（審核理由、owner id、內部備註）。登入的管理端維持全量（審核所需）——handler 內依「有無登入身分」分支。
2. **公開寫入身分不可自報**：body 的身分欄位一律忽略或 400；身分只能來自已驗證的簽名參數或 auth context。

```ts
// server/api/pages/[shareCode]/comments.get.ts（假想資源：公開分享頁留言，僅示意分級寫法）
const me = getMockCurrentUser(event) // 有登入身分（管理端）才看全量
const items = mockComments.filter(c =>
  c.shareCode === shareCode && (me ? true : c.status === 'approved'), // 匿名只回已通過
)
return items.map(c => ({ commentId: c.commentId, content: c.content })) // 公開層白名單：無 status／rejectReason／authorId
```

> wedding-host 實戰：祝福牆對匿名簽名者回全量（含被退件＋內部退件理由）、公開投稿可帶任意 guestId 冒名——分級與身分兩條各對應一個 High／Med 漏洞。

---

## 4b. Production 基礎設施（auth 命中時生；mock 期即建立，演化成真 server 直接沿用）

**① 密鑰啟動守衛**——密鑰硬編碼／忘設環境變數是「全站淪陷」級風險（可偽造任意 token）：

```ts
// server/plugins/00.security-guard.ts —— production 啟動時 fail-fast
// mock 階段 REQUIRED_SECRETS 可為空：檔案先立好 pattern，加入真密鑰（JWT／簽名連結）時登記進來
export default defineNitroPlugin(() => {
  if (import.meta.dev)
    return
  const config = useRuntimeConfig()
  // mock 認證的 token 可偽造：換成真認證後把 MOCK_AUTH 改成 false。CI 的 E2E 以 NUXT_E2E_RESET=true 跑 production build，不擋
  // 刻意用 mock 版做展示部署（docker compose、npm run preview）也會被擋：確認「登入可被偽造」可以接受，才改成 false
  const MOCK_AUTH = true
  if (MOCK_AUTH && !config.e2eReset)
    throw new Error('[security] 仍是 mock 認證（token 可偽造），拒絕在 production 啟動。換成真認證後把 server/plugins/00.security-guard.ts 的 MOCK_AUTH 改成 false；不要設 NUXT_E2E_RESET 繞過，那會打開資料重設端點')
  const REQUIRED_SECRETS: Array<[key: string, devDefault: string]> = [
    // ['jwtSecret', 'dev-only-change-me'],
  ]
  for (const [key, devDefault] of REQUIRED_SECRETS) {
    const value = (config as Record<string, unknown>)[key]
    if (!value || value === devDefault)
      throw new Error(`[security] runtimeConfig.${key} 未設定或仍為 dev 預設值，拒絕啟動`)
  }
})
```

**② 登入限流**——僅計失敗、成功清零，正常使用者無感；`enabled_features` 含 fileUpload 時，upload／presign 端點同套（每 IP 每分鐘上限）：

```ts
// server/utils/rate-limit.ts —— in-memory 滑動視窗（單實例；serverless 多實例需共享儲存，出現濫用再升級）
const buckets = new Map<string, number[]>()
const MAX_KEYS = 10_000
const SWEEP_WINDOW_MS = 15 * 60 * 1000 // 取各端點最長的視窗（登入 15 分）

// 只刪過期的 key。不可刪還在視窗內的 key：攻擊者能用大量假帳號把受害帳號的失敗次數擠掉
function sweep(): void {
  const now = Date.now()
  for (const [key, hits] of buckets) {
    if (!hits.some(t => now - t < SWEEP_WINDOW_MS))
      buckets.delete(key)
  }
}

export function assertNotRateLimited(key: string, max: number, windowMs: number): void {
  // 新 key 進來時記錄已滿：先清過期的，仍滿就整體拒絕（記憶體有上限、也不會擠掉別人的計數）
  if (!buckets.has(key) && buckets.size >= MAX_KEYS) {
    sweep()
    if (buckets.size >= MAX_KEYS)
      throw createError({ statusCode: 429, message: '嘗試次數過多，請稍後再試' })
  }
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs)
  // 清空就刪 key：沒失敗過的 key 不留空陣列，記憶體才不會只增不減
  if (hits.length)
    buckets.set(key, hits)
  else
    buckets.delete(key)
  if (hits.length >= max)
    throw createError({ statusCode: 429, message: '嘗試次數過多，請稍後再試' })
}
export function recordFailure(key: string): void {
  const hits = buckets.get(key) ?? []
  hits.push(Date.now())
  buckets.set(key, hits)
}
export function clearFailures(key: string): void {
  buckets.delete(key)
}
```

```ts
// login handler 套用（15 分鐘 10 次失敗上限）
// 不讀 X-Forwarded-For：client 可自填、換值即繞過；部署在反向代理後面時才改讀代理設定的可信 header
const key = `login:${getRequestIP(event)}:${body.account}`
assertNotRateLimited(key, 10, 15 * 60 * 1000)
// 驗證失敗 → recordFailure(key) 後 throw 401；驗證成功 → clearFailures(key)
```

**③ 基礎安全標頭**——三個零調校項；嚴格 CSP 需 nonce 基建、逐專案評估，不在 scaffold 範圍：

```ts
// nuxt.config.ts 追加
routeRules: {
  '/**': {
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
},
```

> 嚴格 CSP 的採用與否，上線前由 README「上線前安全檢查」承接評估（採用或不採用都要記錄結論）。

## 4c. CSRF 決策記錄（不做 CSRF token；前提變了即作廢）

**決策**：不做 CSRF token／double-submit——傳統 CSRF 在本架構不成立。

**前提**（三條，以實碼為準）：

1. 請求憑證走 `Authorization: Bearer` header（`useHttp.ts` 內建注入點）——瀏覽器不會自動附帶此 header，跨站請求無法冒用身分
2. cookie 僅供 store persist／SSR hydration（§3a，`sameSite: 'lax'`），不是憑證
3. server 端以 Bearer token 反查身分（`getMockCurrentUser`，phase-1-mock-api §6.4），不從 cookie 讀憑證

**回歸紅線**：任何 server handler 不得把 persist cookie 當憑證讀——`getCookie(event, 'auth')` 取身分即破前提 3。
若未來改為 cookie-based auth（憑證由 cookie 自動帶），本決策作廢，須重新評估 sameSite 策略＋anti-CSRF token。

---

## 5. 收尾 checklist（`feature-to-ui` 末 / vibe-check 提示；僅 auth 專案跳）

- [ ] `app/middleware/auth.global.ts` 存在，`authPublicPaths` 含 `login_path`
- [ ] 未登入訪問受保護頁 → **只導向 `/login` 一次、無 console navigation error**
- [ ] 登入成功後不被彈回 login
- [ ] login 頁與 layout 沒有 authed fetch
- [ ] `test/e2e/specs/01-auth-guard.spec.ts` 存在（範本見 test skill `e2e/references/setup.md` Step 6.5）：未登入訪受保護路由 → 只導向 `/login` 一次、無重複導向錯誤；公開頁不被導走；已登入訪 login 導回
- [ ] `server/plugins/00.security-guard.ts` 存在（§4b①；真密鑰加入時已登記進 REQUIRED_SECRETS），且含 `MOCK_AUTH` 守衛；換成真認證後已改成 `false`
- [ ] login handler 首段有 `assertNotRateLimited`（§4b②；fileUpload 專案的 upload／presign 端點同套）
- [ ] 公開端點已分級：匿名只回已發布資料的公開層欄位、公開寫入不信 body 身分欄位（§4a）
- [ ] 無任何 server handler 從 cookie 讀憑證（grep `getCookie(event, 'auth')` 無命中）；憑證僅走 Authorization header（§4c 前提）
- [ ] persist cookie 已設 `maxAge` 且 ≥ 後端 refresh token 存活期（不設＝session cookie → 閒置被登出）
- [ ] `refresh()` 有跨分頁鎖（`navigator.locks`）且搶到鎖後先重讀 cookie 再決定是否打 API（§3a 三層併發防護）
- [ ] 登出後飛行中 refresh 的結果會被丟棄（`sessionEpoch` guard，§3a）
- [ ] mock refresh 拒絕登出前發的、已過期的、發行時間在未來的 refresh token；mock logout 只對有效 token 的帳號記登出時刻（`revoked-tokens.ts`，§3a）
- [ ] 專案有 SSE/WebSocket 時：refresh 成功後長連線以新 token 重建、連線前驗 exp（近）過期先 refresh——見 realtime skill 鐵律 4、5

---

## 6. Sync 模式

- spec 後來才加 `/auth/*` → Phase 0 偵測到、補寫 route-map.auth + 套用 scaffold，sync-report 標「新增 auth 守門」。
- spec 移除 auth → 不自動刪（避免誤刪自訂），sync-report 標為待人工確認的 auth 孤兒。
