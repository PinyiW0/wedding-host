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
  <UFormField label="站號" name="number">
    <UInput v-model="state.number" class="w-full" />
  </UFormField>
  <UFormField label="緯度" name="latitude">
    <UInput v-model="state.latitude" class="w-full" />
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
// USelect 的 v-model 可為 string／number／boolean（跟 items 的 value 型別走）；此處示範字串檔位再轉 number
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

> notes 為假想資源，函式名、型別、欄位以 `/feature-to-api` 實際產出的 `app/api/*.api.ts` 與 `app/types/api/` 為準。

```vue
<!-- app/pages/notes/index.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
// ⚠️ 必須從 types/api/ import 型別，禁止定義 local interface
import type { NoteListItem } from '~/types/api/notes'
import { deleteNote, listNotes } from '~/api'
import { readApiError } from '~/utils/api-error'

definePageMeta({ layout: 'default' })

// 主資料走 client 層 get()（lazy：切頁即時、pending 可見），穩定 key 讓子元件可 refreshNuxtData
// 角色過濾由 server 依 token 判斷（rbac-scaffold §3a）；前端不在 query 送帳號或角色——那等於讓使用者自報權限
const { data: notes, status, error, refresh } = listNotes({ key: 'notes', lazy: true })

const toast = useToast()
const currentPage = ref(1)
const pageSize = 10 // 讀 ui-config.yaml > table.pagination.defaultPageSize

const columns: TableColumn<NoteListItem>[] = [
  { accessorKey: 'title', header: '標題' },
  { id: 'actions', header: '操作' },
]

const items = computed(() => notes.value ?? [])
// 前端切片分頁；spec 有 page／pageSize 參數時改成 query 帶給 server
const pagedItems = computed(() =>
  items.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize),
)

const selected = ref<NoteListItem | null>(null)
const isDeleteModalOpen = ref(false)
const isSubmitting = ref(false)

function openDelete(note: NoteListItem) {
  selected.value = note
  isDeleteModalOpen.value = true
}

async function handleDelete() {
  if (!selected.value)
    return
  isSubmitting.value = true
  try {
    await deleteNote(selected.value.noteId)
    toast.add({ title: '刪除成功', color: 'success' })
    isDeleteModalOpen.value = false
    await refresh() // 同頁寫入後刷新（page-builder.md「資料新鮮度」）
    // 刪掉最後一頁的唯一一筆時，頁碼退回最後一個有資料的頁；否則停在空白頁，#empty 會讓人以為資料全沒了
    const lastPage = Math.max(1, Math.ceil(items.value.length / pageSize))
    if (currentPage.value > lastPage)
      currentPage.value = lastPage
  }
  catch (error) {
    toast.add({ title: '刪除失敗', description: readApiError(error, '操作失敗'), color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 標題：一律用 PageHeader（visual-hierarchy.md：一頁一個主標） -->
    <PageHeader title="筆記列表">
      <template #actions>
        <UButton icon="i-heroicons-plus" to="/notes/new">
          新增
        </UButton>
      </template>
    </PageHeader>

    <!-- 狀態互斥：第一次載入 → skeleton；error → ApiErrorState；其餘 → 列表（空資料走 #empty）。refresh() 也會回到 pending，加 !notes 才不會每次刷新都閃成 skeleton -->
    <div v-if="status === 'pending' && !notes" aria-busy="true" class="space-y-3">
      <USkeleton v-for="i in 4" :key="i" class="h-12 w-full" />
    </div>
    <ApiErrorState v-else-if="error" :error="error" @retry="refresh()" />
    <UCard v-else class="min-h-0 flex-1" :ui="{ body: 'h-full flex flex-col p-0' }">
      <ListContainer
        v-model:page="currentPage"
        :total="items.length"
        :page-size="pageSize"
      >
        <UTable
          :data="pagedItems"
          :columns="columns"
          class="[&_th]:h-10 [&_td]:h-12"
        >
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-1">
              <UButton
                icon="i-heroicons-pencil"
                variant="ghost"
                size="xs"
                aria-label="編輯"
                :to="`/notes/${row.original.noteId}`"
              />
              <UButton
                icon="i-heroicons-trash"
                variant="ghost"
                color="error"
                size="xs"
                aria-label="刪除"
                @click="openDelete(row.original)"
              />
            </div>
          </template>
          <template #empty>
            <EmptyState title="目前沒有筆記" />
          </template>
        </UTable>
      </ListContainer>
    </UCard>

    <ConfirmModal
      v-model:open="isDeleteModalOpen"
      title="確認刪除"
      :description="`確定要刪除「${selected?.title}」嗎？`"
      confirm-label="刪除"
      confirm-color="error"
      :loading="isSubmitting"
      @confirm="handleDelete"
    />
  </div>
</template>
```

> **範本不放 testid**：testid 一律從 spec 的 `getByTestId()` 逐字複製，spec 沒用到就不加。列表內重複的按鈕用語意收窄定位（`getByRole('row', { name: /標題文字/ }).getByRole('button', { name: '刪除' })`），見 [page-builder.md](page-builder.md)「testid」段。

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

頁面在 `<div class="flex min-h-0 flex-1 flex-col overflow-auto p-6">` 內渲染，注意：
- 外層已有 `h-screen overflow-hidden`，頁面不需再設 `h-screen`
- 頁面用 `flex h-full flex-col` 撐滿即可
- 需要可滾動區域時，遵循 `flex flex-col min-h-0` 模式

---

## Hover 互動樣式

所有 hover 元素必須同時加上 `cursor-pointer` 和 `duration-250`（duration 只能用 150／250／400 三檔，`scripts/visual-hierarchy-check.mjs` 會擋其他值）：

```html
<!-- [O] 正確 -->
<div class="cursor-pointer transition-colors duration-250 hover:bg-neutral-100">

<!-- [X] 錯誤 -->
<div class="hover:bg-neutral-100">
```

---

## 刪除確認 Modal

### 使用 ConfirmModal

```vue
<ConfirmModal
  v-model:open="isDeleteModalOpen"
  title="確認刪除"
  :description="`確定要刪除「${selectedItem?.name}」嗎？`"
  confirm-label="刪除"
  confirm-color="error"
  :loading="isSubmitting"
  @confirm="handleDelete"
/>
```

### 直接使用 UModal（不用 ConfirmModal）

```vue
<!-- :transition="false" 見 pitfalls.md 第 3 條：關閉即同步卸載，避免殘留節點與 inert 背景影響斷言 -->
<UModal v-model:open="deleteModalOpen" :transition="false">
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

> 確認彈窗的 `confirm-*` testid 對應 `_common.flow.md` 的共用約定（`test/e2e/helpers` 的 `confirmDelete` 依賴它）。spec 預設用 `maybeConfirm`（`getByRole('dialog')` + 動詞 regex），該路徑不需要這些 testid——UModal 本身已提供 `dialog` role。

---

## 空狀態

**禁止**在 UTable 外用 `v-if` 判斷空狀態。一律使用 UTable 的 `#empty` slot：

```vue
<!-- ❌ 禁止：UTable 外的 v-if 判斷（會導致 UTable 自己渲染 "No data" 行） -->
<UTable :data="items" :columns="columns" />
<EmptyState v-if="!items.length" title="目前沒有筆記" />

<!-- ✅ 正確：使用 #empty slot 取代 UTable 預設的 "No data" -->
<UTable :data="items" :columns="columns">
  <template #empty>
    <EmptyState title="目前沒有筆記" />
  </template>
</UTable>
```

（本專案尚無 `<ApiErrorState>` 與 `readApiError`，處理方式見 [page-builder.md](page-builder.md) 資料載入表格的「本專案例外」列。）讀取失敗**不是**空狀態：`error` 時整個換成 `<ApiErrorState :error="error" @retry="refresh()" />`，不渲染 UTable，否則 `#empty` 會讓使用者以為資料被刪了（範本見 [page-builder.md](page-builder.md) 載入佔位一節）。

---

## 搜尋框

```vue
<UInput
  v-model="searchQuery"
  aria-label="搜尋"
  icon="i-heroicons-magnifying-glass"
  placeholder="搜尋..."
  class="w-64"
/>
```

## 篩選下拉（「全部」選項）

⚠️ NuxtUI 的 USelect **禁止 `value: ''`**，「全部/不篩選」用 `undefined` + `placeholder` 實現。

```vue
<script setup lang="ts">
// [O] 用 undefined 代表「全部」
const selectedTag = ref<string | undefined>(undefined)
const tagOptions = computed(() =>
  (tags.value ?? []).map(t => ({ label: t.name, value: t.tagId })),
)
</script>

<template>
  <USelect
    v-model="selectedTag"
    :items="tagOptions"
    value-key="value"
    placeholder="全部標籤"
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
<script setup lang="ts">
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

NuxtUI v4（4.12）的 UCard `ui` 有六個 key：

```vue
:ui="{
  root: 'class...',
  header: 'class...',
  title: 'class...',
  description: 'class...',
  body: 'class...',
  footer: 'class...',
}"

// [X] 不支援，改用 class
:ui="{ ring: 'ring-0' }"  // → class="ring-0"
```
