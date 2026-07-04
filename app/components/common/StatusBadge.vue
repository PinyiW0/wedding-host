<!-- app/components/common/StatusBadge.vue -->
<!--
  業務狀態徽章：統一 variant=soft，顏色由 statusMeta 提供。
  文字走預設 slot，渲染為可被 e2e getByText 命中的文字節點（勿改為 aria-label / icon-only）。
  size 預設 sm，接待大螢幕等情境可覆寫為 md。
-->
<script setup lang="ts">
import type { SemanticColor } from '~/utils/statusMeta'

withDefaults(
  defineProps<{
    color: SemanticColor
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'sm' },
)
</script>

<template>
  <UBadge :color="color" variant="soft" :size="size">
    <slot />
  </UBadge>
</template>
