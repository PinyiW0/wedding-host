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
  <!-- 壓低 header 高度（issue #115）：主標在左，eyebrow＋說明併一塊放標題右側；lg 以下回落標題下方 -->
  <!-- 手機（issue #126）：標題整列在上、動作鈕移到下方，避免 justify-between 把 CJK 標題壓成逐字直排 -->
  <div class="mb-6 shrink-0">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div class="flex min-w-0 flex-1 flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-5">
        <h2 class="shrink-0 font-display text-h2 font-semibold text-ink dark:text-paper">
          {{ title }}
        </h2>
        <!-- 副標區：金短線＋eyebrow，說明緊貼其下（縮排對齊 eyebrow 文字起點） -->
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <span class="h-px w-8 shrink-0 bg-gold" />
            <span class="text-overline uppercase text-gold-deep">{{ eyebrow }}</span>
          </div>
          <p v-if="description" class="mt-0.5 pl-11 text-caption text-ink-500 dark:text-neutral-400">
            {{ description }}
          </p>
        </div>
      </div>
      <!-- 操作按鈕區（如：新增） -->
      <slot name="actions" />
    </div>
  </div>
</template>
