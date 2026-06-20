# Phase 4: 共用元件（元件原始碼）

> **本檔用途**：Phase 4 建置元件時的原始碼範本。
> **使用方式與規則**（Phase 5 參考）→ 詳見 [components.md](components.md)

## 必讀規範

```
必須讀取：
- ui-config.yaml > table（表格設定）
- ui-config.yaml > delete.confirmation（刪除確認）
- ui-config.yaml > colorMode（深淺模式）
- spec/report/route-map.yaml > enabled_features（PM 啟用的額外功能）
- features.md（額外功能的元件模板，僅 enabled_features 有啟用時需讀取）
- rules.md [P4] 段落（配色策略、深淺模式、Nuxt UI 類型規範、表單型別安全、第三方元件 import）

執行 /nuxt-ui 載入組件文檔（若尚未載入）
```

> `components.md` 是 Phase 5 的「使用指南」，Phase 4 不需讀取。本檔（phase-4-components.md）已包含建置所需的完整範本。

## 增量模式判斷

Phase 4 開始前，先檢查 `spec/report/sync-report.md` 是否存在：

| 條件 | 模式 | 行為 |
|------|------|------|
| `sync-report.md` **不存在** | **全量模式** | 執行下方「全量模式執行步驟」 |
| `sync-report.md` **存在** | **Sync 模式** | 只處理 `enabled_features` 有新增的功能元件；已存在的共用元件（ListContainer 等）跳過不覆蓋 |

### Sync 模式步驟

1. **讀取 sync-report.md**，確認 `enabled_features` 是否有新增項目
2. **新增的功能** → 建立對應 wrapper 元件（同全量模式範本）
3. **已存在的元件** → 跳過（不修改、不覆蓋）
4. **若無新增項目** → 整個 Phase 4 跳過，通知用戶

---

## 全量模式執行步驟

1. **建立 ListContainer.vue**
2. **建立 ConfirmModal.vue**
3. **建立 PageHeader.vue**
4. **建立 EmptyState.vue**
5. **建立 additionalFeature 元件**（若 `enabled_features` 有啟用項目）
   - 讀取 `features.md` 中對應功能的元件模板
   - 每個啟用的功能建立對應的 wrapper 元件（如 `ChartWrapper.vue`、`DraggableList.vue`）
   - 若功能需要第三方套件，在確認清單中提醒用戶安裝
6. **詢問用戶確認**

## 輸出結構

```
app/components/common/
├── ListContainer.vue    # 列表頁面容器（含 pagination）
├── ConfirmModal.vue     # 確認對話框
├── PageHeader.vue       # 頁面標題區
└── EmptyState.vue       # 空狀態顯示
```

## ListContainer.vue

```vue
<!-- app/components/common/ListContainer.vue -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  total: number
  pageSize?: number
}>(), {
  pageSize: 10,
})

const page = defineModel<number>('page', { default: 1 })
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 表格區 -->
    <div class="min-h-0 flex-1 overflow-auto">
      <slot />
    </div>

    <!-- Pagination：固定底部 -->
    <div class="flex shrink-0 items-center justify-end border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
        show-edges
      />
    </div>
  </div>
</template>
```

## ConfirmModal.vue

```vue
<!-- app/components/common/ConfirmModal.vue -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  description?: string
  confirmLabel?: string
  confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  loading?: boolean
}>(), {
  title: '確認操作',
  description: '確定要執行此操作嗎？',
  confirmLabel: '確認',
  confirmColor: 'primary',
  loading: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div data-testid="confirm-modal" class="p-6">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
          {{ title }}
        </h3>
        <p class="mt-2 text-neutral-500 dark:text-neutral-400">
          {{ description }}
        </p>
        <div class="mt-6 flex justify-end gap-3">
          <UButton
            data-testid="confirm-cancel"
            color="neutral"
            variant="outline"
            :disabled="loading"
            @click="emit('cancel'); isOpen = false"
          >
            取消
          </UButton>
          <UButton
            data-testid="confirm-ok"
            :color="confirmColor"
            :loading="loading"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
```

## PageHeader.vue

```vue
<!-- app/components/common/PageHeader.vue -->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="mb-6 shrink-0">
    <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
      {{ title }}
    </h1>
    <p v-if="description" class="mt-1 text-neutral-500 dark:text-neutral-400">
      {{ description }}
    </p>
  </div>
</template>
```

## EmptyState.vue

```vue
<!-- app/components/common/EmptyState.vue -->
<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
}>(), {
  icon: 'i-heroicons-circle-stack',
  title: '目前沒有資料',
  description: '',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12">
    <UIcon :name="icon" class="size-12 text-neutral-400" />
    <p class="mt-2 text-neutral-500 dark:text-neutral-400">
      {{ title }}
    </p>
    <p v-if="description" class="mt-1 text-sm text-neutral-400">
      {{ description }}
    </p>
  </div>
</template>
```
