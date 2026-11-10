# 額外功能元件規範（additionalFeatures）

> 本檔定義 PM yaml `additionalFeatures` 各功能的實作規範。
> Phase 4 建立 wrapper 元件，Phase 5 在頁面中使用。
> 只有 `route-map.yaml > enabled_features` 中列出的功能才需要實作。
>
> **Phase 4 流程**：有套件選項的功能，分身不能問開發者——第一次執行時該 wrapper 不產出，把選項列進回報；開發者選定後帶著選擇重新執行 Phase 4（例如 `/feature-to-ui 4 charts 用 vue-chartjs`），再安裝並實作 wrapper 內部邏輯。
> **Wrapper 一律放 `app/components/common/`**，Nuxt 自動命名會加 `Common` 前綴（`common/ChartWrapper.vue` → `<CommonChartWrapper>`）；下方元件名寫檔名，使用時一律帶前綴。
> **Phase 5 只使用 Wrapper API**，不直接 import 第三方套件。

---

## charts — 統計圖表

### Wrapper API（Phase 5 消費介面）

元件：`app/components/common/ChartWrapper.vue`（使用時 `<CommonChartWrapper>`）

| Prop | Type | 說明 |
|------|------|------|
| type | `'bar' \| 'line' \| 'doughnut'` | 圖表類型 |
| data | `{ labels: string[], datasets: { label: string, data: number[], backgroundColor?: string \| string[] }[] }` | 圖表資料 |
| options | `Record<string, unknown>` | 圖表選項（選填） |

### 套件選項（Phase 4 詢問開發者）

| 套件 | 說明 |
|------|------|
| vue-chartjs + chart.js | 最廣泛使用，基於 Chart.js |
| vue-echarts + echarts | 功能更豐富，適合複雜視覺化 |

> 選定後 Phase 4 實作 wrapper，需處理：元件 register（chart.js）或全域設定（echarts）。

### Phase 5 使用方式

```vue
<CommonChartWrapper
  type="bar"
  :data="{ labels: ['一月', '二月'], datasets: [{ label: '次數', data: [10, 20] }] }"
/>
```

### route-map 標記

`features_used: [charts]` — 通常用於統計/分析頁面。

---

## dragAndDrop — 拖曳排序

### Wrapper API（Phase 5 消費介面）

元件：`app/components/common/DraggableList.vue`（使用時 `<CommonDraggableList>`）

| Prop | Type | 說明 |
|------|------|------|
| items (v-model) | `Record<string, unknown>[]` | 可拖曳的項目列表；`itemKey` 指定的欄位（如 `noteId`）當唯一鍵 |
| itemKey | `string` | 項目唯一鍵的欄位名（預設 `'id'`，依資源實際欄位改，如 `'noteId'`） |
| handle | `string` | 拖曳把手的 CSS selector（選填） |

| Emit | Payload | 說明 |
|------|---------|------|
| sorted | `string[]` | 排序後的唯一鍵陣列；型別跟資源 ID 一致（數字 ID 改 `number[]`），與排序端點的 `ids` 同型別 |

| Slot | Scope | 說明 |
|------|-------|------|
| default | `{ element }` | 每個項目的渲染內容 |

### 套件選項（Phase 4 詢問開發者）

| 套件 | 說明 |
|------|------|
| vuedraggable@4.1 | Vue 3 拖曳，基於 SortableJS，社群廣泛使用 |
| @formkit/drag-and-drop | 輕量替代，無 SortableJS 依賴 |

### `/feature-to-api` Phase 1 影響

需要排序端點（`PUT {path_prefix}/{resource}/sort`）。範本在 `/feature-to-api` 的 [phase-1-mock-api.md](../../feature-to-api/references/phase-1-mock-api.md)「additionalFeatures 端點」段，本檔不重複。

### Phase 5 使用方式

```vue
<CommonDraggableList v-model:items="sortedList" @sorted="handleSort">
  <template #default="{ element }">
    <div class="flex items-center gap-2 border-b p-3">
      <UIcon name="i-heroicons-bars-3" class="cursor-grab" />
      <span>{{ element.name }}</span>
    </div>
  </template>
</CommonDraggableList>
```

---

## richTextEditor — 富文本編輯器

### Wrapper API（Phase 5 消費介面）

元件：`app/components/common/RichTextEditor.vue`（使用時 `<CommonRichTextEditor>`）

| Prop | Type | 說明 |
|------|------|------|
| modelValue (v-model) | `string` | HTML 內容 |
| placeholder | `string` | 提示文字（選填） |

### 套件選項（Phase 4 詢問開發者）

| 套件 | 說明 |
|------|------|
| @tiptap/vue-3 + @tiptap/starter-kit | 模組化架構，可按需擴充 |
| @vueup/vue-quill | 基於 Quill，較簡單但客製化空間較小 |

> 選定後 Phase 4 實作 wrapper，需包含基本工具列（粗體、斜體、列表）。

### `/feature-to-api` Phase 1 影響

確保對應 API 欄位使用 `string` 型別（存放 HTML 內容）。

### Phase 5 使用方式

```vue
<CommonRichTextEditor v-model="formData.content" placeholder="請輸入文章內容..." />
```

---

## advancedDatePicker — 進階日期時間選擇器

### Wrapper API（Phase 5 消費介面）

元件：`app/components/common/DateRangePicker.vue`（使用時 `<CommonDateRangePicker>`）

| Prop | Type | 說明 |
|------|------|------|
| modelValue (v-model) | `[Date, Date] \| null` | 日期範圍 |
| placeholder | `string` | 提示文字（選填） |

### 套件選項（Phase 4 詢問開發者）

| 套件 | 說明 |
|------|------|
| @vuepic/vue-datepicker | 功能完整，支援範圍選擇、時間選擇 |
| v-calendar | 輕量日曆元件，支援範圍選擇 |

### Phase 5 使用方式

```vue
<CommonDateRangePicker v-model="filters.dateRange" placeholder="篩選日期範圍" />
```

---

## fileUpload — 檔案上傳

### 不需額外套件

使用原生 `FormData` + `DragEvent`；送出走 client 層的上傳函式（`/feature-to-api` 依 spec 產出，下方以 `uploadFile` 示意，名稱以實際 `app/api/` 為準）。

### `/feature-to-api` Phase 1 影響

需要上傳端點（`POST {path_prefix}/upload`）。範本在 `/feature-to-api` 的 [phase-1-mock-api.md](../../feature-to-api/references/phase-1-mock-api.md)「additionalFeatures 端點」段，本檔不重複。

### Phase 4 建立元件

```vue
<!-- app/components/common/FileUpload.vue -->
<script setup lang="ts">
import { uploadFile } from '~/api'

const props = withDefaults(defineProps<{
  accept?: string
  maxSizeMb?: number
}>(), {
  accept: 'image/*',
  maxSizeMb: 5,
})

const emit = defineEmits<{
  uploaded: [data: { url: string, name: string }]
  error: [message: string]
}>()

const isDragging = ref(false)
const isUploading = ref(false)

const input = ref<HTMLInputElement>()

async function handleFiles(files: FileList | null) {
  if (!files?.length)
    return
  const file = files[0]!

  if (file.size > props.maxSizeMb * 1024 * 1024) {
    emit('error', `檔案大小不可超過 ${props.maxSizeMb}MB`)
    return
  }

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    emit('uploaded', await uploadFile(formData))
  }
  catch {
    emit('error', '上傳失敗')
  }
  finally {
    isUploading.value = false
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors"
    :class="isDragging
      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
      : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700'"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
    @click="input?.click()"
  >
    <UIcon name="i-heroicons-cloud-arrow-up" class="size-8 text-neutral-400" />
    <p class="mt-2 text-sm text-neutral-500">點擊或拖放檔案上傳</p>
    <p class="text-xs text-neutral-400">最大 {{ maxSizeMb }}MB</p>
    <input ref="input" type="file" class="hidden" :accept="accept" @change="handleFiles(($event.target as HTMLInputElement).files)">
    <UButton v-if="isUploading" loading disabled class="mt-2">上傳中...</UButton>
  </div>
</template>
```

### Phase 5 使用方式

```vue
<CommonFileUpload accept="image/*" :max-size-mb="5" @uploaded="formData.avatar = $event.url" @error="showError" />
```

---

## infiniteScroll — 無限滾動

### 不需額外套件

使用原生 `IntersectionObserver` API。

### Phase 4 建立元件

```vue
<!-- app/components/common/InfiniteScroll.vue -->
<script setup lang="ts">
const props = defineProps<{
  loading: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  loadMore: []
}>()

const sentinel = ref<HTMLElement>()

onMounted(() => {
  if (!sentinel.value)
    return
  const observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting && !props.loading && props.hasMore) {
      emit('loadMore')
    }
  })
  observer.observe(sentinel.value)
  onUnmounted(() => observer.disconnect())
})
</script>

<template>
  <div>
    <slot />
    <div ref="sentinel" class="h-1" />
    <div v-if="loading" class="flex justify-center py-4">
      <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin text-neutral-400" />
    </div>
    <p v-else-if="!hasMore" class="py-4 text-center text-sm text-neutral-400">
      沒有更多資料了
    </p>
  </div>
</template>
```

### Phase 5 使用方式

```vue
<CommonInfiniteScroll :loading="isFetching" :has-more="hasNextPage" @load-more="fetchNextPage">
  <div v-for="item in items" :key="item.id">{{ item.name }}</div>
</CommonInfiniteScroll>
```

### 注意

啟用 `infiniteScroll` 的列表頁**不使用 `ListContainer`（含分頁）**，改用此元件。`/feature-to-api` Phase 0 標記 `features_used: [infiniteScroll]` 時，該路由的 `components` 不應包含 `ListContainer`。
