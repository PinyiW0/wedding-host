<!-- app/components/common/EmptyState.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title?: string
    description?: string
  }>(),
  {
    icon: 'i-heroicons-circle-stack',
    title: '目前沒有資料',
    description: '',
  },
)
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
