# 共用規則（跨 Phase 權威來源）

> 所有 Phase 共用的規則集中在此。各 phase 檔和 page-builder.md、components.md 引用此檔，不重複定義。
>
> **Phase Tag 說明**：每個段落標題標注 `[Px, Py]` 表示該段落適用的 Phase。
> 各 Phase 只需讀取標有自己編號的段落，以節省 context window。
>
> **Phase 編號對照**（Phase 0-1 已移至 `/feature-to-api`）：
> P1=基礎設定 | P2=路由骨架 | P3=Layout | P4=共用元件 | P5=頁面實作

---

## 配色策略 `[P1, P3, P4, P5]`

UI 配色以 **primary + neutral** 為主（佔 90%），語意色只用在狀態回饋（佔 10%）。

| 顏色 | 使用場景 |
|------|---------|
| `primary` | 按鈕 solid、連結、active 狀態、hover 強調、sidebar active |
| `neutral` | 背景、文字、邊框、分隔線、ghost 按鈕 |
| `success` | toast 成功、狀態 badge |
| `error` | toast 失敗、刪除按鈕、表單驗證錯誤 |
| `warning` | toast 警告、注意 badge |

```vue
<!-- 主要按鈕 primary，次要 neutral，刪除 error -->
<UButton color="primary">儲存</UButton>
<UButton color="neutral" variant="outline">取消</UButton>
<UButton color="error" @click="handleDelete">刪除</UButton>

<!-- hover 用 primary -->
<NuxtLink class="hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950 dark:hover:text-primary-400">
```

> 禁止用 `secondary`、`accent`、具體色名（`blue`、`purple`）做配色。

---

## 深淺模式與對比色 `[P1, P3, P4, P5]`

所有顏色必須使用響應式 Tailwind class，不可寫死單一模式。

### 常用顏色 class

| 用途 | Tailwind class |
|------|---------------|
| 主要文字 | `text-neutral-900 dark:text-white` |
| 次要文字 | `text-neutral-500 dark:text-neutral-400` |
| 頁面背景 | `bg-neutral-100 dark:bg-neutral-950` |
| 卡片/側欄背景 | `bg-white dark:bg-neutral-900` |
| 邊框 | `border-neutral-200 dark:border-neutral-800` |
| Primary 強調文字 | `text-primary-600 dark:text-primary-400` |
| Success 文字 | `text-success-600 dark:text-success-400` |
| Error 文字 | `text-error-600 dark:text-error-400` |

```vue
<!-- [X] 固定 500 在某個模式下對比不足 -->
<span class="text-primary-500">文字</span>

<!-- [O] 600/400 組合確保雙模式 WCAG AA -->
<span class="text-primary-600 dark:text-primary-400">文字</span>
```

> 例外：在 `bg-success-500` 等彩色背景上，可固定使用 `text-white`。

---

## SSR / Hydration 安全 `[P3, P4, P5]`

Nuxt 預設 SSR：server 先渲染 HTML，client hydration 重算一次。**兩端算出不同結果 = hydration mismatch**（dev console 出現 `Hydration ... mismatch` 警告，E2E 守門會攔）。完整踩坑清單見 nuxt skill 的 `references/best-watches-ssr.md`。

### 正確心智模型：persist 預設存 cookie，SSR 讀得到

`pinia-plugin-persistedstate/nuxt` 預設 storage 是 **cookie**（不是 localStorage）。SSR 請求帶 cookie → server 端 store 有同一份登入狀態 → 兩端渲染一致。auth middleware 因此是**全端守衛**（範本見 [phase-2-skeleton.md](phase-2-skeleton.md)「Auth middleware 範本」，SSR 與 client 都執行）。

```typescript
// [X] 錯誤心智模型：以為 persist 存 localStorage、SSR 讀不到，middleware 加 server 守衛
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return // ← 讓 SSR 渲染出「未登入版」，反而製造 mismatch
  // ...
})
```

> 顯示 `authStore.account` 等登入欄位的地方**不需要** `<ClientOnly>`——cookie 讓 SSR 拿到同一份登入狀態，包了反而造成登入後首屏閃「未登入」。（store 欄位是扁平的 `account` / `name` / `roles`，沒有 `user` 物件。）

### colorMode 渲染必包 ClientOnly

server 不知道使用者的深淺偏好，`colorMode.value` 兩端必不同。渲染它一律包 `<ClientOnly>` + **同尺寸 fallback**（避免 layout shift）：

```vue
<!-- [X] 直接渲染 colorMode.value → 必 mismatch -->
<UIcon :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" class="size-5" />

<!-- [O] ClientOnly + 同尺寸 fallback -->
<ClientOnly>
  <UIcon :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" class="size-5" />
  <template #fallback>
    <UIcon name="i-heroicons-moon" class="size-5" />
  </template>
</ClientOnly>
```

### 非確定值與 browser API

| 禁止（兩端不同值） | 正確做法 |
|------|----------|
| template 渲染 `Date.now()`、`Math.random()`、`new Date()` 格式化當下時間 | 值放 `ref('')`，`onMounted` 再填 |
| `<script setup>` 頂層讀 `window` / `localStorage` / `navigator` | 移入 `onMounted`，或 `if (import.meta.client)` |
| `v-if` 條件只有 client 成立（螢幕寬度、瀏覽器特性） | 包 `<ClientOnly>`；或 `isClient` flag（`onMounted` 設 true） |

### useFetch 首屏一致性

首屏資料用 `useFetch`（SSR 取一次、payload 帶到 client 不重抓）。**不要**為「避開 SSR」改成 `onMounted + $fetch` 或無理由 `server: false`——製造首屏空白閃爍與兩端不一致。

---

## 視覺層級 `[P3, P4, P5]`

文字層級、文字顏色層級、載體字級、按鈕尺寸的權威來源是 `.claude/rules/visual-hierarchy.md`（skill 已 `@` 載入）。
硬規則：字級預設用 Tailwind 內建（`text-xs`~`text-4xl`）；禁止 `text-[Npx]` 任意值與未在 `@theme` 定義的具名 token（未定義 token 會靜默失效）。

---

## Zod v4 規範 `[P5]`

```typescript
// [X] Zod v3（禁止 required_error、invalid_type_error）
z.number({ required_error: '請輸入站號' })

// [O] Zod v4：用 error 或 validator message
z.number({ error: '請輸入站號' })
z.string().min(1, '請輸入姓名')  // 推薦
```

---

## Nuxt UI 類型規範 `[P4, P5]`

### TableColumn

```typescript
import type { TableColumn } from '@nuxt/ui'
// [O] v3+：accessorKey + header
const columns: TableColumn<MyItem>[] = [{ accessorKey: 'name', header: '名稱' }]
// [X] v2：id + label
```

### UTable @select

```typescript
// [O] 接收 (event, row) 兩個參數
function handleSelect(_e: Event, row: { original: MyItem }) { ... }
```

### UButton color 類型

```typescript
// [O] 用 union type，不用 string
confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
```

### UCheckbox @update:model-value

```typescript
// [O] 參數必須包含 'indeterminate'
(val: boolean | 'indeterminate') => selection[row.index] = val === true
```

### USelect value 不可為空字串

Nuxt UI v3 的 `<USelect>` **禁止** `value: ''`。「全部/不篩選」用 `undefined` + `placeholder`：

```typescript
// [X] { label: '全部觀測點', value: '' }  → 報錯
// [O]
const selected = ref<string | undefined>(undefined)
```

```vue
<USelect v-model="selected" :items="options" value-key="value" placeholder="全部觀測點" />
```

> API query 判斷：`...(selected.value ? { site_id: selected.value } : {})`

### FormSubmitEvent

```typescript
import type { FormSubmitEvent } from '@nuxt/ui'
async function onSubmit(event: FormSubmitEvent<MySchema>) { ... }
```

---

## 表單型別安全模式 `[P4, P5]`

### USelect options 不標窄型別

USelect 從 items 的 value 推斷 v-model 型別。窄型別會和 Zod 的 `string` 衝突。

```typescript
// [O] 用 string[]
const positionOptions = ['觀測站', '捕手', '一壘手', '游擊手']
// [X] 標 Position[] → 和 Zod 的 string 打架
```

> 窄型別（Position、Status）只用於 `types/api/` 定義，不用於表單 options。

### useFetch 陣列資料用 computed 標型別

```typescript
// [O] 避免 template v-for 推斷為 unknown
const heatMapPoints = computed<HeatMapPoint[]>(() => analysis.value?.heat_map_data ?? [])
```

---

## API 規範 `[P5]`

實作頁面前，**必須先 `glob server/api/**/*.ts` 確認實際 API 路徑**。

| 規則 | 說明 |
|------|------|
| 禁止假設路徑 | 先確認檔案存在再呼叫 |
| 禁止 `globalThis.$fetch` | 用正確路徑，不繞過型別 |
| 禁止定義 local interface | 從 `~/types/api/` import |
| API 不存在 | 先建 API，不跳過 |

### 契約缺口：GET 讀不回要顯示的欄位 → 停下回報 `[P5]`

頁面要顯示的資料，唯一合法來源是 GET 端點回傳（經 useFetch / store）。實作時發現「這個欄位 command 寫得進去，但對應 GET 回傳沒有（或根本沒 GET）」：

1. **停止該頁實作**，回報契約缺口：哪個 command 寫入哪些欄位、哪個 GET 缺
2. 等 `/feature-to-api` 補讀回端點／欄位（見其 phase-1「讀回完整性自查」）後再繼續
3. **禁止**用 local ref / store 暫存 command payload 兜出畫面——當下顯示正常、重新整理即丟，且同 session 的 e2e 完全抓不到（wedding-host 實戰：此 pattern 對全部測試隱形，事後補了 7 個 GET 才修完）

### 檔案結構 → 呼叫路徑

| 檔案 | 路徑 | 方法 |
|------|------|------|
| `server/api/sites/index.get.ts` | `/api/sites` | GET |
| `server/api/sites/[id].put.ts` | `/api/sites/${id}` | PUT |
| `server/api/ai/start.post.ts` | `/api/ai/start` | POST |

---

> **Server API 類型規範和 Mock API 回傳慣例已移至 `/feature-to-api` 的 [rules.md](../../feature-to-api/references/rules.md)**。

---

## 第三方元件必須手動 import `[P4, P5]`

Nuxt 不自動註冊第三方套件元件，必須手動 import：

```typescript
import Draggable from 'vuedraggable'
```

---

## Pinia Store 規範 `[P5]`

```typescript
// [X] 依賴 auto-import → "useAuthStore is not defined"
const authStore = useAuthStore()

// [O] 明確 import
import { useAuthStore } from '~/stores/auth'
const authStore = useAuthStore()

// [O] 登入用 store 方法（狀態自動 persist），不直接 $fetch
await authStore.login(account, password)
```

---

## 角色導向 UI 可見性 `[P2, P5]`

**條件式**：僅當 `route-map.yaml` 有 `rbac` 區塊時套用（偵測規則與合約見 `/feature-to-api` 的 [rbac-scaffold.md](../../feature-to-api/references/rbac-scaffold.md)）。無 rbac 區塊 → 不加任何角色守門。

角色來自 auth-scaffold 的 store（`authStore.roles`，由 `/auth/me` 填入）。**雙層守門**：入口隱藏（看不到）+ 路由 middleware（直接打 URL 也進不去），mock `requireRole` 在 API 層兜底回 403。

### 入口 / 操作鈕隱藏 `[P5]`

選單入口與危險操作鈕依角色 `v-if` 隱藏。角色名用 `route-map.rbac` 的實際值，**不寫死**：

```vue
<!-- [O] 受保護路由的選單入口：無權角色不顯示 -->
<NuxtLink v-if="authStore.roles.includes('super_admin')" to="/accounts">帳號管理</NuxtLink>

<!-- [O] 危險操作鈕：依角色顯示 -->
<UButton v-if="authStore.roles.includes('super_admin')" color="error" @click="handleDelete">刪除帳號</UButton>

<!-- [X] 顯示鈕但點了才說無權（壞 UX，且依賴 API 才知道擋） -->
```

> ⚠️ 入口隱藏是 UX，不是安全邊界——真正擋住靠下方 middleware + mock requireRole。但仍要隱藏，避免使用者點到死路。

### 路由守門 `[P2]`

`app/middleware/rbac.global.ts` 讀 `route-map.rbac.protected_routes`，當前角色不在 `allow` → 導向 `/403`（never-nav-current、別導到自己造成 loop，比照 `auth.global.ts`）。範本見 [phase-2-skeleton.md](phase-2-skeleton.md)「RBAC route guard」段。

---

## 程式碼品質檢查規範 `[P5]`

每個頁面實作完成後，**必須依序執行以下檢查**：

```bash
npx eslint <file> --fix          # 自動修復（@antfu/eslint-config；僅修復手段，不作驗證依據）
npx prettier --write <file>      # Prettier 格式化（含 Tailwind class 排序）
npm run eslint                    # ESLint 驗證（含 visual-hierarchy-check，與 CI 同一條）
npm run typelint                  # TypeCheck 型別檢查（nuxi typecheck）
```

- 有錯誤 → 修復後重新執行，直到全部通過
- **全部通過才可向用戶輸出確認格式**

---

## Business Invariant 文字 `[P5]`

`test/e2e/specs/*.spec.ts` 內 `getByText(...)`、`toContainText(...)` 取出的字串是 **Business Invariant 落點**。UI 與 spec **必須引用同一份字串來源**，避免 runtime 漂移。

### 首選方案：typed invariant constants

優先使用集中常數檔，UI 與 spec 同 import：

```typescript
// 常數檔（位置與結構見 /feature-to-api 的 invariants.md）
export const {GROUP} = {
  {STATE_KEY}: '{invariant text}',
} as const

// UI template
<script setup>
import { {GROUP} } from '~/constants/invariants'
</script>
<span>{{ {GROUP}.{STATE_KEY} }}</span>

// spec.ts
import { {GROUP} } from '~/constants/invariants'
await expect(row).toContainText({GROUP}.{STATE_KEY})
```

**為什麼**：TypeScript 編譯期保證 UI 與 spec 對齊，文字漂移從 runtime 紅燈降為 compile-time 錯誤。vibe iteration 改錯字會被 TS 立刻擋，不需跑 playwright。

**規範細節**：見 [`/feature-to-api` 的 invariants.md](../../feature-to-api/references/invariants.md)。

### Fallback：未遷移到常數時的 hardcode 規則

若某段 invariant 文字尚未遷移到常數，UI 直接 hardcode 字面字串時必須遵守：

#### 禁止行為

| ❌ 禁止 | 例 |
|--------|------|
| 翻譯成其他語言 | `{invariant}` →（譯文）|
| 同義詞替換 | `{invariant}` →（同義詞 1）（同義詞 2）|
| 純 icon 替代（無文字） | icon + 無文字 |
| 拆字加裝飾 | `{invariant}` → `{部分 1}` + icon + `{部分 2}` |

#### 允許的並存方案

icon 與文字並排，或 icon + `<span class="sr-only">` 保留文字給 screen reader 與 spec：

```vue
<!-- [X] 純 icon 表達狀態 -->
<UIcon name="..." />

<!-- [X] 翻譯 / 同義詞 -->
<span>{translated or synonym}</span>

<!-- [O] icon + 文字併排 -->
<div class="flex items-center gap-1">
  <UIcon name="..." />
  <span>{INVARIANT_TEXT}</span>
</div>

<!-- [O] icon-only 視覺，但保留 a11y 文字 -->
<button>
  <UIcon name="..." />
  <span class="sr-only">{INVARIANT_TEXT}</span>
</button>
```

#### regex 同義詞集合的選擇規則

若 spec assertion 是 regex 同義詞集合（`/A|B|C/`），代表 UI 端尚未統一——應**優先收斂為單一字串並遷移到常數**。
過渡期若仍 hardcode，UI **必須挑其中一個固定字串寫死全頁**，不可同頁混用。

### 改字流程

修改任一 invariant 文字 = 修改業務合約。**必須走**：

1. 改 `.flow.md` 的 Business Invariants 文字
2. 改 invariants 常數檔（如已遷移）
3. 重跑 `/test e2e spec` 重生對應 spec
4. 才能改 UI 引用

**禁止**：
- 直接改 UI 不動 spec / 常數 → 主 spec 紅燈
- 直接改 spec → 違反 SSOT 凍結
- regex 集合加 `/A|B/` 兩邊收 → 污染

### 來源權威

`.spec.ts` 與 invariants 常數檔互為 SSOT（同 import 同字串）。`.flow.md` Business Invariants 段為**人類可讀的合約定義**，spec 與常數實作之。

---

## testid 規範 `[P2, P5]`

> **testid 命名規範的 SSOT 是 [`feature-to-flow/references/testid-conventions.md`](../../feature-to-flow/references/testid-conventions.md)**（優先序、允許清單、禁止清單、命名格式全在該檔）。本節不重列規則——雙寫必漂移。

**本 skill 要遵守的兩條**：

- **testid 是 fallback，不是預設**：優先給語意 anchor（role + accessible name、label、可見文字）。只有在 SSOT 的「允許清單」情境（role+name 無法消歧、純樣式元素無語意角色、動態狀態屬性）才用 testid
- **Phase 5 的 testid 唯一來源是 `test/e2e/specs/*.spec.ts`**：spec 用到 `getByTestId` 之處逐字複製，spec 沒用到就不要自己加。**禁止越權**——合約外的 testid 會被 `/vibe-e2e` 判為孤兒（`vibe-e2e/SKILL.md` 的 `orphan-testid`）

> SSOT 明文**禁止**的幾類（別再產）：`{page}-page` 容器 testid、`{entity}-{field}-input` 等表單欄位 testid（用 `getByLabel(/欄位名/)` 找）、column-level testid。理由與反例見 SSOT 的「禁止清單」段。

---

## Layout 規範 `[P3]`

### Sidebar

1. **可收合**：展開 `w-64` / 收合 `w-16`，收合按鈕在 sidebar 內
2. **底部功能區**：會員名稱、登出、深淺切換，固定底部
3. **收合時**：`flex-col` + `UTooltip` 垂直排列
4. **配色**：hover 用 `primary`，不混語意色

### Mobile Top Bar

- **禁止** `fixed`/`absolute` 定位漢堡按鈕
- 使用 in-flow（`lg:hidden`）+ `shrink-0` + `border-b`

---

## 響應式禁止事項 `[P5]`

| 禁止 | 正確做法 |
|------|----------|
| 固定寬度 `w-[500px]` | `w-full max-w-md` |
| 表格不處理小螢幕 | 隱藏次要欄位或水平滾動 |
| Modal 固定寬度 | `w-full sm:max-w-md` |
| 忽略行動裝置 | 實作響應式 |
| Sidebar 不可存取 | 提供漢堡選單 |
