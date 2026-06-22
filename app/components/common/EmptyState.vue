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
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div class="flex size-16 items-center justify-center rounded-full border border-line text-gold">
      <UIcon :name="icon" class="size-7" />
    </div>
    <p class="mt-4 font-display text-h2 font-semibold text-ink dark:text-paper">
      {{ title }}
    </p>
    <p v-if="description" class="mt-2 text-body text-ink-300">
      {{ description }}
    </p>
  </div>
</template>
