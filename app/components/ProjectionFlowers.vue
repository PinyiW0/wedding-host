<!-- app/components/ProjectionFlowers.vue — 投影牆花朵裝飾層（賓客手繪花 + 新人自訂花圖，周邊環帶漂浮/慢轉） -->
<script setup lang="ts">
import type { FlowerWallItem } from '~/types/api/flowers'

const props = withDefaults(
  defineProps<{
    flowers: FlowerWallItem[]
    // 新人自行上傳的花朵圖（dataURL 陣列）
    custom?: string[]
  }>(),
  { custom: () => [] },
)

// 穩定偽隨機（同 FlowerField 先例）：由 id 推導定位/角度/時序，避免 re-render 跳動
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  return h
}

interface DecorFlower {
  id: string
  src: string
  style: Record<string, string>
  spin: boolean
}

// 周邊環帶定位：輪派到左帶 / 右帶 / 下帶，避開中央媒體區與頂部跑馬燈
const placed = computed<DecorFlower[]>(() => {
  const all = [
    ...props.flowers.map(f => ({ id: f.guestId, src: f.flowerDrawing })),
    ...props.custom.map((src, i) => ({ id: `custom-${i}`, src })),
  ]
  return all.map((f, i) => {
    const h = hashStr(f.id)
    const size = 48 + (h % 4) * 16 // 48 / 64 / 80 / 96
    const band = i % 3
    const along = 8 + ((h >> 3) % 80) // 帶內縱/橫向偏移 8~88%
    const depth = (h >> 7) % 9 // 帶內深度 0~8%
    const pos: Record<string, string>
      = band === 0
        ? { left: `${depth}%`, top: `${18 + along * 0.7}%` }
        : band === 1
          ? { right: `${depth}%`, top: `${18 + ((h >> 11) % 56) + 14}%` }
          : { left: `${along}%`, bottom: `${depth}%` }
    return {
      id: f.id,
      src: f.src,
      spin: h % 5 === 0,
      style: {
        ...pos,
        'width': `${size}px`,
        'height': `${size}px`,
        '--rot': `${(h % 29) - 14}deg`,
        '--dur': `${6 + (h % 7)}s`,
        '--delay': `${(h % 10) * 0.5}s`,
      },
    }
  })
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
    <img
      v-for="flower in placed"
      :key="flower.id"
      :src="flower.src"
      alt=""
      class="absolute object-contain drop-shadow"
      :class="flower.spin ? 'flower-spin' : 'flower-float'"
      :style="flower.style"
    >
  </div>
</template>

<style scoped>
/* 漂浮：上下微移 + 微轉；慢轉：40s 一圈 */
.flower-float {
  animation: flower-float var(--dur) ease-in-out infinite;
  animation-delay: var(--delay);
}
.flower-spin {
  animation: flower-spin 40s linear infinite;
}
@keyframes flower-float {
  0%,
  100% {
    transform: translateY(0) rotate(var(--rot));
  }
  50% {
    transform: translateY(-14px) rotate(calc(var(--rot) + 8deg));
  }
}
@keyframes flower-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
