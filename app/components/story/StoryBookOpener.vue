<!-- app/components/story/StoryBookOpener.vue — 手機從故事進相簿的那道門：書的第一跨（求婚照）不直接滿版，
     照片先是一張圓角的卡片（60% 寬、放大 1.35 倍、圓角 24px）從畫面底升上來，**一露面就開始撐**：
     跟著捲動越升越寬、圓角收掉、照片縮回 1 倍；升到頂端時舞台釘住，再捲三成屏就撐滿整屏，
     底部的墨色薄紗淡進來、標題與「誠摯邀請您來參加我們的婚禮」像其他跨頁一樣落在左下；撐滿後再釘住兩成屏才放開，接第二跨。
     第一版（09-17 稍早）是 ScrollExpand 的原樣：卡片先升到畫面中間停住、標題在卡片下面，釘住之後再捲一屏才撐滿——
     新人 iPhone 實測「戒指到人物這邊很不順、要滾一段才會打開」：戒指那頁結束後先是一截空白，卡片升上來又停住，
     真正在動的只有釘住後那一屏。改成進場就撐：戒指一過照片就露出來、看到它的第一下就在開，全程 1.5 屏（原 2.25 屏）。
     做法照 Vue Bits 的 ScrollExpand（clip-path inset 開框、transform 縮圖、smoothstep 緩和），但不照抄：
     - 進度鎖在捲軸上（沒有 smoothing 的 rAF 追趕）：跟手指才不會有延遲，也少一個常駐迴圈；
     - 舞台頂端的位置只在量測時讀一次（ResizeObserver 盯著 body），捲動中只讀 scrollY，不逐幀 getBoundingClientRect；
     - 只在手機的直向翻頁模式掛（StoryBook 的 stacked）；桌機翻書、無 JS 直式堆疊都不經過這裡；
     - reduced-motion：直接是撐滿的終態、不釘住、不多捲。
     舞台高用 lvh（工具列收起時的大視窗）：釘住的滿版照片要蓋到工具列底下，不然工具列一收就露出一條紙色。
     新人 2026-09-17 決定放在這裡（只放這一處，不套在七頁的拍立得上）。 -->
<script setup lang="ts">
import type { StoryBookPhotoPage } from '~/types/story'

const props = defineProps<{
  photo: StoryBookPhotoPage
  /** 這一跨的標題（撐滿後疊在照片上）與它的 h2 id */
  title: string
  titleId: string
  /** 撐滿後疊在照片上的幾行字（空字串＝段落間距，同 StoryBookFace） */
  lines: string[]
  /** 照片先抓（StoryDeck 走到書前三頁時打開） */
  eager: boolean
}>()

const emit = defineEmits<{
  /** 照片已經蓋到右上角：選單開關要換成紙白（照片還沒蓋到之前框外是紙色，開關維持墨色） */
  open: [open: boolean]
}>()

/** 剛露面時卡片的寬、高（舞台的百分比）、上緣離舞台頂多少、圓角、照片放大倍數。
 *  上緣只留 6%：戒指那頁一結束照片就露出來（原本置中在 21%，照片前面先有一截空白） */
const START_W = 60
const START_H = 58
const START_TOP = 6
const START_R = 24
const ZOOM = 1.35
/** 進場段：從卡片上緣露出畫面底、到舞台升到頂端釘住，共 (100 − START_TOP)% 屏，一路都在撐；
 *  釘住後再捲 DISTANCE 屏撐滿；撐滿後再釘 HOLD 屏才放開接第二跨 */
const ENTRY = (100 - START_TOP) / 100
const DISTANCE = 0.3
const HOLD = 0.2
/** 疊在照片上的字從舞台釘住那一刻起淡入（釘住時卡片已撐到八成，字落在還看得到的底部） */
const OVERLAY_IN = ENTRY / (ENTRY + DISTANCE)
/** 右上角的開關離畫面上緣與右緣都在這個距離之外：照片的上緣與右邊的留白都收到這以內，就算蓋到開關了 */
const CORNER_PX = 16

const track = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const media = ref<HTMLImageElement | null>(null)
const scrim = ref<HTMLElement | null>(null)
const overlay = ref<HTMLElement | null>(null)
const still = ref(false)

let top = 0
let trackH = 1
let stageH = 1
let stageW = 1
let raf = 0
let open = false
let bodyObserver: ResizeObserver | null = null

/** 裁切重心同時當縮放的支點：剛露面時放大 1.35 倍，支點在人臉那一帶（求婚照 focus y 30%），卡片裡看到的才是人不是氣球 */
const photoStyle = computed(() => (props.photo.focus
  ? { objectPosition: `${props.photo.focus.x}% ${props.photo.focus.y}%`, transformOrigin: `${props.photo.focus.x}% ${props.photo.focus.y}%` }
  : {}))
const trackStyle = computed(() => ({ '--dist': DISTANCE, '--hold': HOLD }))

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}

/** 依進度 p 擺好框、照片、薄紗與字；stageTop 是舞台上緣在視窗裡的 y（進場中 > 0、釘住 0、放開後 < 0），拿來判斷照片蓋到開關沒 */
function apply(p: number, stageTop: number) {
  if (!frame.value || !media.value)
    return
  const e = smoothstep(0, 1, p)
  const w = START_W + (100 - START_W) * e
  const h = START_H + (100 - START_H) * e
  const ix = Math.max(0, (100 - w) / 2)
  const iyTop = START_TOP * (1 - e)
  const iyBottom = Math.max(0, 100 - h - iyTop)
  const r = START_R * (1 - e)
  frame.value.style.clipPath = `inset(${iyTop.toFixed(2)}% ${ix.toFixed(2)}% ${iyBottom.toFixed(2)}% ${ix.toFixed(2)}% round ${r.toFixed(1)}px)`
  media.value.style.transform = `scale(${(ZOOM + (1 - ZOOM) * e).toFixed(4)})`
  if (scrim.value)
    scrim.value.style.opacity = e.toFixed(3)
  if (overlay.value) {
    const inn = smoothstep(OVERLAY_IN, 1, p)
    overlay.value.style.opacity = inn.toFixed(3)
    overlay.value.style.transform = `translate3d(0, ${(18 * (1 - inn)).toFixed(1)}px, 0)`
  }
  const nowOpen = stageTop + (iyTop / 100) * stageH <= CORNER_PX && (ix / 100) * stageW <= CORNER_PX
  if (nowOpen !== open) {
    open = nowOpen
    emit('open', open)
  }
}

/** 軌道頂端在文件裡的 y、軌道高、舞台寬高：只在量測時讀（上方的照片載入、字型換上都會移，ResizeObserver 盯著 body） */
function measure() {
  if (!track.value || !stage.value)
    return
  top = track.value.getBoundingClientRect().top + window.scrollY
  trackH = track.value.clientHeight || 1
  stageH = stage.value.clientHeight || 1
  stageW = stage.value.clientWidth || 1
}

function tick() {
  raf = 0
  const y = window.scrollY
  // 進度：卡片上緣露出畫面底（舞台頂在 top − ENTRY × 舞台高）算 0，釘住後再捲 DISTANCE 屏算 1
  const p = clamp01((y - top + ENTRY * stageH) / ((ENTRY + DISTANCE) * stageH))
  // 舞台上緣在視窗裡的 y：sticky 的位置就是「夾在軌道頂與軌道底減舞台高之間」的捲動位置
  const stageTop = Math.max(top, Math.min(y, top + trackH - stageH)) - y
  apply(p, stageTop)
}

function schedule() {
  if (!raf)
    raf = requestAnimationFrame(tick)
}

function onResize() {
  measure()
  schedule()
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    still.value = true
    apply(1, 0)
    return
  }
  measure()
  tick()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  bodyObserver = new ResizeObserver(onResize)
  bodyObserver.observe(document.body)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', onResize)
  bodyObserver?.disconnect()
  if (raf)
    cancelAnimationFrame(raf)
  if (open)
    emit('open', false)
})
</script>

<template>
  <!-- 軌道：舞台高 × (1 + 撐滿距離 + 釘住距離)，舞台 sticky 在裡面 -->
  <div ref="track" class="opener" :class="{ 'is-still': still }" :style="trackStyle">
    <div ref="stage" class="stage sticky top-0 overflow-hidden bg-paper">
      <!-- 框：clip-path 從一張卡片開到整屏；裡面的照片鋪滿舞台、剛露面時放大一點、撐滿時縮回 -->
      <div ref="frame" class="frame absolute inset-0">
        <img
          ref="media"
          :src="photo.src"
          :alt="photo.alt"
          :loading="eager ? 'eager' : 'lazy'"
          decoding="async"
          class="photo absolute inset-0 block size-full object-cover"
          :style="photoStyle"
        >
        <!-- 底部的墨色薄紗：與其他跨頁疊字用的同一條漸層，撐開時才淡進來 -->
        <div ref="scrim" class="scrim pointer-events-none absolute inset-0" aria-hidden="true" />
        <!-- 撐滿後疊在照片左下的字：與 StoryBookFace 的 overlay 同一套（紙白、text-shadow） -->
        <div ref="overlay" class="overlay absolute inset-x-0 bottom-0 px-6 pb-18 text-left">
          <h2 :id="titleId" class="font-display text-h2 font-semibold tracking-wide text-paper">
            {{ title }}
          </h2>
          <div class="mt-2 space-y-1 font-serif-tc text-body leading-relaxed tracking-wider text-paper">
            <template v-for="(line, i) in lines" :key="i">
              <p v-if="line === ''" class="h-4" aria-hidden="true" />
              <p v-else>
                {{ line }}
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 軌道高＝舞台高 × (1 + 撐滿 + 釘住)。舞台用 lvh：釘住的滿版照片要蓋到收起來的工具列底下（見檔頭）；
   舊 Safari 沒有 lvh 就退回 vh（在 iOS 上 vh 本來就是大視窗） */
.opener {
  height: calc(100vh * (1 + var(--dist, 0.3) + var(--hold, 0.2)));
  height: calc(100lvh * (1 + var(--dist, 0.3) + var(--hold, 0.2)));
}
.stage {
  height: 100vh;
  height: 100lvh;
}
/* reduced-motion：不釘、不多捲，就是一張撐滿的照片 */
.opener.is-still {
  height: auto;
}
.opener.is-still .stage {
  position: relative;
}
/* 剛露面時的卡片：與 apply(0) 算出來的一樣（SSR 不會渲染這一塊，這裡只是第一幀還沒跑 JS 時的保險） */
.frame {
  clip-path: inset(6% 20% 36% 20% round 24px);
  will-change: clip-path;
}
.photo {
  transform: scale(1.35);
  transform-origin: center;
  will-change: transform;
}
.scrim {
  opacity: 0;
  background: linear-gradient(to bottom, transparent 30%, rgb(17 17 17 / 42%) 65%, rgb(17 17 17 / 68%));
}
.overlay {
  opacity: 0;
  text-shadow: 0 2px 8px rgb(0 0 0 / 35%);
}
</style>
