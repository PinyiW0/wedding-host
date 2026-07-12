<!-- app/components/FlowerField.vue — 花田：賓客手繪小花（landing 花圈 + 謝卡散佈裝飾共用） -->
<script setup lang="ts">
import type { FlowerWallItem } from '~/types/api/flowers'

const props = withDefaults(
  defineProps<{
    flowers: FlowerWallItem[]
    // 互動：hover 花朵綻出花瓣並浮現賓客名（landing 用）；裝飾用途設 false
    interactive?: boolean
    // 數量上限（裝飾用途取樣少量）；省略則全顯示
    max?: number
    // wreath：環形花圈（大小交錯、層次重疊，中央開 #center slot）；scatter：自由散佈
    layout?: 'scatter' | 'wreath'
  }>(),
  { interactive: false, max: 0, layout: 'scatter' },
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
  drift: number // px：scatter 模式的垂直錯落
  swayDur: number // s：搖曳週期（各花不同步）
  swayDelay: number // s
  left: string // wreath 模式：% 定位
  top: string
  z: number // wreath 層次：大花在前
}

const placed = computed<PlacedFlower[]>(() => {
  let list = props.flowers
  if (props.max > 0)
    list = [...list].sort((a, b) => hashStr(a.guestId) - hashStr(b.guestId)).slice(0, props.max)
  const n = list.length
  return list.map((f, i) => {
    const h = hashStr(f.guestId)
    // 大小交錯（相鄰一大一小）＋hash 變異 → 花圈的層次節奏
    const base = i % 2 === 0 ? 96 : 64
    const size = props.layout === 'wreath' ? base + (h % 4) * 9 : 72 + (h % 4) * 16
    // 環形：均分角度＋jitter、半徑 36~46% 抖動，彼此輕微交疊
    const angle = ((360 / Math.max(n, 1)) * i + ((h % 16) - 8) - 90) * (Math.PI / 180)
    const radius = 36 + (h % 11)
    return {
      ...f,
      rotate: (h % 25) - 12,
      size,
      drift: (h % 33) - 16,
      swayDur: 4.5 + (h % 30) / 10,
      swayDelay: (h % 24) / 10,
      left: `${50 + radius * Math.cos(angle)}%`,
      top: `${50 + radius * Math.sin(angle)}%`,
      z: size,
    }
  })
})
</script>

<template>
  <div
    data-testid="flower-field"
    :class="layout === 'wreath'
      ? 'relative mx-auto aspect-square w-full max-w-xl'
      : 'flex flex-wrap items-end justify-center gap-x-3 gap-y-6'"
  >
    <figure
      v-for="(flower, idx) in placed"
      :key="flower.guestId"
      :data-testid="`flower-${flower.guestId}`"
      class="group flex flex-col items-center"
      :class="layout === 'wreath' ? 'absolute -translate-x-1/2 -translate-y-1/2' : ''"
      :style="{
        'width': `${flower.size}px`,
        '--i': idx,
        ...(layout === 'wreath'
          ? { left: flower.left, top: flower.top, zIndex: flower.z }
          : { marginTop: `${flower.drift + 16}px` }),
      }"
    >
      <span class="bloom-wrap relative block transition-transform duration-250 ease-emphasized group-hover:scale-110">
        <img
          :src="flower.flowerDrawing"
          :alt="`${flower.name} 的手繪小花`"
          loading="lazy"
          :style="{
            'width': `${flower.size}px`,
            'height': `${flower.size}px`,
            '--r': `${flower.rotate}deg`,
            '--sway-dur': `${flower.swayDur}s`,
            '--sway-delay': `${flower.swayDelay}s`,
          }"
          class="flower-sway object-contain drop-shadow-sm"
        >
        <!-- hover 綻出五片花瓣：往外散開即消散（burst 一次性） -->
        <template v-if="interactive">
          <span class="sprout sprout-1" />
          <span class="sprout sprout-2" />
          <span class="sprout sprout-3" />
          <span class="sprout sprout-4" />
          <span class="sprout sprout-5" />
        </template>
      </span>
      <!-- 名字不公開顯示（產品決策 2026-07-10）；賓客識別由 img alt 承擔 -->
    </figure>
    <!-- 花圈中央（計數、飾線等） -->
    <div
      v-if="layout === 'wreath' && $slots.center"
      class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
    >
      <slot name="center" />
    </div>
  </div>
</template>

<style scoped>
/* 花朵搖曳（ambient loop）：各花不同週期與相位，如微風拂過；reduced-motion 全域 guard 會停用 */
.flower-sway {
  animation: flower-sway var(--sway-dur, 5.5s) ease-in-out var(--sway-delay, 0s) infinite alternate;
}
.group:hover .flower-sway {
  animation-play-state: paused;
}
@keyframes flower-sway {
  from {
    transform: rotate(var(--r, 0deg)) translateY(0);
  }
  50% {
    transform: rotate(calc(var(--r, 0deg) + 5deg)) translateY(-7px);
  }
  to {
    transform: rotate(calc(var(--r, 0deg) - 4deg)) translateY(-2px);
  }
}

/* hover 綻出五片花瓣：從花心往外散開即消散（一次性 burst，重新 hover 重播） */
.sprout {
  position: absolute;
  left: 50%;
  top: 44%;
  width: 11px;
  height: 15px;
  border-radius: 68% 32% 60% 40% / 55% 45% 62% 38%;
  background: linear-gradient(140deg, #eec9c2, #d98e8a);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.25);
  pointer-events: none;
}
.sprout-2,
.sprout-4 {
  background: linear-gradient(140deg, #ecdcba, #d8c39b);
}
.group:hover .sprout {
  animation: sprout-burst 400ms var(--ease-standard) var(--sd, 0ms) both;
}
/* 五片沿 72° 均分向外（上、右上、右下、左下、左上），左右對稱微延遲 */
.sprout-1 { --dx: 0px; --dy: -46px; --rot: -14deg; }
.sprout-2 { --dx: 44px; --dy: -15px; --rot: 42deg; --sd: 30ms; }
.sprout-3 { --dx: 28px; --dy: 38px; --rot: 96deg; --sd: 60ms; }
.sprout-4 { --dx: -28px; --dy: 38px; --rot: -96deg; --sd: 60ms; }
.sprout-5 { --dx: -44px; --dy: -15px; --rot: -42deg; --sd: 30ms; }
@keyframes sprout-burst {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.25) rotate(0deg);
  }
  18% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.05) rotate(var(--rot));
  }
}
</style>
