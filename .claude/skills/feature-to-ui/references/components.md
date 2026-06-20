# 元件規範（Phase 5 使用參考）

> **本檔用途**：Phase 5 實作頁面時，查閱「如何使用」共用元件的範例與規則。
> **元件原始碼**（props、slots、events 定義）→ 詳見 [phase-4-components.md](phase-4-components.md)
> Nuxt UI 類型規範、API 規範、配色策略 → 詳見 [rules.md](rules.md)

## 表單元件

### 寬度規則

所有表單元件必須使用滿版寬度：

```vue
<!-- 單一欄位：滿版 -->
<UFormField label="帳號" name="account">
  <UInput v-model="state.account" class="w-full" />
</UFormField>

<!-- 多欄並排：grid -->
<div class="grid grid-cols-2 gap-4">
  <UFormField label="背號" name="number">
    <UInput v-model="state.number" class="w-full" />
  </UFormField>
  <UFormField label="身高" name="height">
    <UInput v-model="state.height" class="w-full" />
  </UFormField>
</div>
```

### 錯誤訊息高度預留

```vue
<!-- 使用 min-h 預留空間 -->
<UFormField label="帳號" name="account" class="min-h-18">
  <UInput v-model="state.account" class="w-full" />
</UFormField>
```

### Input 值自動清除空白

```typescript
// 推薦：Zod schema 處理
const schema = z.object({
  account: z.string().trim().min(1, '請輸入帳號'),
})
```

---

## 列表頁面佈局

### 必備條件

| 規則 | 說明 |
|------|------|
| 預設每頁 10 筆 | 可依 feature 需求加入筆數選擇器（見下方範例） |
| Pagination 右下角 | `justify-end` |
| 容器滿高 | `flex h-full flex-col` |
| Pagination 永遠顯示 | 即使只有一頁 |
| Mock 資料 ≥ 11 筆 | 確保分頁可測試 |

### 筆數選擇器（選用）

當 feature 需要可調整每頁筆數時，使用 `pageSizeStr`（string）+ `pageSize`（computed number）模式：

```typescript
// ⚠️ USelect v-model 必須是 string，pageSize 需 computed 轉為 number
const pageSizeStr = ref('20')
const pageSize = computed(() => Number(pageSizeStr.value))
const pageSizeOptions = [
  { label: '10 筆/頁', value: '10' },
  { label: '20 筆/頁', value: '20' },
  { label: '50 筆/頁', value: '50' },
]
```

```vue
<USelect v-model="pageSizeStr" :items="pageSizeOptions" value-key="value" class="w-32" />
```

> ⚠️ 篩選條件（含 pageSizeStr）變更時必須重設 `page = 1`。

### 完整範本

```vue
<script setup lang="ts">
// ⚠️ 必須從 types/api/ import 型別，禁止定義 local interface
import type { TeamItem } from '~/types/api/teams'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const currentPage = ref(1)
const pageSize = 10

// ⚠️ 呼叫前先讀取對應的 API endpoint 原始碼確認回傳格式
const { data } = await useFetch<{
  status: string
  data: TeamItem[]
}>('/api/teams', {
  query: computed(() => ({
    user: authStore.userAccount,
    role: authStore.userRole,
  })),
})

const items = computed(() => data.value?.data || [])
const totalItems = computed(() => items.value.length)
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 標題 -->
    <div class="mb-6 flex shrink-0 items-center justify-between">
      <h1 class="text-2xl font-bold">
        列表標題
      </h1>
      <UButton
        data-testid="team-create"
        icon="i-heroicons-plus"
      >
        新增
      </UButton>
    </div>

    <!-- 列表卡片 -->
    <UCard class="min-h-0 flex-1" :ui="{ body: 'h-full flex flex-col p-0' }">
      <CommonListContainer
        v-model:page="currentPage"
        :total="totalItems"
        :page-size="pageSize"
      >
        <UTable
          data-testid="team-list"
          :data="items"
          :columns="columns"
          class="[&_th]:h-10 [&_td]:h-12"
          :ui="{ tr: 'cursor-pointer hover:bg-elevated' }"
        >
          <!-- 操作欄範例 -->
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-1">
              <UButton
                data-testid="team-edit"
                icon="i-heroicons-pencil"
                variant="ghost"
                size="xs"
              />
              <UButton
                data-testid="team-delete"
                icon="i-heroicons-trash"
                variant="ghost"
                color="error"
                size="xs"
              />
            </div>
          </template>
          <template #empty>
            <CommonEmptyState title="目前沒有球隊" />
          </template>
        </UTable>
      </CommonListContainer>
    </UCard>
  </div>
</template>
```

> **data-testid 說明**：列表內的按鈕（`team-edit`, `team-delete`）可重複，E2E 測試時用 `first()`, `nth()`, 或 `filter({ hasText })` 定位

---

## 表格樣式

### 兩種設定方式

| 方式 | 適用場景 | 範例 |
|------|----------|------|
| `:ui` prop | cursor、hover | `tr: 'cursor-pointer'` |
| `class` | 固定高度 | `[&_th]:h-10` |

```vue
<UTable
  :data="items"
  :columns="columns"
  class="[&_th]:h-10 [&_td]:h-12"
  :ui="{ tr: 'cursor-pointer hover:bg-elevated' }"
/>
```

---

## Layout 配合須知

> Layout 完整程式碼與結構 → 詳見 [phase-3-layout.md](phase-3-layout.md)
> Layout 規範（Sidebar 必備功能、Mobile Top Bar）→ 詳見 [rules.md](rules.md) > Layout 規範

頁面在 `<main class="flex min-h-0 flex-1 flex-col overflow-auto p-6">` 內渲染，注意：
- 外層已有 `h-screen overflow-hidden`，頁面不需再設 `h-screen`
- 頁面用 `flex h-full flex-col` 撐滿即可
- 需要可滾動區域時，遵循 `flex flex-col min-h-0` 模式

---

## Hover 互動樣式

所有 hover 元素必須同時加上 `cursor-pointer` 和 `duration-300`：

```html
<!-- [O] 正確 -->
<div class="cursor-pointer transition-colors duration-300 hover:bg-neutral-100">

<!-- [X] 錯誤 -->
<div class="hover:bg-neutral-100">
```

---

## 刪除確認 Modal

### 使用 CommonConfirmModal

```vue
<CommonConfirmModal
  v-model:open="isDeleteModalOpen"
  title="確認刪除"
  :description="`確定要刪除「${selectedItem?.name}」嗎？`"
  confirm-label="刪除"
  confirm-color="error"
  :loading="isSubmitting"
  @confirm="handleDelete"
/>
```

### 直接使用 UModal（不用 CommonConfirmModal）

```vue
<UModal v-model:open="deleteModalOpen">
  <template #content>
    <div data-testid="confirm-modal" class="p-6">
      <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">確認刪除</h3>
      <p class="mt-2 text-neutral-500 dark:text-neutral-400">此操作無法復原，確定要刪除嗎？</p>
      <div class="mt-6 flex justify-end gap-3">
        <UButton
          data-testid="confirm-cancel"
          color="neutral"
          variant="outline"
          @click="deleteModalOpen = false"
        >
          取消
        </UButton>
        <UButton
          data-testid="confirm-ok"
          color="error"
          @click="confirmDelete"
        >
          刪除
        </UButton>
      </div>
    </div>
  </template>
</UModal>
```

---

## 空狀態

**禁止**在 UTable 外用 `v-if` 判斷空狀態。一律使用 UTable 的 `#empty` slot：

```vue
<!-- ❌ 禁止：UTable 外的 v-if 判斷（會導致 UTable 自己渲染 "No data" 行） -->
<UTable :data="items" :columns="columns" />
<CommonEmptyState v-if="!items.length" title="目前沒有球隊" />

<!-- ✅ 正確：使用 #empty slot 取代 UTable 預設的 "No data" -->
<UTable :data="items" :columns="columns">
  <template #empty>
    <CommonEmptyState title="目前沒有球隊" />
  </template>
</UTable>
```

---

## 搜尋框

```vue
<UInput
  v-model="searchQuery"
  data-testid="team-search"
  icon="i-heroicons-magnifying-glass"
  placeholder="搜尋..."
  class="w-64"
/>
```

## 篩選下拉（「全部」選項）

⚠️ Nuxt UI v3 的 USelect **禁止 `value: ''`**，「全部/不篩選」用 `undefined` + `placeholder` 實現。

```vue
<script setup lang="ts">
// [O] 用 undefined 代表「全部」
const selectedTeamId = ref<string | undefined>(undefined)
const teamOptions = computed(() =>
  teams.value.map(t => ({ label: t.name, value: String(t.id) })),
)
</script>

<template>
  <USelect
    v-model="selectedTeamId"
    :items="teamOptions"
    value-key="value"
    placeholder="全部球隊"
    class="w-40"
  />
</template>
```

---

## 拖曳排序

### 安裝

```bash
npm i vuedraggable@next
```

### 使用

```vue
<script setup>
import draggable from 'vuedraggable'
</script>

<template>
  <draggable
    v-model="items"
    item-key="id"
    handle=".drag-handle"
    ghost-class="opacity-50"
    @end="handleDragEnd"
  >
    <template #item="{ element }">
      <div class="flex items-center gap-3 p-3">
        <UIcon name="i-heroicons-bars-3" class="drag-handle cursor-grab" />
        <span>{{ element.name }}</span>
      </div>
    </template>
  </draggable>
</template>
```

---

## UCard UI Props

NuxtUI v4 只支援：

```vue
:ui="{
  root: 'class...',
  header: 'class...',
  body: 'class...',
  footer: 'class...',
}"

// [X] 不支援，改用 class
:ui="{ ring: 'ring-0' }"  // → class="ring-0"
```
