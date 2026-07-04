<!-- app/components/common/StatCard.vue -->
<script setup lang="ts">
// 編輯式統計卡（對應參考 UI 儀表板 KPI）：金色 overline + 巨大 Cormorant 數字 + 說明
withDefaults(
  defineProps<{
    eyebrow: string
    value: string | number
    unit?: string
    caption?: string
    // feature：墨黑底反白卡（對應參考主 KPI「即時報到率」）
    feature?: boolean
    // progress：0–100，顯示金色進度條
    progress?: number
  }>(),
  {
    feature: false,
  },
)
</script>

<template>
  <div
    class="rounded-lg p-6"
    :class="feature ? 'bg-ink text-cream' : 'border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900'"
  >
    <p
      class="text-overline uppercase"
      :class="feature ? 'text-gold' : 'text-gold-deep'"
    >
      {{ eyebrow }}
    </p>
    <div class="mt-3 flex items-baseline gap-1.5">
      <span
        class="font-display font-semibold leading-none"
        :class="feature ? 'text-[64px] text-cream' : 'text-h1 text-ink dark:text-paper'"
      >
        {{ value }}
      </span>
      <span v-if="unit" class="font-display text-2xl text-gold">{{ unit }}</span>
    </div>

    <!-- 進度條 -->
    <div
      v-if="progress !== undefined"
      class="mt-3 h-1.5 overflow-hidden rounded-full"
      :class="feature ? 'bg-ink-500/40' : 'bg-line'"
    >
      <div class="h-full rounded-full bg-gold" :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }" />
    </div>

    <p
      v-if="caption"
      class="mt-2.5 text-caption"
      :class="feature ? 'text-ink-300' : 'text-ink-500 dark:text-neutral-400'"
    >
      {{ caption }}
    </p>
    <slot />
  </div>
</template>
