<script setup lang="ts">
// 切頁全頁 loading 遮罩：蓋住畫面避免切頁途中誤點；
// 載入超過 throttle 門檻才出現，快速切頁不閃爍
const { isLoading } = useLoadingIndicator({ throttle: 200, hideDelay: 0 })
</script>

<template>
  <div
    :class="isLoading ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'"
    :aria-hidden="!isLoading"
    class="fixed inset-0 z-50 flex items-center justify-center bg-cream/80 backdrop-blur-sm transition-opacity duration-200 dark:bg-neutral-950/80"
  >
    <div role="status" class="flex flex-col items-center gap-3">
      <span
        aria-hidden="true"
        class="size-8 animate-spin rounded-full border-2 border-line border-t-gold dark:border-neutral-700 dark:border-t-gold"
      />
      <span class="text-body text-ink-500 dark:text-neutral-400">載入中…</span>
    </div>
  </div>
</template>
