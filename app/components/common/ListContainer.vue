<!-- app/components/common/ListContainer.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    total: number
    pageSize?: number
  }>(),
  {
    pageSize: 10,
  },
)

const page = defineModel<number>('page', { default: 1 })
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 表格區 -->
    <div class="min-h-0 flex-1 overflow-auto">
      <slot />
    </div>

    <!-- Pagination：固定底部 -->
    <div class="flex shrink-0 items-center justify-end border-t border-line bg-paper px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900">
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
        show-edges
      />
    </div>
  </div>
</template>
