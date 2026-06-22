<!-- app/components/common/PageHeader.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    // 編輯式英文 overline（對應參考 UI 各頁的小標，如 "Guest List · 220 位"）
    eyebrow?: string
  }>(),
  {
    eyebrow: 'EverAfter',
  },
)
</script>

<template>
  <div class="mb-8 shrink-0">
    <div class="flex items-start justify-between gap-4">
      <div>
        <!-- 金色 overline 裝飾 -->
        <div class="mb-2 flex items-center gap-3">
          <span class="h-px w-8 bg-gold" />
          <span class="text-overline uppercase text-gold-deep">{{ eyebrow }}</span>
        </div>
        <h1 class="font-display text-h1 font-semibold text-ink dark:text-paper">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-2 text-body text-ink-500 dark:text-neutral-400">
          {{ description }}
        </p>
      </div>
      <!-- 操作按鈕區（如：新增） -->
      <slot name="actions" />
    </div>
  </div>
</template>
