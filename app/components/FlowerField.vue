<!-- 賓客手繪小花：自動換行並保留動畫間距，花多時隨內容增高。 -->
<script setup lang="ts">
import type { FlowerWallItem } from '~/types/api/flowers'

const props = withDefaults(
  defineProps<{
    flowers: FlowerWallItem[]
    // 互動：hover 花朵綻出花瓣並浮現賓客名（landing 用）；裝飾用途設 false
    interactive?: boolean
    // 數量上限（裝飾用途取樣少量）；省略則全顯示
    max?: number
    // wreath 顯示計數插槽；所有模式皆使用不重疊的流式排列
    layout?: 'scatter' | 'wreath' | 'meadow'
    // 緊湊版（故事頁的祝福花田用）：花散落在外層給定大小的框裡，不往外長（issue #194）。
    // 原本換行排法花一多就撐好幾屏、還縮到 32px 看不見；改成依花床形狀疏密散落、大小接近，花多才互疊
    compact?: boolean
    // 緊湊版的花床形狀：arc＝花田上方的弧（兩端高、中間低）；crown＝桌機版的弧，往下降到三朵花兩側、
    // 底部中間留給三朵花；left／right＝花田左右兩叢（貼著花田那側、越低越密）
    bed?: 'arc' | 'crown' | 'left' | 'right'
  }>(),
  { interactive: false, max: 0, layout: 'scatter', compact: false, bed: 'arc' },
)

/** 把 hash 再攪一次（murmur3 的收尾步驟）：種子資料的 guestId 是連號，hashStr 算出來只差 1，
    直接取餘數會讓大小、落點排成一列；攪過之後相鄰 id 也天差地遠。salt 讓同一朵花的大小與落點各自獨立 */
function mix(h: number, salt: number): number {
  let x = (h ^ salt) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B) >>> 0
  x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

/** 每朵花的尺寸（px）：花圈版大小交錯；緊湊版與 meadow 版 32～80 隨 hash 大大小小（緊湊版之後依框重算）；預設 72～120 */
function sizeOf(layout: string, compact: boolean, i: number, h: number): number {
  if (layout === 'wreath')
    return (i % 2 === 0 ? 96 : 64) + (h % 4) * 9
  if (layout === 'meadow' || compact)
    return 32 + (mix(h, 3) % 7) * 8
  return 72 + (h % 4) * 16
}

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
}

const placed = computed<PlacedFlower[]>(() => {
  let list = props.flowers
  if (props.max > 0)
    list = [...list].sort((a, b) => hashStr(a.guestId) - hashStr(b.guestId)).slice(0, props.max)
  return list.map((f, i) => {
    const h = hashStr(f.guestId)
    const size = sizeOf(props.layout, props.compact, i, h)
    return {
      ...f,
      rotate: props.compact ? (h % 7) - 3 : (h % 25) - 12,
      size,
      drift: (h % 33) - 16,
      swayDur: 4.5 + (h % 30) / 10,
      swayDelay: (h % 24) / 10,
    }
  })
})

/* 緊湊版先裁掉畫布四周的透明空白：賓客常在整張畫布只畫一小角，不裁的話縮進方框就小到看不見。
   一張一張裁、裁完才換上，裁失敗就沿用原圖；整張空白（裁出空字串）的不擺，免得留一個空位 */
const trimmed = ref<Record<string, string>>({})
async function trimAll() {
  for (const f of props.flowers) {
    if (trimmed.value[f.guestId] !== undefined)
      continue
    const src = await trimTransparent(f.flowerDrawing)
    trimmed.value = { ...trimmed.value, [f.guestId]: src }
  }
}

/* ── 緊湊版：依花床形狀疏密散落（新人 10-15：散落在花叢旁、不要雜亂；視覺上要像花從花田長出來，不像一圈貼紙）──
   框多大由外層決定（ResizeObserver 量）。把框切成約 2.5 倍花數的候選格，每格依花床給一個權重：
   左右兩叢＝貼著花田那側、越低越重；上方的弧＝越靠近弧線越重（兩端高、中間低，接上兩叢、托住三朵花）。
   權重乘上一點固定雜訊後取前 n 格放花——密處自然成叢、邊緣自然變稀，不排成格子也不擠成一團。
   大小只差一成、只微傾，且比水彩花田的花小一號（花田維持主角）。
   花比格子大就互疊；互疊後仍要每朵點得到：圖與外框不吃指標，只留中心的命中圈（.hit）。
   幾何保證：格內偏移 ≤ 0.25 格、命中圈半徑 ≤ 0.25 格，任兩圈中心距 ≥ 0.5 格，不會重疊 */
const MIN_SIZE = 44
const MAX_SIZE = 64
const CANDIDATES = 2.5
const JITTER = 0.25
const HIT = 0.25

const root = ref<HTMLElement | null>(null)
const box = ref({ w: 0, h: 0 })
let boxObserver: ResizeObserver | undefined

interface ScatteredFlower extends PlacedFlower {
  x: number // px：花的左緣
  y: number // px：花的上緣
  z: number
  hit: number // px：命中圈直徑
}

/** crown 底部中間留給三朵花的半寬（px）：三朵花一排約 200px 寬，左右再留一點呼吸 */
const CROWN_HOLE = 100

/** 候選格的權重：x、y 是格子中心在框裡的比例（0～1，y 由上往下）；hole＝crown 底部中間空出來的半寬（比例） */
function bedWeight(bed: 'arc' | 'crown' | 'left' | 'right', x: number, y: number, hole: number): number {
  if (bed === 'arc' || bed === 'crown') {
    const u = 2 * x - 1
    // 弧線：兩端在上方三成、中間降到七成五；crown 降得更深（八成五），底部中間是三朵花的位置，不放
    if (bed === 'crown' && Math.abs(u) < hole && y > 0.55)
      return 0
    const arcY = bed === 'crown' ? 0.15 + 0.7 * (1 - u * u) : 0.3 + 0.45 * (1 - u * u)
    return Math.exp(-(((y - arcY) / 0.22) ** 2)) * (0.75 + 0.25 * u * u)
  }
  const fromField = bed === 'left' ? 1 - x : x
  const fromGround = 1 - y
  return (1 - 0.7 * fromField) * (1 - 0.6 * fromGround)
}

const scattered = computed<ScatteredFlower[]>(() => {
  const { w, h } = box.value
  const list = placed.value
    .filter(f => trimmed.value[f.guestId] !== '')
    .sort((a, b) => mix(hashStr(a.guestId), 5) - mix(hashStr(b.guestId), 5))
  const n = list.length
  if (!props.compact || n === 0 || w === 0 || h === 0)
    return []
  const target = Math.ceil(n * CANDIDATES)
  const cols = Math.max(1, Math.round(Math.sqrt(target * w / h)))
  const rows = Math.max(1, Math.ceil(target / cols))
  const cellW = w / cols
  const cellH = h / rows
  const cell = Math.min(cellW, cellH)
  const hole = Math.max(0.34, CROWN_HOLE / (w / 2))
  // 每格分數＝花床權重 ×（0.55～1 的固定雜訊），取前 n 格（固定不跳動）
  const cells = Array.from({ length: cols * rows }, (_, k) => {
    const weight = bedWeight(props.bed, ((k % cols) + 0.5) / cols, (Math.floor(k / cols) + 0.5) / rows, hole)
    return { k, score: weight * (0.55 + 0.45 * (mix(k + 1, 23) % 1000) / 1000) }
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(c => c.k)
    .sort((a, b) => a - b)
  const size = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, cell * 1.25)))
  return list.map((f, k) => {
    const slot = cells[k]!
    const row = Math.floor(slot / cols)
    const col = slot % cols
    const hh = hashStr(f.guestId)
    const s = Math.max(MIN_SIZE, Math.round(size * (0.94 + (mix(hh, 3) % 13) / 100)))
    const jx = ((mix(hh, 13) % 201) / 100 - 1) * JITTER * cellW
    const jy = ((mix(hh, 17) % 201) / 100 - 1) * JITTER * cellH
    const cx = Math.min(w - s / 2, Math.max(s / 2, (col + 0.5) * cellW + jx))
    const cy = (row + 0.5) * cellH + jy
    return {
      ...f,
      size: s,
      rotate: (hh % 9) - 4,
      x: Math.round(cx - s / 2),
      y: Math.round(cy - s / 2),
      z: row + 1,
      hit: Math.round(2 * Math.min(s * 0.3, cell * HIT)),
    }
  })
})

onMounted(() => {
  if (!props.compact || !root.value)
    return
  boxObserver = new ResizeObserver(([entry]) => {
    if (entry)
      box.value = { w: entry.contentRect.width, h: entry.contentRect.height }
  })
  boxObserver.observe(root.value)
  void trimAll()
  watch(() => props.flowers, () => void trimAll())
})
onBeforeUnmount(() => boxObserver?.disconnect())
</script>

<template>
  <div v-if="compact" ref="root" data-testid="flower-field" class="is-compact relative">
    <figure
      v-for="flower in scattered"
      :key="flower.guestId"
      :data-testid="`flower-${flower.guestId}`"
      class="group flex flex-col items-center"
      :style="{ 'width': `${flower.size}px`, 'left': `${flower.x}px`, 'top': `${flower.y}px`, 'zIndex': flower.z, '--hit': `${flower.hit}px` }"
    >
      <!-- 命中圈：花互疊時只認中心這一圈，隔壁的花蓋不到 -->
      <span class="hit" aria-hidden="true" />
      <span class="bloom-wrap relative block transition-transform duration-250 ease-emphasized group-hover:scale-110">
        <img
          :src="trimmed[flower.guestId] || flower.flowerDrawing"
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
        <template v-if="interactive">
          <span class="sprout sprout-1" />
          <span class="sprout sprout-2" />
          <span class="sprout sprout-3" />
          <span class="sprout sprout-4" />
          <span class="sprout sprout-5" />
        </template>
      </span>
    </figure>
  </div>
  <div
    v-else
    data-testid="flower-field"
    class="flex flex-wrap items-end justify-center gap-10 p-6"
  >
    <figure
      v-for="(flower, idx) in placed"
      :key="flower.guestId"
      :data-testid="`flower-${flower.guestId}`"
      class="group flex shrink-0 flex-col items-center"
      :style="{
        'width': `${flower.size}px`,
        '--i': idx,
        'marginTop': `${flower.drift + 16}px`,
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
      class="order-first w-full pb-6 text-center"
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

/* 緊湊版：花絕對定位在框裡；外框與圖不吃指標，只有中心命中圈吃（hover 由 .hit 冒泡到 .group） */
.is-compact,
.is-compact figure {
  pointer-events: none;
}
.is-compact figure {
  position: absolute;
}
.is-compact img {
  pointer-events: none;
}
.hit {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  width: var(--hit);
  height: var(--hit);
  border-radius: 9999px;
  transform: translate(-50%, -50%);
  pointer-events: auto;
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
