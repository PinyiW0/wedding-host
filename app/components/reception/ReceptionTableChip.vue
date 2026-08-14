<script setup lang="ts">
// 接待台桌次圖的圓桌卡（issue #151）：置中於 SeatingVenueCanvas 給的桌位格內，
// 顯示桌名、入座人頭與報到率環；點擊由呼叫端展開該桌名單。右欄縮圖與放大檢視共用同一份。
import type { TableListItem } from '~/types/api/seating'

defineProps<{
  table: TableListItem
  isMain: boolean
  selected: boolean
  normalHeads: number
  childChairs: number
  heads: number
  checkedHeads: number
  rate: number
  // 右欄縮圖與放大檢視同時存在時 testid 會撞在一起，由呼叫端各給各的
  testid: string
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    :data-testid="testid"
    :aria-label="`查看 ${table.tableName} 名單`"
    class="absolute left-1/2 top-1/2 flex size-[78%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 px-2 text-center transition-colors"
    :class="[
      isMain
        ? 'border-gold bg-gold-light/25 dark:border-gold dark:bg-gold-deep/20'
        : 'border-line bg-paper dark:border-neutral-700 dark:bg-neutral-800',
      selected && 'ring-2 ring-gold ring-offset-2',
    ]"
    @click="$emit('select')"
  >
    <!-- 報到率環：柔和 success 弧線由正上方順時針，弧長 = 已報到 / 指派人頭；尚無人報到時不顯示 -->
    <svg
      v-if="checkedHeads > 0"
      class="pointer-events-none absolute inset-0 size-full -rotate-90 text-success-400"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        :stroke-dasharray="`${(rate * 301.6).toFixed(1)} 301.6`"
      />
    </svg>
    <span
      class="line-clamp-2 font-display font-medium leading-tight text-ink dark:text-paper"
      :class="isMain ? 'text-xl' : 'text-base'"
    >{{ table.tableName }}</span>
    <span class="mt-1 text-caption text-ink-500 dark:text-neutral-400">
      {{ normalHeads }} / {{ table.capacity }} 位
    </span>
    <span v-if="childChairs > 0" class="text-caption text-gold-deep">
      +兒童椅 {{ childChairs }}
    </span>
    <span
      v-if="heads > 0"
      class="mt-0.5 text-caption font-medium text-success-600 dark:text-success-400"
    >
      報到 {{ checkedHeads }}/{{ heads }}
    </span>
  </button>
</template>
