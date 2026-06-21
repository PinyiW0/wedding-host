<!-- app/components/common/PageHeader.vue -->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="mb-6 shrink-0">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-1 text-neutral-500 dark:text-neutral-400">
          {{ description }}
        </p>
      </div>
      <!-- 操作按鈕區（如：新增） -->
      <slot name="actions" />
    </div>
  </div>
</template>
