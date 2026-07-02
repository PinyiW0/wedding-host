<!-- app/components/FlowerField.vue — 花田：賓客手繪小花散佈牆（landing + 謝卡裝飾共用） -->
<script setup lang="ts">
import type { FlowerWallItem } from '~/types/api/flowers'

const props = withDefaults(
  defineProps<{
    flowers: FlowerWallItem[]
    // 互動：顯示賓客名（landing 用）；裝飾用途設 false
    interactive?: boolean
    // 數量上限（裝飾用途取樣少量）；省略則全顯示
    max?: number
  }>(),
  { interactive: false, max: 0 },
)

// 由 guestId 推導穩定的偽隨機數（避免每次 render 位置跳動）
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  return h
}

interface PlacedFlower extends FlowerWallItem {
  rotate: number // -12 ~ 12 度
  size: number // px
}

const placed = computed<PlacedFlower[]>(() => {
  let list = props.flowers
  if (props.max > 0)
    list = [...list].sort((a, b) => hashStr(a.guestId) - hashStr(b.guestId)).slice(0, props.max)
  return list.map((f) => {
    const h = hashStr(f.guestId)
    return {
      ...f,
      rotate: (h % 25) - 12,
      size: 72 + (h % 4) * 16, // 72 / 88 / 104 / 120
    }
  })
})
</script>

<template>
  <div
    data-testid="flower-field"
    class="flex flex-wrap items-center justify-center gap-x-2 gap-y-4"
  >
    <figure
      v-for="flower in placed"
      :key="flower.guestId"
      :data-testid="`flower-${flower.guestId}`"
      class="group flex flex-col items-center"
      :style="{ width: `${flower.size}px` }"
    >
      <img
        :src="flower.flowerDrawing"
        :alt="`${flower.name} 的手繪小花`"
        :style="{ width: `${flower.size}px`, height: `${flower.size}px`, transform: `rotate(${flower.rotate}deg)` }"
        class="object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-0"
      >
      <figcaption
        v-if="interactive"
        class="mt-1 max-w-full truncate text-center text-caption text-ink-500"
      >
        {{ flower.name }}
      </figcaption>
    </figure>
  </div>
</template>
