<!-- app/components/common/EmptyState.vue -->
<!-- 空狀態是頁面的最低視覺層級（issue #19）：無 icon、內文級字重，不與主標題搶焦點 -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  {
    title: '目前沒有資料',
    description: '',
  },
)
</script>

<template>
  <div class="px-6 py-10 text-center">
    <p class="text-body text-ink-500 dark:text-neutral-400">
      {{ title }}
    </p>
    <p v-if="description" class="mt-1 text-caption text-ink-300">
      {{ description }}
    </p>
  </div>
</template>
