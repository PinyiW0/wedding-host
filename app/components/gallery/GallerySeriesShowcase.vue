<!-- app/components/gallery/GallerySeriesShowcase.vue — landing 的單一系列區塊
     結構抄 adovasio.it：被釘住的是**名字**，照片走正常文件流由下往上經過。
     這樣照片之間的空白是真的 margin，撞不到——舊版把照片絕對定位、各給一個很大的
     視差幅度（-38vh ~ -190vh），間距變成「速度差算出來的結果」，快的一定會追上慢的。
     現在每張只用 8~20vh 的位移（相對頁面 0.83~0.93 倍速），落在參考站量到的區間內。
     尺寸走五階 14vw ~ 44vw（3.1 倍，同參考站）；一排永不超過兩張，成對的用負 margin 並肩。
     --gt 預設 0.5（零位移）：無 JS 或 reduced-motion 時就是一般的靜態排版。
     本檔不在公開頁白名單，display 字級走 <style scoped>。 -->
<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { GallerySeries } from '~/types/gallery'

const props = defineProps<{
  series: GallerySeries
  anchorId: string
  to: string
  /** 第幾個系列（0 起算），決定用哪一種單／雙節奏 */
  layout: number
}>()

/** 要拉這麼多 px 才換排版；比一般誤觸大，滑一下不會翻版 */
const PULL_PX = 90
/** 判定拖曳方向前的死區 */
const AXIS_PX = 16
/** 對齊模式下每張之間的固定間距（vh） */
const ALIGN_GAP = 8

/**
 * 一張照片在照片流裡的位置。
 * x：距照片帶左緣多少 vw；w：寬 vw；ar：寬高比；
 * gap：上方空白 vh（負值＝與上一張並肩）；lift：視差幅度 vh（越大越慢）
 */
interface CardBox {
  x: number
  w: number
  ar: number
  gap: number
  lift: number
}

/** 照片帶：整組照片橫向不超出這個範圍，維持「不超過畫面寬 2/3」 */
interface Band {
  left: number
  width: number
}

// 左緣刻意再讓開一點：系列名底下要放系列說明，那一塊得保持乾淨（見 .ss-desc）
const DESKTOP_BAND: Band = { left: 24, width: 59 }
const MOBILE_BAND: Band = { left: 40, width: 60 }

/** 手機版型：四張，單 → 雙 → 單，三個系列共用 */
const MOBILE: CardBox[] = [
  { x: 0, w: 60, ar: 0.75, gap: 0, lift: 10 },
  { x: 0, w: 32, ar: 0.75, gap: 24, lift: 18 },
  { x: 34, w: 26, ar: 0.8, gap: -16, lift: 12 },
  { x: 8, w: 46, ar: 0.8, gap: 28, lift: 15 },
]

// 尺寸五階：L 44 / M+ 32 / M 26 / S 18 / XS 14（vw）。
// 每個系列的單／雙節奏不同，捲下來三段才不會長得一樣。
// 兩條全系列共用的規矩：
// 1. L（44vw）一律單張，且對齊**畫面**正中（x=4＝畫面 28~72vw）——照片帶左緣是 24，
//    所以帶內 x 要用 4 不是 11。系列名只留 21~77vw 的乾淨帶，大圖再找一張並肩就會壓到英文名。
// 2. 每段最後一張是收尾鏡頭：單張、置中（畫面 50vw）。舊版三段的收尾分別落在 55／74／70vw，
//    整個吊在右邊、左半空一片。這裡只改落點，尺寸與寬高比一律維持原樣。
/** 桌機版型，依系列順序取用 */
const DESKTOP: CardBox[][] = [
  // 單 → 雙 → 單 → 雙 → 單（收尾）
  [
    { x: 4, w: 44, ar: 0.75, gap: 0, lift: 10 },
    { x: 0, w: 18, ar: 0.8, gap: 30, lift: 18 },
    { x: 33, w: 26, ar: 0.75, gap: -26, lift: 12 },
    { x: 8, w: 32, ar: 0.8, gap: 32, lift: 14 },
    { x: 4, w: 14, ar: 0.75, gap: 26, lift: 20 },
    { x: 32, w: 26, ar: 0.75, gap: -20, lift: 11 },
    { x: 17, w: 18, ar: 0.8, gap: 34, lift: 16 },
  ],
  // 雙 → 單 → 雙 → 單 → 單（收尾）
  [
    { x: 2, w: 26, ar: 0.75, gap: 0, lift: 14 },
    { x: 41, w: 18, ar: 0.8, gap: -40, lift: 9 },
    { x: 4, w: 44, ar: 0.75, gap: 34, lift: 10 },
    { x: 0, w: 14, ar: 0.75, gap: 30, lift: 19 },
    { x: 27, w: 32, ar: 0.8, gap: -24, lift: 12 },
    { x: 18, w: 26, ar: 0.75, gap: 32, lift: 16 },
    { x: 17, w: 18, ar: 0.8, gap: 28, lift: 13 },
  ],
  // 單 → 雙 → 單 → 單（收尾）（城市只有五張；原本末兩張並肩，收尾要置中就不能再並肩）
  [
    { x: 4, w: 44, ar: 0.75, gap: 0, lift: 10 },
    { x: 0, w: 18, ar: 0.8, gap: 32, lift: 18 },
    { x: 27, w: 32, ar: 0.8, gap: -28, lift: 11 },
    { x: 8, w: 14, ar: 0.75, gap: 34, lift: 20 },
    { x: 13, w: 26, ar: 0.75, gap: 30, lift: 13 },
  ],
]

/**
 * 海邊那一段的泡泡。位置、大小、飄的軌跡全部寫死——**不能用 Math.random**，
 * 那會讓 SSR 與 client 算出不同的值，hydration 直接對不起來。
 * x：左緣 vw；size：直徑 px；from：起點距畫面底多少 vh（負值＝從畫面下方進來）；
 * rise：一趟往上飄多少 vh；dx：整段往右偏多少 vw；dur：一趟幾秒；
 * delay：負值＝一進場就已經在半空中，不會全部從底下一起冒出來
 */
interface Bubble {
  x: number
  size: number
  from: number
  rise: number
  dx: number
  dur: number
  delay: number
  o: number
}

/** 整段的環境泡泡：從畫面下方進來，一路飄出上緣 */
const AMBIENT_BUBBLES: Bubble[] = [
  { x: 6, size: 26, from: -14, rise: 124, dx: 14, dur: 19, delay: 0, o: 0.55 },
  { x: 14, size: 12, from: -14, rise: 124, dx: 9, dur: 15, delay: 6, o: 0.4 },
  { x: 22, size: 40, from: -14, rise: 124, dx: 18, dur: 24, delay: 11, o: 0.5 },
  { x: 31, size: 16, from: -14, rise: 124, dx: 11, dur: 17, delay: 3, o: 0.45 },
  { x: 40, size: 30, from: -14, rise: 124, dx: 15, dur: 21, delay: 14, o: 0.5 },
  { x: 48, size: 10, from: -14, rise: 124, dx: 8, dur: 14, delay: 8, o: 0.38 },
  { x: 57, size: 46, from: -14, rise: 124, dx: 20, dur: 26, delay: 2, o: 0.45 },
  { x: 65, size: 18, from: -14, rise: 124, dx: 12, dur: 18, delay: 12, o: 0.42 },
  { x: 72, size: 34, from: -14, rise: 124, dx: 16, dur: 22, delay: 5, o: 0.5 },
  { x: 80, size: 13, from: -14, rise: 124, dx: 9, dur: 16, delay: 17, o: 0.4 },
  { x: 88, size: 24, from: -14, rise: 124, dx: 13, dur: 20, delay: 9, o: 0.45 },
  { x: 94, size: 9, from: -14, rise: 124, dx: 7, dur: 13, delay: 15, o: 0.35 },
]

/**
 * 貼著插圖那對新人右側的一小簇。起點抬高到插圖的高度（插圖底邊在 50% + 3rem，
 * 往上 28vh），行程也短，看起來才像從人物身邊冒出來、往右上飄走，
 * 而不是從畫面最底下一路衝上來剛好經過。
 */
const FIGURE_BUBBLES: Bubble[] = [
  { x: 15, size: 20, from: 50, rise: 54, dx: 12, dur: 13, delay: 0, o: 0.5 },
  { x: 20, size: 9, from: 54, rise: 46, dx: 9, dur: 10, delay: 4, o: 0.42 },
  { x: 17, size: 13, from: 60, rise: 50, dx: 14, dur: 15, delay: 8, o: 0.45 },
  { x: 24, size: 16, from: 56, rise: 44, dx: 10, dur: 12, delay: 2, o: 0.4 },
  { x: 22, size: 7, from: 64, rise: 40, dx: 8, dur: 9, delay: 6, o: 0.38 },
  { x: 27, size: 11, from: 52, rise: 58, dx: 13, dur: 14, delay: 11, o: 0.36 },
]

const bubbleStyles = computed(() => [...AMBIENT_BUBBLES, ...FIGURE_BUBBLES].map(b => ({
  '--x': `${b.x}vw`,
  '--s': `${b.size}px`,
  '--b': `${b.from}vh`,
  '--rise': `${b.rise}vh`,
  '--dx': `${b.dx}vw`,
  '--dur': `${b.dur}s`,
  '--delay': `${-b.delay}s`,
  '--o': String(b.o),
})))

const blockRef = ref<HTMLElement | null>(null)
/** 名字是否就位；SSR 預設 true，沒有 JS 時大字永遠看得見 */
const isActive = ref(true)
/** 系列說明只在區塊剛進場那一小段露臉，講完就讓開 */
const isNoteVisible = ref(true)
/** true＝照片全部對齊到畫面中心軸 */
const isAligned = ref(false)

let dragId: number | null = null
let startX = 0
let startY = 0
let axis: 'none' | 'x' | 'y' = 'none'
/** 這次放開手是拖曳的結尾，不是點擊——用來擋掉連結導向 */
let swallowClick = false

function onPointerDown(event: PointerEvent) {
  swallowClick = false
  if (event.pointerType === 'mouse' && event.button !== 0)
    return
  dragId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  axis = 'none'
}

function onPointerMove(event: PointerEvent) {
  if (dragId === null || event.pointerId !== dragId)
    return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (axis === 'none') {
    if (Math.abs(dx) < AXIS_PX && Math.abs(dy) < AXIS_PX)
      return
    // 垂直為主＝使用者在捲頁，整段讓給原生捲動
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (axis === 'y') {
      dragId = null
      return
    }
  }
  if (dx >= PULL_PX)
    isAligned.value = true
  else if (dx <= -PULL_PX)
    isAligned.value = false
  else
    return
  swallowClick = true
  dragId = null
}

function endDrag() {
  dragId = null
}

/** 拖完放開的那一下不要順便進系列頁 */
function onClickCapture(event: MouseEvent) {
  if (!swallowClick)
    return
  swallowClick = false
  event.stopPropagation()
  event.preventDefault()
}

function round(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/**
 * 把一張照片的版型換算成 CSS var。
 * --?-dx 是「從散落位置走到畫面中心軸」的水平位移。
 * --?-dy 是同一件事的垂直分量：散落版型裡並肩的兩張靠負 margin 疊上去，
 * 全部推到中軸後那個負值還在、就會互相重疊。把每張的間距換算成統一的
 * ALIGN_GAP，差額用 transform 補——高度全部相同（縮放以自身中心為原點、
 * 不影響版面），所以差額是純 vh：i * ALIGN_GAP - 累積 gap。
 */
function areaVars(prefix: string, box: CardBox, band: Band, index: number, cumGap: number): Record<string, string> {
  const left = band.left + box.x
  return {
    [`--${prefix}-x`]: `${round(left)}vw`,
    [`--${prefix}-w`]: `${round(box.w)}vw`,
    [`--${prefix}-ar`]: round(box.ar),
    [`--${prefix}-gap`]: `${round(box.gap)}vh`,
    [`--${prefix}-lift`]: `${round(box.lift)}vh`,
    [`--${prefix}-dx`]: `${round(50 - (left + box.w / 2))}vw`,
    [`--${prefix}-dy`]: `${round(index * ALIGN_GAP - cumGap)}vh`,
  }
}

// 版型有幾格就演幾張；系列給的照片比格子多就截掉，少就自然收短
const cards = computed(() => {
  const boxes = DESKTOP[props.layout % DESKTOP.length]!
  let mobileCum = 0
  let desktopCum = 0
  return props.series.showcase.slice(0, boxes.length).map((photo, i) => {
    const mobile = MOBILE[i]
    const desktop = boxes[i]!
    if (mobile)
      mobileCum += mobile.gap
    desktopCum += desktop.gap
    return {
      photo,
      style: {
        ...(mobile ? areaVars('m', mobile, MOBILE_BAND, i, mobileCum) : {}),
        ...areaVars('d', desktop, DESKTOP_BAND, i, desktopCum),
      },
    }
  })
})

// 大字只放英文、拆成左右兩半（新人指示：不要中文系列名）。
// 中文名沒有消失——它還在 h2 的 sr-only 與連結的 aria-label 裡，螢幕閱讀器照樣念得到。
const leftChars = computed(() => Array.from(props.series.word.slice(0, props.series.wordSplit)))
const rightChars = computed(() => Array.from(props.series.word.slice(props.series.wordSplit)))

const items: HTMLElement[] = []

function setCardRef(el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement && !items.includes(el))
    items.push(el)
}

const { register } = useScrollProgress()

onMounted(() => {
  register(blockRef.value, {
    varName: '--sp',
    // 進出各留一段：名字在區塊剛進場與快離場時退場，中段才完全就位
    onProgress: (p) => {
      isActive.value = p > 0.08 && p < 0.92
      isNoteVisible.value = p > 0.06 && p < 0.34
    },
  })
  for (const el of items)
    register(el, { varName: '--gt', mode: 'travel' })
})
</script>

<template>
  <section :id="anchorId" ref="blockRef" class="ss">
    <NuxtLink
      :to="to"
      class="ss-link"
      :data-active="isActive ? 'true' : 'false'"
      :data-note="isNoteVisible ? 'true' : 'false'"
      :data-align="isAligned ? 'true' : 'false'"
      :aria-label="`看「${series.title}」系列，共 ${series.photos.length} 張`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @click.capture="onClickCapture"
      @dragstart.prevent
    >
      <div class="ss-stage">
        <h2 class="ss-names">
          <span class="sr-only">{{ series.title }}</span>
          <span class="ss-word ss-word-left" aria-hidden="true">
            <span
              v-for="(char, i) in leftChars"
              :key="`l-${i}`"
              class="ss-char"
              :style="{ '--i': String(i) }"
            >{{ char }}</span>
          </span>
          <span class="ss-word ss-word-right" aria-hidden="true">
            <span
              v-for="(char, i) in rightChars"
              :key="`r-${i}`"
              class="ss-char"
              :style="{ '--i': String(leftChars.length + i) }"
            >{{ char }}</span>
          </span>
        </h2>

        <img
          v-if="series.artwork"
          :src="series.artwork"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          class="ss-art"
        >

        <template v-if="series.windmills">
          <img
            src="/images/gallery-art/windmill.webp"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            class="ss-windmill ss-windmill-sm"
          >
          <img
            src="/images/gallery-art/windmill.webp"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            class="ss-windmill ss-windmill-lg"
          >
        </template>

        <div v-if="series.bubbles" class="ss-bubbles" aria-hidden="true">
          <img
            v-for="(style, i) in bubbleStyles"
            :key="i"
            src="/images/gallery-art/bubble.webp"
            alt=""
            loading="lazy"
            decoding="async"
            class="ss-bubble"
            :style="style"
          >
        </div>
      </div>

      <div class="ss-foot" aria-hidden="true">
        <span class="ss-meta">
          <span class="ss-desc">{{ series.description }}</span>
        </span>
      </div>

      <div class="ss-stream" aria-hidden="true">
        <figure
          v-for="card in cards"
          :ref="setCardRef"
          :key="card.photo.src"
          class="ss-card"
          data-cursor="Enter"
          :style="card.style"
        >
          <img
            :src="card.photo.src"
            :alt="card.photo.alt"
            loading="lazy"
            decoding="async"
            draggable="false"
            class="ss-img"
          >
        </figure>
      </div>
    </NuxtLink>
  </section>
</template>

<style scoped>
/* overflow-x 用 clip 不能用 hidden——hidden 會讓子層的 position: sticky 整個失效 */
.ss {
  position: relative;
  overflow-x: clip;
}

.ss-link {
  position: relative;
  display: block;
}

.ss-link:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: -6px;
}

/* 被釘住的是名字，不是照片 */
.ss-stage {
  position: sticky;
  top: 0;
  height: 100dvh;
  z-index: 1;
}

/* 系列說明另外釘一層，疊在照片之上——它是要讀的字，不能被照片切掉。
   名字（stage）反過來在照片之下，讓照片壓過大字，與參考站一致 */
.ss-foot {
  position: sticky;
  top: 0;
  height: 100dvh;
  z-index: 3;
  margin-top: -100dvh;
  /* 它是滿版一層、疊在照片之上，不擋掉的話滑鼠永遠碰不到照片，
     游標就不會在照片上換成 Enter（純裝飾層，沒有要接互動） */
  pointer-events: none;
}

/* 照片流疊到名字之上 */
.ss-stream {
  position: relative;
  z-index: 2;
  margin-top: -100dvh;
  padding-block: 18vh 26vh;
}

/* 一個英文字拆成兩半：桌機各靠一側、中間留給照片穿過，手機疊成一欄靠左
   （手機橫向排會被照片整個蓋掉）
   字級刻意收在 60px 上下——名字太大會把中間的乾淨帶壓到只剩 28vw，大照片就放不下了。
   顏色也壓得比內文淡：照片會從字面上蓋過去，深色字被切斷反而比淡色字更吵 */
.ss-names {
  position: absolute;
  left: clamp(16px, 4vw, 56px);
  right: 52%;
  top: 50%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  transform: translateY(-50%);
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 4.2vw, 3.75rem);
  line-height: 1.1;
  font-weight: 400;
  color: var(--color-ink-500);
  pointer-events: none;
}

@media (min-width: 1024px) {
  .ss-names {
    right: clamp(16px, 4vw, 56px);
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }
}

/* 兩半是同一個字，字重、字色、字形都一樣，眼睛才拼得回來 */
.ss-word {
  display: inline-flex;
  letter-spacing: 0.04em;
}

/* 水彩插圖，站在大字上方。跟系列名同一層（stage），所以照片一樣會從它前面經過——
   這是刻意的，大字本來就會被照片壓過去，插圖跟著同一套規則才不會像貼上去的。
   三張原圖比例不一（兩張橫、一張直），所以固定「框」再 object-fit: contain，
   三個系列的視覺量體才會一致；object-position 貼齊底部，三張站在同一條地平線上。 */
.ss-art {
  position: absolute;
  left: clamp(16px, 4vw, 56px);
  bottom: calc(50% + 3rem);
  width: 36vw;
  height: 20vh;
  object-fit: contain;
  object-position: bottom left;
  pointer-events: none;
  transition:
    opacity 500ms var(--ease-standard),
    transform 500ms var(--ease-emphasized);
}

/* 桌機也靠左：左欄（0~24vw）是照片帶讓出來的乾淨區，插圖擺這裡完全不會被照片切到 */
@media (min-width: 1024px) {
  .ss-art {
    width: 20vw;
    height: 28vh;
  }
}

/* 風車：站在插圖那對新人的左邊，一上一下、一大一小，各自用不同轉速。
   插圖是 object-position: bottom left，量出來人物實際落在 7.9~21.4vw，
   所以風車擺在 0~7vw 這條沒被佔用的邊；bottom 沿用插圖的錨點（50% + 3rem）往上下推。 */
.ss-windmill {
  position: absolute;
  display: block;
  pointer-events: none;
  animation: ss-spin var(--spin, 9s) linear infinite;
  /* 跟著插圖一起進場、而且晚它一步——原本一直掛在畫面上，人物還沒淡入風車就先在那了。
     進場只能動 opacity：transform 已經被自轉的 animation 佔用，兩邊會打架 */
  opacity: 1;
  transition: opacity 500ms var(--ease-standard);
  transition-delay: 220ms;
}

.ss-link[data-active="false"] .ss-windmill {
  opacity: 0;
  transition-delay: 0ms;
  animation-play-state: paused;
}

/* 只寫 to 會退回矩陣插值（0deg 與 360deg 的矩陣相同、動畫直接變靜止），
   from/to 都明寫角度，瀏覽器才會逐格轉（同 MusicToggle 的金唱片） */
@keyframes ss-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 轉起來之後佔的是「旋轉後的外框」＝邊長 × √2，比設定的寬度大四成。
   手機這條邊很窄，left 要留夠，不然轉到 45 度時左半邊會被 overflow-x: clip 切掉 */
/* 大的在上（新人在截圖上點的位置＝人物頭頂左上方），小的在它左下方 */
.ss-windmill-lg {
  --spin: 11s;

  left: 6vw;
  bottom: calc(50% + 3rem + 20vh);
  width: 24px;
}

.ss-windmill-sm {
  --spin: 6.5s;

  left: 2.5vw;
  bottom: calc(50% + 3rem + 14vh);
  width: 20px;
}

@media (min-width: 1024px) {
  .ss-windmill-lg {
    left: 5.5vw;
    bottom: calc(50% + 3rem + 25vh);
    width: 44px;
  }

  .ss-windmill-sm {
    left: 2vw;
    bottom: calc(50% + 3rem + 17vh);
    width: 36px;
  }
}

/* 泡泡：跟插圖、大字同一層（stage），所以照片一樣會從它們前面經過。
   只動 transform 與 opacity；往上飄的同時往右偏，中間兩格讓 x 走得比 y 慢，
   飄起來就不是一條直線而是微微擺動。 */
.ss-bubbles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.ss-bubble {
  position: absolute;
  left: var(--x, 50vw);
  bottom: var(--b, -14vh);
  width: var(--s, 20px);
  height: var(--s, 20px);
  opacity: 0;
  animation: ss-bubble var(--dur, 20s) linear infinite;
  animation-delay: var(--delay, 0s);
}

/* 區塊不在畫面上就不要空轉 */
.ss-link[data-active="false"] .ss-bubble {
  animation-play-state: paused;
}

@keyframes ss-bubble {
  0% {
    transform: translate3d(0, 0, 0) scale(0.85);
    opacity: 0;
  }

  12% {
    opacity: var(--o, 0.45);
  }

  35% {
    transform: translate3d(calc(var(--dx, 12vw) * 0.45), calc(var(--rise, 124vh) * -0.32), 0) scale(0.95);
  }

  65% {
    transform: translate3d(calc(var(--dx, 12vw) * 0.6), calc(var(--rise, 124vh) * -0.63), 0) scale(1.02);
  }

  80% {
    opacity: var(--o, 0.45);
  }

  100% {
    transform: translate3d(var(--dx, 12vw), calc(var(--rise, 124vh) * -1), 0) scale(1.08);
    opacity: 0;
  }
}

/* 跟著系列名一起進出，不自成一個節奏 */
.ss-link[data-active="false"] .ss-art {
  opacity: 0;
  transform: translateY(12px);
}

/* 逐字進出：step 40ms，只動 transform 與 opacity */
.ss-char {
  display: inline-block;
  white-space: pre;
  transition:
    transform 400ms var(--ease-emphasized),
    opacity 400ms var(--ease-standard);
  transition-delay: calc(var(--i, 0) * 40ms);
}

.ss-link[data-active="false"] .ss-char {
  opacity: 0;
  transform: translateY(0.4em);
}

/* 位置、尺寸、視差幅度、對齊落點全部由 script 的版型表寫成 var。
   手機一組（--m-*）、桌機一組（--d-*），因為 inline style 進不了 media query */
.ss-card {
  --lift: var(--m-lift, 10vh);
  --align-dx: var(--m-dx, 0vw);
  --align-dy: var(--m-dy, 0vh);

  position: relative;
  overflow: hidden;
  margin-left: var(--m-x, 0);
  margin-top: var(--m-gap, 0);
  width: var(--m-w, 60vw);
  aspect-ratio: var(--m-ar, 0.75);
  border-radius: var(--radius);
  background: var(--color-cream);
  box-shadow: var(--shadow);
  /* 視差：--gt 由 0（視窗下方）到 1（視窗上方），照片比頁面慢 --lift／1.2 個視窗。
     換排版時 --ax 接上對齊落點、--fit 整組縮一點，讓最高的那張也看得完。
     全部只動 transform，不會逐幀重排 */
  transform:
    translate3d(var(--ax, 0px), calc((0.5 - var(--gt, 0.5)) * var(--lift) + var(--ay, 0px)), 0)
    scale(calc(var(--hov, 1) * var(--fit, 1)));
  transition: transform 500ms var(--ease-emphasized);
  will-change: transform;
}

/* 手機只演前四張，再多整段會拉得太長 */
.ss-card:nth-child(n + 5) {
  display: none;
}

@media (min-width: 1024px) {
  .ss-card {
    --lift: var(--d-lift, 12vh);
    --align-dx: var(--d-dx, 0vw);
    --align-dy: var(--d-dy, 0vh);

    margin-left: var(--d-x, 0);
    margin-top: var(--d-gap, 0);
    width: var(--d-w, 30vw);
    aspect-ratio: var(--d-ar, 0.75);
  }

  .ss-card:nth-child(n + 5) {
    display: block;
  }
}

/* 沒有「看幾張」的按鈕，照片本身就是入口——hover 時整組微微浮起當提示 */
.ss-link:hover .ss-card,
.ss-link:focus-visible .ss-card {
  --hov: 1.03;
}

.ss-img {
  display: block;
  /* 不擋掉的話，按住照片拖曳會啟動瀏覽器原生的圖片拖放，pointermove 就斷了 */
  user-select: none;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 一道斜斜的柔光隨捲動橫移過卡面，像光掃過相紙；範圍拉寬讓邊界糊掉，不留下明顯的帶狀邊 */
.ss-card::after {
  content: "";
  position: absolute;
  inset: -30%;
  pointer-events: none;
  background: linear-gradient(104deg, transparent 26%, rgb(255 250 240 / 34%) 50%, transparent 74%);
  opacity: 0.42;
  transform: translateX(calc((var(--gt, 0.5) - 0.5) * 190%));
}

/* ── 第二種排版：按住往右拉，全部對齊到畫面正中的垂直軸，一張接一張 ──
   水平走 --align-dx、垂直走 --align-dy（都在 script 端算好）。
   垂直那一維不能省：散落版型裡並肩的兩張是靠負 margin 疊上去的，
   只推水平的話那個負值還在，兩張會直接重疊在中軸上。
   --fit 讓最高的那張（滿畫面的大圖）縮到 75dvh 上下，整張看得完不會被視窗裁掉；
   scale 以卡片自身中心為原點，不會把剛對好的落點推歪。 */
.ss-link[data-align="true"] .ss-card {
  --ax: var(--align-dx);
  --ay: var(--align-dy);
  /* 對齊模式不做視差：每張速度不同的話，排成一直行還是會互相追上 */
  --lift: 0vh;
  --fit: 0.8;
}

/* 系列說明貼在系列名底下，跟標題成一組。
   舊版釘在畫面正中的底部、還墊了一層紙色膠囊——那塊底色浮在畫面中間很搶眼，
   而且量過三個系列的乾淨時段完全錯開，靠縮短顯示時間解不掉。
   改放在照片帶左緣讓出來的這一塊（見 DESKTOP_BAND），背後本來就沒有照片。 */
.ss-meta {
  position: absolute;
  left: clamp(16px, 4vw, 56px);
  top: calc(50% + 2.6rem);
  max-width: min(44vw, 20rem);
  transition:
    transform 500ms var(--ease-emphasized),
    opacity 500ms var(--ease-standard);
}

@media (min-width: 1024px) {
  .ss-meta {
    top: calc(50% + 2.9rem);
    max-width: 19vw;
  }
}

.ss-link[data-note="false"] .ss-meta {
  opacity: 0;
  transform: translateY(10px);
}

.ss-desc {
  font-size: var(--text-body);
  line-height: 1.7;
  color: var(--color-ink-500);
  /* 沒有底色塊。萬一真有照片經過背後，紙色柔邊光暈讓字仍讀得到，又不會出現硬邊 */
  text-shadow:
    0 0 6px var(--color-paper),
    0 0 18px var(--color-paper);
}

/* 動效關閉時 --gt 停在 0.5＝零位移，照片就是一般的靜態排版、本來就完整可見。
   只要讓文字浮到照片之上並加紙色暈邊就好。 */
@media (prefers-reduced-motion: reduce) {
  .ss-stage {
    z-index: 3;
  }

  /* 全域 guard 會把動畫壓成 0.01ms，泡泡會定格在終點；乾脆整層收掉 */
  .ss-bubbles {
    display: none;
  }

  /* 風車不轉就是一張靜態插圖，留著沒問題，只要真的停住 */
  .ss-windmill {
    animation: none;
  }

  .ss-char {
    text-shadow:
      0 0 6px var(--color-paper),
      0 0 20px var(--color-paper);
  }
}
</style>
