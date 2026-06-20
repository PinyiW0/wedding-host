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

## Zod v4 規範 `[P5]`

```typescript
// [X] Zod v3（禁止 required_error、invalid_type_error）
z.number({ required_error: '請輸入背號' })

// [O] Zod v4：用 error 或 validator message
z.number({ error: '請輸入背號' })
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
// [X] { label: '全部球隊', value: '' }  → 報錯
// [O]
const selected = ref<string | undefined>(undefined)
```

```vue
<USelect v-model="selected" :items="options" value-key="value" placeholder="全部球隊" />
```

> API query 判斷：`...(selected.value ? { team_id: selected.value } : {})`

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
const positionOptions = ['投手', '捕手', '一壘手', '游擊手']
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

### 檔案結構 → 呼叫路徑

| 檔案 | 路徑 | 方法 |
|------|------|------|
| `server/api/teams/index.get.ts` | `/api/teams` | GET |
| `server/api/teams/[id].put.ts` | `/api/teams/${id}` | PUT |
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

## 程式碼品質檢查規範 `[P5]`

每個頁面實作完成後，**必須依序執行以下三項檢查**，針對本次新增或修改的檔案：

```bash
npx eslint <file> --fix          # ESLint 檢查 + 自動修復（@antfu/eslint-config）
npx prettier --write <file>      # Prettier 格式化（含 Tailwind class 排序）
npm run typelint                  # TypeCheck 型別檢查（nuxi typecheck）
```

- 有錯誤 → 修復後重新執行，直到全部通過
- **三項全部通過才可向用戶輸出確認格式**

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

### 來源優先級

- **Phase 5**：直接從 `test/e2e/specs/*.spec.ts` 的 `getByTestId()` 複製（唯一來源，不讀 elements.md）
- **Phase 2**：`spec/e2e-flows/pages/{page}.elements.md`（若存在）→ 下方命名規則（備用）

### 命名格式：`{page}-{element}`

| 類型 | 範例 |
|------|------|
| 頁面容器 | `teams-page` |
| 輸入欄位 | `team-name` |
| 按鈕 | `team-create`, `team-save`, `team-edit`, `team-delete` |
| 列表 | `team-list` |
| 確認彈窗 | `confirm-modal`, `confirm-ok`, `confirm-cancel` |

> 確認彈窗 testid 以 `spec/e2e-flows/_common.flow.md` 為準。

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
