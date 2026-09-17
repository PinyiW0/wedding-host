<!-- app/components/story/StoryHeroRing.vue — 首屏的祝福圓：婚紗照繞成一整圈，慢慢自轉，圈住中央的標題。
     游標指到一張（或點開一張），那張清楚、放大，其餘照離它多遠依序變糊、變淡——像相機對焦在那一張上的景深。
     點一張，圓心的標題換成那張照片帶的一句祝福，圓停下來等你讀完；再點同一張收回、繼續轉。
     照片掛 data-ring-tile：首屏靠這個屬性分辨「點在照片上」（照片自己管開關）與「點在別處」（關掉祝福）。
     幾何全部走 CSS：每個位置先 rotate(--a) 轉到自己的角度，再往外推一個半徑。
     照片本身永遠直立（2026-09-15 改）：跟著圓弧側躺時整圈像一堆菱形在翻滾，搶走中央標題的注意力。
     整圈的自轉是外層 .orbit 一個 rotate 動畫（class 不叫 ring：那是 Tailwind 的 utility，會在 0×0 的圓心畫出一顆 1px 深灰點，新人 09-17 在 S 裡看到的黑點就是它）；每張照片再掛一個同長度、反方向的 rotate 動畫，同時抵銷自己的 --a 與整圈的自轉。
     半徑、照片邊長、圓心高度由外層（StoryHero）用 --ring-r／--tile／--ring-cy 決定：
     手機整圈繞著標題；桌機照 coveomusic.com 實測的比例——半徑 0.6 個視窗高、圓心壓在時間軸的高度，只露出上半圈，
     下半圈用 mask 淡掉，不跟時間軸與翻頁按鈕打架。
     沒有 JS（live=false）時整組不渲染：它是純互動裝飾，SSR 的終態就是原本那個乾淨的首屏。 -->
<script setup lang="ts">
import type { StoryHeroTile } from '~/types/story'

const props = defineProps<{
  tiles: StoryHeroTile[]
  /** 目前打開的那一張的索引（對 tiles）；null＝圓心顯示標題、圓繼續轉 */
  active: number | null
  /** JS 已接管；false（SSR／無 JS）時不渲染 */
  live: boolean
}>()

defineEmits<{ select: [index: number] }>()

/** 與 StoryDeck 同一條分界：這寬度以上是桌機（圓心壓低、露上半圈），以下是手機（整圈） */
const WIDE_QUERY = '(min-width: 64rem)'

/* 景深（照 coveomusic 實測）：對焦那張 scale 1.15、不糊；每往外一張 blur 多 1px、opacity 少 0.12、
   放大量以 0.72 的比例遞減（1.11 → 1.08 → 1.06 → 1.04 …）。糊與淡各設一個底，遠處的照片還看得出是照片 */
const FOCUS_SCALE = 0.15
const FOCUS_DECAY = 0.72
const BLUR_PER_STEP_PX = 1
const BLUR_MAX_PX = 8
const DIM_PER_STEP = 0.12
const DIM_MIN = 0.22

// 桌機 16 張、手機 8 張；保留原始 index，點擊後仍對應原來的祝福。
const wide = ref(false)
const shown = computed(() => props.tiles
  .map((tile, index) => ({ ...tile, index }))
  .filter((_, index) => index % 3 !== 2)
  .slice(0, wide.value ? 16 : 8))

// 游標指著的那張（滑鼠／觸控筆才算；手指一點就放，讓 active 接手）
const hovered = ref<number | null>(null)
/** 對焦的那張：游標優先，沒游標就是點開的那張；null＝沒對焦，整圈一樣清楚 */
const focus = computed(() => hovered.value ?? props.active)

// 從正上方開始順時針平分一圈。進場的延遲依「離正上方多遠」算，照片從圓頂往兩側依序點亮。
// 景深的「距離」是沿圓周數幾格（兩個方向取近的），不受自轉影響
const placed = computed(() => {
  const n = shown.value.length
  return shown.value.map((tile, i) => {
    const angle = (360 / n) * i
    const fromTop = angle > 180 ? 360 - angle : angle
    let blur = 0
    let dim = 1
    let pop = 1
    const focusedPosition = shown.value.findIndex(item => item.index === focus.value)
    if (focus.value !== null && focusedPosition >= 0) {
      const raw = Math.abs(i - focusedPosition)
      const depth = Math.min(raw, n - raw)
      blur = Math.min(depth * BLUR_PER_STEP_PX, BLUR_MAX_PX)
      dim = Math.max(DIM_MIN, 1 - depth * DIM_PER_STEP)
      pop = 1 + FOCUS_SCALE * FOCUS_DECAY ** depth
    }
    return { ...tile, angle, delay: fromTop / 180, blur, dim, pop, size: i % 4 === 0 ? 1.18 : i % 2 === 0 ? 1 : 0.88 }
  })
})

function onEnter(index: number, event: PointerEvent) {
  if (event.pointerType !== 'touch')
    hovered.value = index
}
function onLeave(index: number) {
  if (hovered.value === index)
    hovered.value = null
}

/* 鍵盤停靠點：桌機只露上半圈，下半圈被 mask 淡掉或落到視窗外，但照片仍是 button——
   不處理的話 Tab 會停在看不見的照片上，對焦還讓圓停在那個看不見的位置、外框也被 mask 蓋掉
   （PR #159 Copilot 審查；實測 1440×900 Tab 走過 16 張有 7 張看不見）。
   圓一直在轉，哪幾張看得見會變，所以在按下 Tab 的當下讀整圈轉到幾度，離正上方超過 75° 的暫時退出 Tab 順序。
   75° 時照片下緣仍在淡出起點（圓心上方 4rem）之上，整張看得清楚。手機整圈都露出來，全部可停 */
const VISIBLE_ARC_DEG = 75
const ringEl = ref<HTMLElement | null>(null)
const spin = ref(0)

function readSpin() {
  const value = ringEl.value ? getComputedStyle(ringEl.value).rotate : 'none'
  spin.value = value === 'none' ? 0 : Number.parseFloat(value) || 0
}

function outOfView(angle: number) {
  if (!wide.value)
    return false
  const at = (((angle + spin.value) % 360) + 360) % 360
  return Math.min(at, 360 - at) > VISIBLE_ARC_DEG
}

/** keydown 的處理器跑完、瀏覽器移動焦點之前，Vue 就把 tabindex 更新好了（更新排在 microtask，先於預設動作） */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab')
    readSpin()
}

let wideQuery: MediaQueryList | null = null
function syncWide() {
  wide.value = wideQuery?.matches ?? false
}

/* 首屏捲出畫面就整圈停轉：一圈加每張照片的反轉是十幾個一直在動的合成圖層，在畫面外也逐幀吃 GPU，
   手機捲故事頁時跟頁面搶（新人 09-17：往下滑很卡）；捲回來再接著轉。
   整組是 v-if 掛上的（live 之後才有），所以等元素真的出現再觀察 */
const away = ref(false)
const layerEl = ref<HTMLElement | null>(null)
let awayObserver: IntersectionObserver | null = null
watch(layerEl, (el) => {
  awayObserver?.disconnect()
  awayObserver = null
  if (!el)
    return
  awayObserver = new IntersectionObserver((entries) => {
    away.value = !entries.some(entry => entry.isIntersecting)
  })
  awayObserver.observe(el)
})

onMounted(() => {
  wideQuery = window.matchMedia(WIDE_QUERY)
  syncWide()
  wideQuery.addEventListener('change', syncWide)
  window.addEventListener('keydown', onKeydown, true)
})
onBeforeUnmount(() => {
  wideQuery?.removeEventListener('change', syncWide)
  window.removeEventListener('keydown', onKeydown, true)
  awayObserver?.disconnect()
})
</script>

<template>
  <div v-if="live && tiles.length" ref="layerEl" class="ring-layer pointer-events-none absolute inset-0" aria-hidden="false">
    <!-- is-held：有對焦（游標指著或點開）就停轉，目標不會從游標下面溜走；is-away：整圈捲出畫面，停轉省合成。
         key 跟著 wide：跨過斷點時張數會變，新掛上的照片若沿用舊的一圈，反向動畫的起點會對不上整圈已經轉掉的角度，
         整組重掛讓自轉與反轉從同一個時間點起跑 -->
    <ul :key="wide ? 'wide' : 'narrow'" ref="ringEl" class="orbit absolute" :class="{ 'is-held': focus !== null, 'is-away': away }">
      <li
        v-for="tile in placed"
        :key="tile.src"
        class="slot absolute"
        :style="{ '--a': `${tile.angle}deg`, '--d': tile.delay, '--blur': `${tile.blur}px`, '--dim': tile.dim, '--pop': tile.pop, '--size': tile.size }"
      >
        <button
          type="button"
          class="tile absolute overflow-hidden bg-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
          :class="{ 'is-active': active === tile.index }"
          data-ring-tile
          :aria-label="`第 ${tile.index + 1} 張照片，翻出一句祝福`"
          :aria-pressed="active === tile.index"
          :tabindex="outOfView(tile.angle) ? -1 : undefined"
          @pointerenter="onEnter(tile.index, $event)"
          @pointerleave="onLeave(tile.index)"
          @focus="hovered = tile.index"
          @blur="onLeave(tile.index)"
          @click="$emit('select', tile.index)"
        >
          <!-- 首屏第一眼就要看到整圈：不懶載、優先抓（一張 320px 正方小圖十幾 KB），解碼放到背景執行緒 -->
          <img :src="tile.src" alt="" loading="eager" fetchpriority="high" decoding="async" draggable="false" class="size-full select-none object-cover">
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 圓心：水平置中、高度由外層的 --ring-cy 決定（手機＝標題中心、桌機＝時間軸的高度） */
.orbit {
  left: 50%;
  top: var(--ring-cy, 50%);
  width: 0;
  height: 0;
  list-style: none;
  /* 一圈三分鐘：看得出在動，又不會讓人想追著看。長度改動時 .tile 的 tile-upright 要一起改 */
  animation: ring-spin 180s linear infinite;
}
.orbit.is-held {
  animation-play-state: paused;
}
/* 照片的反轉跟著整圈一起停；進場動畫（第一個）照跑 */
.orbit.is-held .tile {
  animation-play-state: running, paused;
}
/* 捲出畫面：整圈、反轉、進場全停（看不到的東西不必動） */
.orbit.is-away,
.orbit.is-away .tile {
  animation-play-state: paused;
}
@keyframes ring-spin {
  to {
    rotate: 360deg;
  }
}

/* 桌機只露上半圈：下半圈從圓心的高度往下淡掉，不壓到橫線、翻頁按鈕與音樂碟。
   淡出的位置跟著圓心（--ring-cy）而不是時間軸——時間軸比圓心低 40px，跟著它會多露出一截下半圈 */
@media (min-width: 64rem) {
  .ring-layer {
    --fade-from: calc(var(--ring-cy, 78%) - 4rem);
    --fade-to: calc(var(--ring-cy, 78%) + 1.5rem);
    -webkit-mask-image: linear-gradient(to bottom, #000 var(--fade-from), transparent var(--fade-to));
    mask-image: linear-gradient(to bottom, #000 var(--fade-from), transparent var(--fade-to));
  }
}

.slot {
  left: 0;
  top: 0;
  /* 先轉到這張的角度，再往外推一個半徑 */
  transform: rotate(var(--a)) translateY(calc(var(--ring-r, 12rem) * -1));
}

/* 景深的三個量（--blur／--dim／--pop）由 placed 算好寫在 slot 上，這裡只負責過場。
   進場動畫只動 transform（見下），opacity 與 scale 留給景深用——同一個屬性被 fill: both 的動畫占著，過場會被蓋掉 */
.tile {
  width: calc(var(--tile, 3rem) * var(--size, 1));
  height: calc(var(--tile, 3rem) * var(--size, 1));
  /* 讓照片以自己的中心對準圓周上的那個點 */
  translate: -50% -50%;
  scale: var(--pop, 1);
  opacity: var(--dim, 1);
  border-radius: calc(var(--tile, 3rem) * 0.12);
  box-shadow: 0 0.375rem 1.25rem rgb(60 48 32 / 0.14);
  pointer-events: auto;
  cursor: pointer;
  /* 直立：抵銷 slot 的 --a。rotate 是獨立屬性，繞照片自己的中心轉，不會把照片推離圓周上的那個點；
     reduced-motion 時反轉動畫被全域 guard 收掉，停在這個靜止值（整圈也不轉，兩邊一致） */
  rotate: calc(var(--a, 0deg) * -1);
  transition:
    scale 400ms var(--ease-emphasized),
    opacity 400ms var(--ease-standard),
    filter 400ms var(--ease-standard);
  /* 進場：從圓頂開始、往兩側依序放大進來（淡入在 img 上，見下）。
     第二個動畫是反轉：與 .orbit 的 ring-spin 同長度、同時起跑、不延遲，整圈轉多少照片就倒轉多少 */
  animation:
    tile-in 600ms var(--ease-emphasized) both,
    tile-upright 180s linear infinite;
  animation-delay: calc(var(--d, 0) * 800ms + 300ms), 0s;
}
/* 景深的模糊只在有對焦時掛：blur(0px) 也是一個濾鏡，整圈一直轉時每張照片都得多過一層濾鏡合成；
   沒對焦就是 none，從 none 到 blur 一樣能過場 */
.orbit.is-held .tile {
  filter: blur(var(--blur, 0px));
}
.tile img {
  animation: tile-fade 600ms var(--ease-standard) both;
  animation-delay: calc(var(--d, 0) * 800ms + 300ms);
}

@keyframes tile-in {
  from {
    transform: scale(0.55);
  }
  to {
    transform: scale(1);
  }
}
@keyframes tile-upright {
  from {
    rotate: calc(var(--a, 0deg) * -1);
  }
  to {
    rotate: calc(var(--a, 0deg) * -1 - 360deg);
  }
}
@keyframes tile-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
