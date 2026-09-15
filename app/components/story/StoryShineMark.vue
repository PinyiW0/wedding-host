<!-- app/components/story/StoryShineMark.vue — 首屏「I Shine」手寫字樣：由左至右寫出來，寫完之後閃光。
     揭開的方式：一片帶斜邊、軟邊的遮罩從左掃到右（斜度順著斜體的筆勢），字跟著筆尖出現。
     試過 GalleryLogoMark 那套「沿字形外框走的粗描邊筆刷」——這個字形的外框是一條繞整個字跑的輪廓，
     筆刷一走，I、S、hine 會同時各冒出一小片，看起來像壞掉不像書寫，所以換成掃過去。
     進度由時間驅動（rAF 寫 1.6 秒）；閃光兩層：一道被字形 clipPath 裁住的斜向高光每 4.5 秒掃過一次，
     三顆四角星芒在字的起筆、i 的點、收筆處輪流閃。
     SSR／無 JS：ink 由遮罩藏著，只看得到淡底稿（ghost），有 JS 才寫；reduced-motion 直接寫滿、閃光由全域 guard 收掉。
     書的泡泡那跨也用它（variant="paper"）：字改紙白、閃光改金，並且等翻到那一跨（start）才起筆。 -->
<script setup lang="ts">
import { I_SHINE_PATH, I_SHINE_VIEWBOX } from './iShinePath'

const props = withDefaults(defineProps<{
  /** 無障礙名稱（字樣內容） */
  label: string
  /** 開始書寫前等多久（ms），讓上一行大字先就位 */
  delay?: number
  /** 起筆的開關：false 時只畫底稿，變成 true 那一刻才寫（書頁等翻到才寫）；預設一掛上就寫 */
  start?: boolean
  /** 配色：gold＝紙上的金（首屏）；paper＝照片上的紙白，閃光改金（書的泡泡那跨） */
  variant?: 'gold' | 'paper'
}>(), { delay: 500, start: true, variant: 'gold' })

const WRITE_MS = 1600
/** 遮罩掃過的距離（viewBox 單位）：p=0 整片在字左邊之外，p=1 連軟邊都過了收筆處 */
const WIPE_TRAVEL = 1050
const WIPE_END = 130
/** 星芒位置（viewBox 座標） */
const SPARKS = [
  { x: 96, y: 34 },
  { x: 528, y: 22 },
  { x: 776, y: 118 },
]

const id = `shine-${useId()}`
const progress = ref(0)
const done = ref(false)
let frame = 0

// 斜邊順著斜體（skewX -15°），先斜再平移；SSR 時 progress 0，整片在左邊外面把 ink 藏住
const wipeTransform = computed(() => `translate(${((progress.value - 1) * WIPE_TRAVEL + WIPE_END).toFixed(1)} 0) skewX(-15)`)

let began = false

/** 起筆：只跑一次；reduced-motion 直接寫滿 */
function begin() {
  if (began)
    return
  began = true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    progress.value = 1
    done.value = true
    return
  }
  let origin: number | null = null
  function step(now: number) {
    if (origin === null)
      origin = now + props.delay
    const t = Math.min(1, Math.max(0, (now - origin) / WRITE_MS))
    // 書寫用 ease-in-out：起筆慢、中段穩、收筆輕
    progress.value = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    if (t < 1) {
      frame = requestAnimationFrame(step)
    }
    else {
      frame = 0
      done.value = true
    }
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => {
  if (props.start)
    begin()
})
watch(() => props.start, (on) => {
  if (on)
    begin()
})

onBeforeUnmount(() => {
  if (frame)
    cancelAnimationFrame(frame)
})
</script>

<template>
  <svg
    :viewBox="I_SHINE_VIEWBOX"
    role="img"
    :aria-label="label"
    class="mark"
    :class="{ 'is-done': done, 'is-paper': variant === 'paper' }"
  >
    <defs>
      <path :id="`${id}-p`" :d="I_SHINE_PATH" />
      <!-- 揭開用的遮罩：一片白色矩形，右緣最後 8% 漸淡成軟邊，整片斜著往右平移 -->
      <linearGradient :id="`${id}-wipe-grad`" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#fff" />
        <stop offset="0.92" stop-color="#fff" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <mask :id="`${id}-wipe`" maskUnits="userSpaceOnUse" x="-400" y="-60" width="1600" height="300">
        <rect x="-300" y="-40" width="1189" height="257" :fill="`url(#${id}-wipe-grad)`" :transform="wipeTransform" />
      </mask>
      <clipPath :id="`${id}-clip`">
        <use :href="`#${id}-p`" />
      </clipPath>
      <!-- 高光的顏色掛 class：紙白版的字上白光看不見，改成金光（stop-color 用 CSS 換） -->
      <linearGradient :id="`${id}-glint`" x1="0" x2="1" y1="0" y2="0">
        <stop class="glint-stop" offset="0" stop-color="#fff" stop-opacity="0" />
        <stop class="glint-stop" offset="0.5" stop-color="#fff" stop-opacity="0.85" />
        <stop class="glint-stop" offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- 底稿：還沒寫到的地方留一個淡淡的引導；寫滿之後被 ink 完全蓋住 -->
    <use :href="`#${id}-p`" class="ghost" />
    <!-- 字樣：填色＋同色細描邊加粗（取代原檔那條 340KB 的外描邊路徑），由遮罩從左揭到右 -->
    <use :href="`#${id}-p`" class="ink" :mask="`url(#${id}-wipe)`" />
    <!-- 閃光：裁在字形內的斜向高光，從左掃到右 -->
    <g :clip-path="`url(#${id}-clip)`">
      <rect class="glint" x="0" y="-40" width="140" height="260" :fill="`url(#${id}-glint)`" />
    </g>
    <!-- 星芒：四角星，各自錯開 0.45 秒 -->
    <g v-for="(spark, i) in SPARKS" :key="i" :transform="`translate(${spark.x} ${spark.y})`">
      <path
        class="spark"
        :style="{ '--k': i }"
        d="M0-9C.8-3.4 3.4-.8 9 0 3.4.8.8 3.4 0 9-.8 3.4-3.4.8-9 0-3.4-.8-.8-3.4 0-9Z"
      />
    </g>
  </svg>
</template>

<style scoped>
.mark {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.ghost {
  fill: var(--color-gold-light);
  opacity: 0.18;
}

.ink {
  fill: var(--color-gold-light);
  stroke: var(--color-gold-light);
  stroke-width: 1.6;
  stroke-linejoin: round;
}

/* 紙白版（照片上）：字與底稿都是紙白，高光與星芒的邊改金，落在照片上才看得到 */
.is-paper .ghost {
  fill: var(--color-paper);
  opacity: 0.22;
}
.is-paper .ink {
  fill: var(--color-paper);
  stroke: var(--color-paper);
}
.is-paper .glint-stop {
  stop-color: var(--color-gold-light);
}
.is-paper .spark {
  stroke: var(--color-gold-light);
}

/* 高光：寫完（is-done）才開始掃，週期 4.5 秒、掃過 1.3 秒、其餘時間停在畫面外 */
.glint {
  opacity: 0;
  transform: translateX(-160px) skewX(-18deg);
}
.is-done .glint {
  animation: glint 4.5s var(--ease-standard) 0.4s infinite;
}
@keyframes glint {
  0% {
    opacity: 1;
    transform: translateX(-160px) skewX(-18deg);
  }
  28% {
    opacity: 1;
    transform: translateX(820px) skewX(-18deg);
  }
  29%,
  100% {
    opacity: 0;
    transform: translateX(820px) skewX(-18deg);
  }
}

/* 星芒：白心金邊，落在字上是白光、落在紙上是金點；每顆只在週期前 11% 亮一下 */
.spark {
  fill: #fff;
  stroke: var(--color-gold-deep);
  stroke-width: 0.8;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
  opacity: 0;
}
.is-done .spark {
  animation: spark 4.5s var(--ease-standard) calc(0.6s + var(--k, 0) * 0.45s) infinite;
}
@keyframes spark {
  0% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  5% {
    opacity: 1;
    transform: scale(1) rotate(30deg);
  }
  11%,
  100% {
    opacity: 0;
    transform: scale(0) rotate(60deg);
  }
}
</style>
