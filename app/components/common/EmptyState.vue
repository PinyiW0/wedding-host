<!-- app/components/common/EmptyState.vue -->
<!-- 空狀態是頁面的最低視覺層級（issue #19）：無 icon、內文級字重，不與主標題搶焦點 -->
<!-- bordered：複雜多區塊 layout 用細框標出區塊邊界（與資料容器同款框線），避免空狀態時區塊界線消失 -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    bordered?: boolean
  }>(),
  {
    title: '目前沒有資料',
    description: '',
    bordered: false,
  },
)
</script>

<template>
  <!-- flex 置中：外部傳 class="flex-1" 撐滿高容器時內容垂直置中；普通流下不影響 -->
  <div
    class="flex flex-col items-center justify-center px-6 py-10 text-center"
    :class="bordered && 'rounded-lg border border-dashed border-line dark:border-neutral-800'"
  >
    <p class="text-body text-ink-500 dark:text-neutral-400">
      {{ title }}
    </p>
    <p v-if="description" class="mt-1 text-caption text-ink-300">
      {{ description }}
    </p>
  </div>
</template>
