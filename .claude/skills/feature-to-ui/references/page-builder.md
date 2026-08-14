# Nuxt UI Page Builder 規範

> 配色、深淺模式、Nuxt UI 類型、API 規範、Pinia store 規範 → 詳見 [rules.md](rules.md)
>
> 色彩主題設定（app.config.ts、main.css）→ 詳見 [phase-1-theme.md](phase-1-theme.md)

---

## DSL Feature 解析

### 從 Background 提取資料結構

```gherkin
Background:
  Given 系統中有以下使用者：
    | account | password | role   |
    | admin   | admin888 | 管理者 |
```

→ TypeScript 型別：

```typescript
interface User {
  account: string
  password: string
  role: '管理者' | '觀測員'
}
```

### 從 When 提取表單欄位

```gherkin
When 使用者以帳號 "observer1" 密碼 "pass123" 登入
```

→ 表單欄位：`account`, `password`

### 從 Rule 提取驗證規則

| DSL Rule | Zod 驗證 |
|----------|----------|
| `站號範圍為 0-99` | `z.number().min(0).max(99)` |
| `必填欄位` | `z.string().min(1, '請輸入...')` |
| `帳號或密碼錯誤` | API 層驗證，前端顯示錯誤 |

### 從 Then 提取錯誤訊息

```gherkin
Then 操作失敗
And 系統顯示 "帳號或密碼錯誤"
```

→ Toast error 或 Alert

---

## Command 類型對應

> 下表動詞是**語意分類訊號，非字面白名單**：依 Scenario 的**語意**判斷此操作屬哪一類（「查詢 / 列表 / 一覽 / 清單 / list / browse」皆屬 list 類；命名不同但語意相同照樣套對應元件）。拿不準屬哪一類時，跟操作者確認再定，別硬比字面。

| DSL Command | UI 元件 | 必要元素 |
|-------------|---------|----------|
| `登入` | 表單 + UButton | 密碼眼睛 icon |
| `建立 XXX` | 表單 + Modal | |
| `編輯 XXX` | 表單（預填） | |
| `刪除 XXX` | 確認 Modal | |
| `查詢 XXX 列表` | UTable | **必須有搜尋框** |
| `排序 XXX` / `調整順序` | vuedraggable（拖曳） | drag handle icon |
| `篩選 XXX` | USelect / USelectMenu | 篩選條件選項 |
| `批次刪除` / `批次操作` | UTable checkbox + 批次按鈕 | 全選/取消全選 |
| `上傳 XXX` | UInput type="file" / 拖放區 | 檔案格式提示 |
| `切換狀態` / `啟用/停用` | UToggle / USwitch | 狀態標籤文字 |
| `匯出 XXX` | UButton（下載觸發） | loading 狀態 |

> **重要**：**list 類**頁面（依語意判斷，不限「查詢」二字）→ UI 必須包含搜尋框

---

## 操作結果對應

| DSL Then | UI 處理 |
|----------|---------|
| `操作成功` | Toast success + 刷新畫面或導向（依情境，見「資料新鮮度」） |
| `操作失敗` | Toast error |
| `系統顯示 "..."` | 顯示錯誤訊息 |
| `系統回傳 ...` | 儲存到 state |

---

## 資料新鮮度（寫入後刷新）—— 必守，否則畫面 stale

寫入（建立/編輯/刪除）成功後，**畫面上的列表/詳情不會自己更新**——必須主動刷新，否則使用者看到舊資料。
`useHttp().get()` 回傳的就是 Nuxt `AsyncData`，本來就帶 `refresh`，用它即可，**不需要新 composable**。

**三條鐵律：**

1. **要保持最新的 list / detail 一律用 `get()`（reactive），不要用 `getOnce` 把資料存進 local `ref`** —— `getOnce` 是一次性的，存進 ref 後沒有刷新管道。
2. **寫入（`post / patch / delete`）後要讓畫面反映最新** —— 做法依「寫完去哪」而定，見下方情境表（不是每種都要手動 `refresh`）。
3. **跨元件（子 modal 寫、父層列表讀）用 `refreshNuxtData(key)`** —— 列表的 `get()` 帶穩定 `key`，子元件寫完後 `await refreshNuxtData(key)` 觸發父層重抓。

**依「寫完去哪」選刷新方式：**

| 寫完的去向 | 怎麼拿到最新 | 為何 |
|-----------|------------|------|
| **跨頁導航**：編輯頁 `navigateTo` 回列表頁（最常見的「編輯完回列表」） | 列表頁用 `get({ key })` 即可，**不必手動 refresh** | client 端導航會重新掛載列表頁、`useFetch` 預設重抓；只有 hydration 當下才吃 payload 快取 |
| **同頁** inline / modal 寫入（不離開列表頁） | 寫完 `await refresh()`（同元件 `get()` 的 refresh） | 沒有重新掛載 → 不會自動重抓，要手動觸發 |
| **子元件寫、父層列表讀**（不離開頁面） | 子元件寫完 `await refreshNuxtData(key)` | 跨元件沒有共享的 refresh 控制權，用 key 觸發父層重抓 |

> ⚠️ 真正會「編輯完回頁面卻還是舊資料」的，是把 list 用 `getOnce` / `$fetch` 抓一次塞進 `useState` / `ref` / Pinia 當快取——回頁面時看到快取就跳過重抓（違反鐵律#1）。一律用 `get()`，別自建列表快取層。

**同元件範例（列表 + 建立 modal）：**

```vue
<script setup lang="ts">
import type { CreateSiteBody } from '~/types/api/sites'
import { createSite, listSites } from '~/api'

const toast = useToast()
// 列表用 get()（reactive）+ 穩定 key，拿到 refresh 控制權
const { data: sites, refresh } = listSites({ key: 'sites' })

async function handleCreate(body: CreateSiteBody) {
  await createSite(body)
  toast.add({ title: '建立成功', color: 'success' })
  await refresh() // ← 寫入後刷新，列表立即反映最新資料（少了這行就會 stale）
}
</script>
```

**跨元件範例（子 modal 寫、父層列表讀）：**

```ts
// 父層：列表帶穩定 key
const { data: sites } = listSites({ key: 'sites' })

// 子元件（建立 modal）：寫完用同一把 key 觸發父層重抓
await createSite(body)
await refreshNuxtData('sites')
```

> ⚠️ 別把刷新寫成「手動再 push 一筆進 local array」——那會與後端真實狀態漂移（漏算衍生欄位、排序、權限過濾）。一律重抓。

---

## 載入佔位（skeleton）——分頁切換體感

頁面**主資料**的 `get()` 一律帶 `lazy: true`，template 以 `status === 'pending'` 渲染 `USkeleton` 佔位（列表 → 3-5 條 skeleton 列；詳情 → 標題＋內容區塊）。

**為什麼要 lazy**：預設 blocking `useFetch` 在 client 導航時會擋住換頁、舊頁停留到資料回來，skeleton 沒機會出現；`lazy: true` 讓切頁即時、pending 態可見（頂部進度條由 app.vue 的 `<NuxtLoadingIndicator>` 負責，兩層合起來才是完整體感）。SSR 首次載入不受影響——server 端照樣出完整 HTML。

**邊界：**

| 規則 | 說明 |
|------|------|
| 只有頁面主資料 lazy | modal 內、次要資料照舊（不 lazy） |
| 用 `status === 'pending'` 判斷 | `immediate: false` 時初始 `status` 是 `'idle'` 非 `'pending'`（見 `rules/framework-skills.md`） |
| 狀態互斥順序 | `pending` → skeleton；成功且空 → `#empty`；有資料 → 列表——避免載入中閃現空狀態 |
| skeleton 容器加 `aria-busy="true"` | 語意化載入標記；**不加**額外 `data-testid`（守「fallback testid 不多加、不漏」） |
| animation 依 `ui-config.yaml > loading.skeleton` | `pulse` ＝ USkeleton 預設 `animate-pulse`，不用另外設 |

**列表頁範例：**

```vue
<script setup lang="ts">
import { listSites } from '~/api'

// 主資料 lazy：切頁即時，pending 期間渲染 skeleton
const { data: sites, status } = listSites({ key: 'sites', lazy: true })
</script>

<template>
  <!-- pending → skeleton（容器標 aria-busy，不加 testid） -->
  <div v-if="status === 'pending'" aria-busy="true" class="space-y-3">
    <USkeleton v-for="i in 4" :key="i" class="h-12 w-full" />
  </div>
  <!-- 成功且空 → 空狀態；有資料 → 列表（UTable 用 #empty slot 同理） -->
  <div v-else-if="!sites?.length">尚無資料</div>
  <UTable v-else :data="sites" ... />
</template>
```

---

## 禁止事項（僅列本檔獨有，配色/testid 規則 → [rules.md](rules.md)）

| 禁止 | 正確做法 |
|------|----------|
| 自行定義網站名稱 | 從 `project.name` 讀取 |
| 寫死 Toast 時間 | 從 `toast.duration` 讀取 |
| 手動定義 `--ui-color-*` / `--ui-*` 變數 | Nuxt UI plugin 自動從 `--color-*` 橋接，禁止手動覆蓋 |
| UFormField 錯誤訊息樣式不確定 | 依 `/nuxt-ui` MCP 文檔的 UFormField 用法為準 |
| app.vue 缺少 UApp 或 NuxtLayout | Phase 3 建 Layout 後必須更新 app.vue |

## testid

> **Phase 5**：直接從 `.spec.ts` 的 `getByTestId()` 複製，不自行推導；spec 沒用到就不加。
> **Phase 2**：**不產 testid**（骨架只給語意結構，見 [phase-2-skeleton.md](phase-2-skeleton.md)）。
> 規範 SSOT：[testid-conventions.md](../../feature-to-flow/references/testid-conventions.md)。
> 列表內重複的按鈕優先用語意收窄（`getByRole('row', { name: /陳小明/ }).getByRole('button', { name: /刪除/ })`），而非替每列產 testid。

---

## 表單範本

### 登入表單（含 Auth Store）

> 這是 **auth 專案唯一的 login 範本**（auth scaffold 的 UI 層由此處提供，見 feature-to-api `references/auth-scaffold.md` §3b）。
> 防迴圈：login 頁與其 layout **不得發 authed fetch**；只呼叫 `authStore.login`（內部端點 `handleUnauthorized:false`）。

```vue
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
// ⚠️ 必須明確 import store，不可依賴 auto-import
import { useAuthStore } from '~/stores/auth'
import { readApiError } from '~/utils/api-error'

const authStore = useAuthStore()
const config = useRuntimeConfig().public
const toast = useToast()

const schema = z.object({
  account: z.string().trim().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
})
type Schema = z.output<typeof schema>

const state = reactive<Schema>({ account: '', password: '' })
const isSubmitting = ref(false)
const showPassword = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return // 防止重複提交
  isSubmitting.value = true
  try {
    await authStore.login(event.data) // login(body)，登入後內部補抓 /auth/me
    toast.add({ title: '登入成功', color: 'success' })
    await navigateTo(config.authHomePath || '/') // 導向設定的登入後首頁
  }
  catch (error) {
    toast.add({ title: '登入失敗', description: readApiError(error, '帳號或密碼錯誤'), color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="mx-auto w-full max-w-sm space-y-4"
    @submit="onSubmit"
  >
    <UFormField
      label="帳號"
      name="account"
      class="relative mb-8"
      :ui="{ error: 'absolute top-full left-0 mt-1' }"
    >
      <UInput v-model="state.account" class="w-full" />
    </UFormField>
    <UFormField
      label="密碼"
      name="password"
      class="relative mb-8"
      :ui="{ error: 'absolute top-full left-0 mt-1' }"
    >
      <UInput
        v-model="state.password"
        :type="showPassword ? 'text' : 'password'"
        class="w-full"
      >
        <template #trailing>
          <UButton
            :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
            color="neutral"
            variant="link"
            size="sm"
            :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'"
            @click="showPassword = !showPassword"
          />
        </template>
      </UInput>
    </UFormField>
    <UButton type="submit" :loading="isSubmitting" block>
      登入
    </UButton>
  </UForm>
</template>
```

> **不放 testid 是刻意的**：`UFormField` 的 `label` 已把 `帳號`／`密碼` 綁成 accessible name（`<label for>` 關聯），送出鈕有可見文字「登入」——`test/e2e/helpers` 的 `login()` 用 `getByLabel('帳號', { exact: true })` ＋ `getByRole('button', { name: /登入/ })` 就定位得到（見 [setup.md](../../test/e2e/references/setup.md)）。表單欄位 testid 是 SSOT [testid-conventions.md](../../feature-to-flow/references/testid-conventions.md) 明文禁止的形式。
>
> ⚠️ **欄位內 icon 按鈕的 `aria-label` 不得包含該欄位的 label 字串**。Playwright 的 `getByLabel` 對任何帶 `aria-label` 的元素都會回傳該值（不限 form control），所以密碼欄配上 `aria-label="顯示密碼"` 時，`getByLabel(/密碼/)` 會同時命中 input 與該按鈕 → strict mode violation（實測 count=2）。上面範本用 `顯示密碼`／`隱藏密碼` 是為了 a11y 可讀性，因此 `login()` 端**必須**用 `exact: true` 匹配；若你改用 regex 匹配，就要把 aria-label 換成不含「密碼」的字（如 `切換顯示`）。
>
> **改動此範本的 label／按鈕文案時，要同步 `setup.md` 的 `login()` helper**——兩者是一對耦合。

### 一般表單

```vue
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'

const schema = z.object({
  account: z.string().trim().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  account: '',
  password: '',
})

const loading = ref(false)
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: event.data,
    })
    toast.add({ title: '登入成功', color: 'success' })
    await navigateTo('/')
  }
  catch (error: any) {
    const message = error?.data?.message || '操作失敗'
    toast.add({ title: '登入失敗', description: message, color: 'error' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
  >
    <!-- UFormField 用法依 /nuxt-ui MCP 文檔為準 -->
    <!-- 不放 testid：label 與按鈕文字即 accessible name，helpers 的 login() 靠它定位 -->
    <UFormField
      label="帳號"
      name="account"
    >
      <UInput
        v-model="state.account"
        class="w-full"
      />
    </UFormField>
    <UFormField
      label="密碼"
      name="password"
    >
      <UInput
        v-model="state.password"
        type="password"
        class="w-full"
      />
    </UFormField>
    <UButton
      type="submit"
      :loading="loading"
    >
      登入
    </UButton>
  </UForm>
</template>
```

---

## 密碼欄位範本

```vue
<script setup>
const showPassword = ref(false)
</script>

<template>
  <UFormField
    label="密碼"
    name="password"
    class="relative mb-8"
    :ui="{ error: 'absolute top-full left-0 mt-1' }"
  >
    <UInput
      v-model="state.password"
      :type="showPassword ? 'text' : 'password'"
      class="w-full"
    >
      <template #trailing>
        <UButton
          :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
          color="neutral"
          variant="link"
          size="sm"
          :padded="false"
          :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'"
          @click="showPassword = !showPassword"
        />
      </template>
    </UInput>
  </UFormField>
</template>
```

---

## 技術注意事項

### Tailwind v4 !important

```
[X] 舊語法：[&_td]:!h-12
[O] 新語法：[&_td]:h-12!
```

### Icons 套件

```bash
npm i -D @iconify-json/heroicons @iconify-json/lucide
```
