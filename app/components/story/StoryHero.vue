<!-- app/components/story/StoryHero.vue — 首屏：名字、In Your Love、手寫 I Shine、一句點題，
     副標下面一行「點一張照片，領取祝福」——圓上的照片可以點這件事，手機沒有 hover，不寫出來沒人知道（新人 09-16）。
     畫面下方一顆愛心是時間軸的起點。還沒出發時愛心以心跳的節拍送出一道訊號，沿著一條虛線跑：
     桌機往右跑向「出發」按鈕；手機（直向翻頁，vertical）改成另一個版型（新人 09-17）：「往下滑，出發」在上、愛心在下（都置中），
     線從愛心往下、轉個彎到左緣、再往下接第一頁沿左緣的直線——出發前虛線沿著這條路往下流，出發後金線照同一條路畫到底。
     使用者出發後（started）訊號收掉，金線從愛心長出來接到下一頁。
     無 JS 的窄螢幕也是直式堆疊，愛心在左下、線沿左緣往下（沒有訊號，直接畫滿）。
     紙白底；婚紗照只出現在祝福圓上（其餘交給 /gallery）。左上葉影沿用入口頁的背景素材——從信封點進來，仍是同一張桌面；
     葉影會像午後的日光一樣慢慢漂、忽明忽暗，游標移動時再跟著挪個兩三像素。 -->
<script setup lang="ts">
import type { StoryHeroContent } from '~/types/story'

const props = defineProps<{
  hero: StoryHeroContent
  /** 使用者已開始往下走（滑動或點擊），線才長出來、訊號才停 */
  started: boolean
  /** JS 已接管；false（SSR／無 JS）時線直接畫滿、沒有訊號 */
  live: boolean
  /** 手機的直向翻頁模式（StoryDeck）：時間軸的起點改成沿左緣往下、提示改成往下滑 */
  vertical: boolean
}>()

/** 名字中間的連接詞（全形或半形 &），連同前後空白一起切掉 */
const AMPERSAND = /\s*[＆&]\s*/
/** 副標裡的距離：數字接 km（中間可有空白），拆出來單獨排版、掛 hover 小卡 */
const DISTANCE = /(\d+)\s*(km)/i

/* 葉影的視差：游標在首屏移動，葉影往反方向挪最多 3px（遠處的影子動得比手慢）。
   只有滑鼠這類精準游標才做——手指沒有「移動中」這件事 */
const PARALLAX_PX = 3
const PARALLAX_QUERY = '(hover: hover) and (pointer: fine)'
const shift = ref({ x: 0, y: 0 })
let parallaxOn = false
let parallaxFrame = 0
function onMove(event: PointerEvent) {
  if (!parallaxOn)
    return
  // 首屏撐滿視窗，用視窗當座標系就夠（3px 的效果不值得每次 move 都量一次盒子）
  const nx = event.clientX / window.innerWidth - 0.5
  const ny = event.clientY / window.innerHeight - 0.5
  cancelAnimationFrame(parallaxFrame)
  parallaxFrame = requestAnimationFrame(() => {
    shift.value = { x: -nx * 2 * PARALLAX_PX, y: -ny * 2 * PARALLAX_PX }
  })
}

/* 副標「201 km」的路線圖小卡：卡片要對齊畫面中央的愛心，所以掛在首屏 <section> 這一層，
   不再是那組字的子孫——CSS 的 :hover 選不到它了，開關改記在 state 裡。
   手指沒有 hover，pointerType 是 touch 就不理（CSS 另有 (hover: hover) 把關） */
const kmHover = ref(false)
function onKmEnter(event: PointerEvent) {
  if (event.pointerType === 'touch')
    return
  kmHover.value = true
}
function onKmLeave() {
  kmHover.value = false
}

// 圓弧上目前翻開的那一張；null＝圓心顯示標題
const active = ref<number | null>(null)
// 便簽開著時副標整組已經淡出，路線圖不該還浮在愛心上面
const kmCardOn = computed(() => kmHover.value && active.value === null)
const activeMessage = computed(() => (active.value === null ? '' : props.hero.tiles[active.value]?.message ?? ''))
// 最後翻開過的那一張：便簽收回時字還留在紙上一起淡出，不會先變成一張白紙
const lastOpened = ref(0)

/** 便簽斷行：第一個「，」或「；」（含）之前是第一行，其餘是第二行——永遠兩行，字級依最長的那行縮（見 .wish-text） */
const CLAUSE_BREAK = /[，；]/
const wishLines = computed(() => {
  const text = props.hero.tiles[lastOpened.value]?.message ?? ''
  const at = text.search(CLAUSE_BREAK)
  if (at < 0)
    return text ? [text] : []
  return [text.slice(0, at + 1), text.slice(at + 1)]
})
const wishChars = computed(() => Math.max(1, ...wishLines.value.map(line => line.length)))

// 點同一張就收回，點別張就換一句
function toggleTile(index: number) {
  if (active.value !== index)
    lastOpened.value = index
  active.value = active.value === index ? null : index
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && active.value !== null)
    active.value = null
}

/* 便簽開著的時候，點畫面任何一處都收回來。照片除外——照片自己管開關（點同一張收回、點別張換一句），
   先被這裡收掉的話，點同一張會變成「收回又立刻打開」。
   收回的那一下不再往上傳（StoryDeck 的 .track 收 pointerdown）：手機右側 25% 是「下一頁」的點擊區，
   不擋的話收便簽會順手翻頁；擋掉之後 deck 的 dragId 沒被設起來，pointerup 直接略過。 */
function onBackdrop(event: PointerEvent) {
  if (active.value === null)
    return
  if ((event.target as Element | null)?.closest?.('[data-ring-tile]'))
    return
  active.value = null
  event.stopPropagation()
}

/* ── 手機直向的時間軸起點（is-vertical）──
   提示在上、愛心在下（都置中），線從愛心底下往下、在 V_TURN_Y 轉彎到左緣 V_X0、再往下到首屏底，接第一頁沿左緣的直線。
   線是一條 SVG path：橫向座標隨視窗寬（量 section 的寬），縱向固定 V_H px；SSR 不畫這一塊（vertical 只在 JS 接管後為真），
   所以初始寬用 390 也沒有 hydration 的問題，mount 時量到真值就換掉 */
const V_H = 120
/** 愛心中心離這一塊頂端多少（size-9 的一半） */
const V_HEART_Y = 18
/** 線往下走到這裡開始轉彎 */
const V_TURN_Y = 66
/** 轉彎的半徑 */
const V_RADIUS = 20
/** 左緣直線的 x：與 StorySlide 手機直線同一個位置（px-6 內距 1.5rem ＋ 線半寬 1px） */
const V_X0 = 25
const rootRef = ref<HTMLElement | null>(null)
const heroWidth = ref(390)
let sizeObserver: ResizeObserver | null = null

/** 從愛心底下出發：往下 → 四分之一圓轉向左 → 橫走到左緣 → 四分之一圓轉向下 → 到底 */
const vPath = computed(() => {
  const cx = heroWidth.value / 2
  const r = V_RADIUS
  const y = V_TURN_Y
  return `M${cx} ${V_HEART_Y + 18} V${y} Q${cx} ${y + r} ${cx - r} ${y + r} H${V_X0 + r} Q${V_X0} ${y + r} ${V_X0} ${y + 2 * r} V${V_H}`
})

function measureWidth() {
  if (rootRef.value)
    heroWidth.value = rootRef.value.clientWidth || 390
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  parallaxOn = window.matchMedia(PARALLAX_QUERY).matches
  measureWidth()
  if (rootRef.value) {
    sizeObserver = new ResizeObserver(measureWidth)
    sizeObserver.observe(rootRef.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  cancelAnimationFrame(parallaxFrame)
  sizeObserver?.disconnect()
})

// 名字裡的「＆」單獨拿出來用 Cormorant 斜體：兩個中文名之間一個小小的西文連接詞
const names = computed(() => {
  const parts = props.hero.namesZh.split(AMPERSAND)
  return parts.length === 2 ? { a: parts[0], b: parts[1] } : null
})
// 副標裡的「201 km」：數字放大加重、km 排成小型大寫，整組金色襯線；滑鼠移過去，畫面下方的愛心上就浮出兩地與年份的小卡。
// 句子裡沒有「數字＋km」時退回舊做法：只把數字換成襯線展示字體
const subtitleParts = computed(() => {
  const text = props.hero.subtitle
  const match = DISTANCE.exec(text)
  if (!match)
    return null
  return {
    before: text.slice(0, match.index),
    value: match[1]!,
    unit: match[2]!,
    after: text.slice(match.index + match[0].length),
  }
})
const subtitleRuns = computed(() => splitDigits(props.hero.subtitle))
</script>

<template>
  <section
    ref="rootRef"
    class="hero relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-paper px-6 pb-44 pt-24 text-center lg:pb-0 lg:pt-0"
    :class="{ 'is-live': live, 'is-started': started, 'is-vertical': vertical }"
    :style="{ '--px': `${shift.x}px`, '--py': `${shift.y}px` }"
    data-panel="0"
    @pointermove="onMove"
    @pointerdown="onBackdrop"
  >
    <!-- 背景紋理：左上葉影與 /invite 的 InviteStage 同素材同位置。素材四邊硬切，用放射狀 mask 把右緣與下緣羽化掉。
         「午後陽光」三個小動作：整片 26 秒慢慢漂一點；同一張圖疊一層糊的、清楚那層 22 秒淡進淡出，影子就在 8%～14% 之間呼吸、邊緣忽軟忽硬；
         游標移動時整片反向挪 2～3px。素材是白底灰影，用 multiply 疊上紙色——白＝透明、灰＝陰影，紙色不會被洗白。
         入口頁還有一塊左下蕾絲，這裡不放（新人 09-04 裁示）：下方已經有時間軸、頁次軸與音樂碟，不再疊紋理 -->
    <div class="leaf pointer-events-none absolute -z-10 select-none" aria-hidden="true">
      <div class="leaf-art relative">
        <img src="/images/invite/bg-shadow.webp" alt="" class="leaf-sharp block" loading="eager">
        <img src="/images/invite/bg-shadow.webp" alt="" class="leaf-soft absolute inset-0 block" loading="eager">
      </div>
    </div>

    <!-- 祝福圓：整層蓋滿首屏，圓心由 --ring-cy 決定（手機＝標題中心、桌機＝時間軸的高度）；只有照片本身收點擊 -->
    <StoryHeroRing :tiles="hero.tiles" :active="active" :live="live" @select="toggleTile" />

    <!-- 桌機左緣的直排英文：由下往上讀，固定兩行（一行一個 block、不自動折行），
         Inter 走內文、Cormorant 斜體強調數字與字眼——版位與字體混搭沿用 coveomusic 的側欄。
         墨色壓到最淡的一階（ink-300／強調 ink-500）：它是書頁邊上的批註，不跟圓與標題搶 -->
    <p class="aside absolute hidden font-sans text-caption tracking-wide text-ink-300 lg:block">
      <span v-for="(line, l) in hero.aside" :key="l" class="block">
        <template v-for="(run, i) in line" :key="i">
          <em v-if="run.em" class="font-display text-ink-500">{{ run.text }}</em>
          <template v-else>
            {{ run.text }}
          </template>
        </template>
      </span>
    </p>

    <!-- 標題整組：手機的圓心就是這一塊的中心；翻開祝福時整組淡出、祝福疊在同一個位置 -->
    <div class="core relative flex w-full flex-col items-center">
      <div class="stack flex w-full flex-col items-center" :class="{ 'is-open': active !== null }">
        <p class="rise font-serif-tc text-body-l tracking-widest text-ink-700" style="--i: 0">
          <template v-if="names">
            {{ names.a }} <span class="font-display italic font-normal text-gold">&amp;</span> {{ names.b }}
          </template>
          <template v-else>
            {{ hero.namesZh }}
          </template>
        </p>
        <!-- 主標兩行：金箔大字 + 手寫字樣（都是 SVG，role=img），無障礙名稱合起來是「In Your Love I Shine」 -->
        <!-- 標題整組比設計稿小一號（新人 09-04 裁示）：圓是首屏的主角，中間的 logo 退成安靜的中心，跟 coveomusic 的比例一致 -->
        <h1 class="rise mt-4 flex w-full flex-col items-center" style="--i: 1">
          <StoryFoilMark :text="hero.titleEn" class="text-h2 sm:text-h1" />
          <StoryShineMark :label="hero.scriptText" class="script -mt-3 w-full sm:-mt-5" />
        </h1>
        <p class="rise mt-6 font-serif-tc text-body tracking-widest text-ink-700 sm:text-body-l" style="--i: 3">
          <template v-if="subtitleParts">
            {{ subtitleParts.before }}<span
              class="km inline-block font-display font-semibold italic text-gold-deep"
              @pointerenter="onKmEnter"
              @pointerleave="onKmLeave"
            ><span class="km-digit">{{ subtitleParts.value }}</span><span class="km-unit">{{ subtitleParts.unit }}</span></span>{{ subtitleParts.after }}
          </template>
          <template v-else>
            <template v-for="(run, i) in subtitleRuns" :key="i">
              <span v-if="run.digit" class="digit font-display font-semibold text-gold-deep">{{ run.text }}</span>
              <template v-else>
                {{ run.text }}
              </template>
            </template>
          </template>
        </p>
        <!-- 圓上的照片可以點，但手機沒有 hover、看不出來（新人 09-16）：副標下面補一行提示。
             跟標題同一組，翻開祝福時一起淡出；字級用最低的 caption、金色，跟出發的提示同一套。
             桌機不顯示：滑鼠有 hover 的景深與游標當提示，而且多一行會把整組標題往上推 19px、動到首屏的構圖 -->
        <p v-if="hero.tiles.length" class="rise mt-5 font-serif-tc text-caption tracking-widest text-gold-deep lg:hidden" style="--i: 4">
          {{ hero.ringHint }}
        </p>
      </div>

      <!-- 翻開的祝福：一張便簽（紙紋、愛心迴紋針、微傾，跟貓段的紙條同一套）疊在標題上，不進版面流，圓心不會因為句子長短而位移。
           字固定兩行、一行一個 block 不折行；讀屏只聽 sr-only 那份（收回時清空，不會把留在紙上淡出的字再唸一次） -->
      <div
        v-if="live && hero.tiles.length"
        class="wish absolute rounded-sm px-7 pb-7 pt-8 text-center"
        :class="{ 'is-on': active !== null }"
        :style="{ '--chars': wishChars }"
      >
        <p class="sr-only" aria-live="polite">
          {{ activeMessage }}
        </p>
        <p class="wish-text font-serif-tc font-semibold leading-relaxed tracking-wider text-ink-700" aria-hidden="true">
          <span v-for="(line, i) in wishLines" :key="i" class="block whitespace-nowrap">{{ line }}</span>
        </p>
      </div>
    </div>

    <!-- 滑鼠移到副標「201 km」上浮出的路線圖：兩支圖釘、中間一條虛線弧，上面是距離、下面是起訖年份。
         掛在首屏這一層（不在那組字底下），才能對齊畫面中央那顆愛心的正上方 -->
    <span
      v-if="subtitleParts"
      class="km-card absolute font-display not-italic"
      :class="{ 'is-on': kmCardOn }"
      aria-hidden="true"
    >
      <span class="km-dist">{{ subtitleParts.value }} {{ subtitleParts.unit }}</span>
      <UIcon name="i-heroicons-map-pin-solid" class="km-pin km-pin-a" />
      <svg class="km-line" viewBox="0 0 120 22" fill="none" aria-hidden="true">
        <path d="M3 19 Q60 1 117 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0.6 4.4" />
      </svg>
      <UIcon name="i-heroicons-map-pin-solid" class="km-pin km-pin-b" />
      <span class="km-from">{{ hero.distance.from }}</span>
      <span class="km-years">{{ hero.distance.years }}</span>
      <span class="km-to">{{ hero.distance.to }}</span>
    </span>

    <!-- 時間軸起點（桌機、無 JS）：訊號虛線與跑動的光點指向翻頁的方向（桌機往右指向翻頁按鈕），出發後換成金線長出來 -->
    <div v-if="!vertical" class="origin absolute text-gold" aria-hidden="true">
      <span class="signal-path absolute" />
      <span class="signal-run absolute" />
      <StoryHeart class="origin-heart absolute size-9" />
      <span class="origin-line absolute bg-gold" />
    </div>
    <!-- 手機直向：提示在上、愛心在下，線從愛心往下轉到左緣接第一頁（幾何見 script 的 vPath）。
         手機沒有翻頁按鈕，這行字就是「往下滑就是翻頁」的提示，出發後跟虛線一起收掉 -->
    <div v-else class="v-origin absolute inset-x-0 bottom-0 text-gold" aria-hidden="true">
      <span class="v-hint absolute left-1/2 font-serif-tc text-body tracking-widest text-gold-deep">{{ hero.cta.hint }}</span>
      <StoryHeart class="v-heart absolute left-1/2 top-0 size-9" />
      <svg class="v-line absolute inset-0 size-full" :viewBox="`0 0 ${heroWidth} ${V_H}`" preserveAspectRatio="none" fill="none">
        <path class="v-signal" :d="vPath" pathLength="1" vector-effect="non-scaling-stroke" />
        <path class="v-ink" :d="vPath" pathLength="1" vector-effect="non-scaling-stroke" />
      </svg>
    </div>
  </section>
</template>

<style scoped>
/* 首屏進場：單拍上浮、step 80ms（無 JS 亦會播；reduced-motion 由全域 guard 收成瞬間） */
.rise {
  animation: rise-in 400ms var(--ease-standard) both;
  animation-delay: calc(var(--i, 0) * 80ms);
}
@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

/* ── 祝福圓的幾何（StoryHeroRing 讀這三個變數）──
   手機：整圈繞著標題。半徑吃寬度——43vw 是「半徑＋半張照片」剛好貼齊畫面寬、最左右兩張不被切掉；
   圓心＝標題中心——標題由 flex 置中，但 pt-24／pb-44 不對稱，中心比 50% 高 (11rem − 6rem) / 2 = 2.5rem。
   桌機：照 coveomusic.com 實測的比例——半徑 0.6 個視窗高、圓心壓在時間軸的高度（--rail-y），
   只露出上半圈，標題落在圓的上半部內側。svh 不用 dvh：手機工具列收合時 dvh 會變，整圈會跟著抖。
   照片邊長：原站兩張之間的空隙是邊長的 71%（1440 與 1920 兩個尺寸量到同一個比例），照片小、空隙大才有空間感。
   相鄰中心距 = 2πr / 格數，邊長 = 中心距 / 1.71：桌機 24 格→ 0.153r、手機 12 格→ 0.3r */
.hero {
  --ring-r: min(43vw, 28svh);
  --ring-cy: calc(50% - 2.5rem);
  --tile: calc(var(--ring-r) * 0.34);
}
@media (min-width: 64rem) {
  .hero {
    --ring-r: min(40vw, 60svh);
    /* 圓心停在 78%（＝原本時間軸的高度）。時間軸後來整條往下移了 40px，圓不跟著走——
       跟著走的話線與圓周最外側那兩張照片仍在同一條高度，一樣會穿過照片 */
    --ring-cy: 78%;
    --tile: calc(var(--ring-r) * 0.205);
  }
}

/* 手寫字樣寬度：跟著圓的半徑走、留在圓內，但比圓的內徑小一截——logo 是安靜的中心，不撐滿圓。
   09-04 第四輪再收 15%（1.25r → 1.06r、28rem → 23.8rem）。SSR（沒有圓）沿用同一個寬度，JS 接手時才不會跳一下 */
.script {
  max-width: min(calc(var(--ring-r) * 1.06), 23.8rem);
}

/* 左緣直排英文：writing-mode 直排再轉 180°，變成由下往上讀（coveomusic 的側欄同一個讀向）。
   一行一個 block、不自動折行，所以永遠剛好兩行、第二行在右邊；垂直置中，避開左下角的「跳過故事」 */
.aside {
  left: 1.5rem;
  top: 50%;
  translate: 0 -50%;
  writing-mode: vertical-rl;
  rotate: 180deg;
  white-space: nowrap;
  /* 直排時 line-height 就是兩行的間距；收緊讓兩行讀成一段 */
  line-height: 1.35;
}
/* Cormorant 的 x 高度小，斜體強調字放大一點才與 Inter 同視覺高度 */
.aside em {
  font-size: 1.15em;
}

/* 標題整組：翻開祝福時退場，讓圓心一次只有一件事。
   淡出寫在這一層而不是各行上——各行有 rise 進場動畫且 fill 是 both，會蓋掉自己的 opacity 過場 */
.stack {
  transition: opacity 400ms var(--ease-standard);
}
.stack.is-open {
  opacity: 0;
  pointer-events: none;
}

/* 祝福便簽：疊在標題正中央，不進版面流，句子長短不會推動圓心。
   紙紋、投影、愛心迴紋針沿用 StoryCats 的 .note；固定微傾 2°。
   ── 進退場 ──
   翻開：紙從中心下方 1.5rem 升上來、放大到 1、淡入（400ms，emphasized 曲線先快後慢，像被抽上來）。
   收回：反向從中心落下去、縮回 0.96、淡出（250ms，standard 曲線，比進場快一點才不拖）。
   兩段寫在不同的規則上（收回的寫在 .wish、翻開的寫在 .is-on），所以來回可以有各自的速度與曲線。
   位移合進 translate（本來就要 -50% -50% 置中），rotate 與 scale 各自獨立，互不覆蓋 */
.wish {
  /* 紙的寬度：字級要換算內寬，所以寫成變數讓兩邊共用一個值 */
  --wish-w: min(84vw, 24rem);
  left: 50%;
  top: 50%;
  width: var(--wish-w);
  translate: -50% calc(-50% + 1.5rem);
  rotate: -2deg;
  scale: 0.96;
  opacity: 0;
  pointer-events: none;
  background: url("/images/invite/note-paper.webp") center / cover;
  box-shadow:
    0 1px 1px rgb(17 17 17 / 6%),
    0 12px 26px rgb(17 17 17 / 12%);
  transition:
    opacity 250ms var(--ease-standard),
    translate 250ms var(--ease-standard),
    scale 250ms var(--ease-standard);
}
.wish::before {
  content: "";
  position: absolute;
  left: 9%;
  top: -22px;
  width: 26px;
  height: 41px;
  background: url("/images/invite/clip-heart.webp") center / contain no-repeat;
  transform: rotate(-8deg);
  filter: drop-shadow(0 3px 4px rgb(17 17 17 / 18%));
}
.wish.is-on {
  translate: -50% -50%;
  opacity: 1;
  scale: 1;
  transition:
    opacity 400ms var(--ease-standard),
    translate 400ms var(--ease-emphasized),
    scale 400ms var(--ease-emphasized);
}

/* 紙上的字比紙晚一步：紙先升到定位，字才各自浮上來（第一行 120ms、第二行 200ms），一句話像是被寫上去的。
   收回時不留延遲——整張紙連著字一起落下去，不會出現「紙走了字還在」 */
.wish-text span {
  translate: 0 0.5rem;
  opacity: 0;
  transition:
    opacity 250ms var(--ease-standard),
    translate 250ms var(--ease-standard);
}
.wish.is-on .wish-text span {
  translate: 0 0;
  opacity: 1;
  transition:
    opacity 400ms var(--ease-standard),
    translate 400ms var(--ease-emphasized);
}
.wish.is-on .wish-text span:first-child {
  transition-delay: 120ms;
}
.wish.is-on .wish-text span:nth-child(2) {
  transition-delay: 200ms;
}

/* 便簽的字級：讓最長的那一行（--chars 個字）剛好排進紙的內寬（紙寬 − 左右各 1.75rem）。
   一個字連 tracking-wider 約 1.05em，除 1.1 留一點餘裕；短句撐到上限，手機 1.5rem、桌機 2rem（＝h2） */
.wish-text {
  --wish-cap: 1.5rem;
  font-size: min(var(--wish-cap), calc((var(--wish-w) - 3.5rem) / var(--chars, 10) / 1.1));
}
@media (min-width: 40rem) {
  .wish-text {
    --wish-cap: 2rem;
  }
}

/* 句子裡的數字（沒有 km 時的退路）：Cormorant 的 x 高度小，放大一點才與中文同視覺高度 */
.digit {
  font-size: 1.15em;
  line-height: 1;
}

/* 副標裡的距離：Cormorant 的數字實際只有字身的 0.43 倍高（中文幾乎填滿字身），
   同樣 18px 排出來是 10.8px 對 16.3px，看起來小一截。放到 2.05 倍才與中文等高（實測 15.7px）。
   km 排成小型大寫——全大寫、拉開字距，取數字的八成高，跟設計稿的比例一致。
   整組不吃外層的 tracking-widest；line-height 壓到 0.9，放大後不把副標那一行撐開 */
.km {
  line-height: 0.9;
  letter-spacing: 0.02em;
}
.km-digit {
  font-size: 2.05em;
}
.km-unit {
  margin-left: 0.16em;
  font-size: 1.15em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
/* hover 路線圖：浮在愛心正上方，排成三列——距離／圖釘＋虛線弧／地名與年份。
   沒有卡片底色與外框，就是畫在紙上的一段路線（愛心上方這一帶本來就是乾淨的紙）。
   ── 定位 ──
   對齊的目標是畫面中央那顆愛心，不是副標那幾個字，所以卡片掛在首屏這一層、不在 .km 裡。
   愛心中心＝水平 50%、離底 calc(--rail-y + 1.5px)；再往上讓開半顆愛心（size-9 的一半 18px）與 0.5rem 留白，
   卡片的底緣就剛好停在愛心上方一點。
   ── 縮放 ──
   內部尺寸全部寫成 em，整張卡的大小由這裡的 font-size 一個數字決定（基準 0.75rem，目前放大 10%）。
   ── 顯示 ──
   卡片不是 .km 的子孫，:hover 選不到，開關由 .is-on（pointerenter／pointerleave）給；
   (hover: hover) 仍然把關：沒有游標的裝置不會出現，看到的就是一行副標。只動 opacity 與 transform */
.km-card {
  font-size: 0.825rem;
  /* 原本從 .km 繼承 0.9，離開那層之後要自己寫，不然三列會被預設行高撐開 */
  line-height: 0.9;
  left: 50%;
  bottom: calc(var(--rail-y, 22%) + 1.5px + 18px + 0.5rem);
  display: grid;
  grid-template-areas:
    ". dist ."
    "pin-a line pin-b"
    "from years to";
  grid-template-columns: auto 10em auto;
  align-items: center;
  justify-items: center;
  column-gap: 0.5em;
  letter-spacing: normal;
  translate: -50% 0;
  transform: translateY(-6px);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 250ms var(--ease-standard),
    transform 250ms var(--ease-emphasized);
}
@media (hover: hover) {
  .km-card.is-on {
    opacity: 1;
    transform: none;
  }
}
/* 距離：路線正上方，小型大寫，跟副標同一套金色襯線 */
.km-dist {
  grid-area: dist;
  font-size: 1em;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-gold-deep);
}
.km-line {
  grid-area: line;
  width: 10em;
  height: 1.833em;
  color: var(--color-gold);
}
.km-pin {
  width: 1.167em;
  height: 1.167em;
  color: var(--color-gold);
}
.km-pin-a {
  grid-area: pin-a;
}
.km-pin-b {
  grid-area: pin-b;
}
/* 地名與年份同一列：兩端是地名，中間是起訖年份 */
.km-from,
.km-to,
.km-years {
  font-size: 1em;
  font-weight: 500;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--color-ink-500);
}
.km-from {
  grid-area: from;
}
.km-to {
  grid-area: to;
}
.km-years {
  grid-area: years;
}

/* ── 時間軸起點（桌機、無 JS）──
   桌機是橫的：愛心在畫面中央、離底 --rail-y（與各頁橫線同高），線從愛心往右長到面板右緣。
   無 JS 的窄螢幕面板直式堆疊，改成沿左緣往下長、接第一頁的直線（在最後面覆寫）。
   手機 JS 接管後是另一塊（.v-origin，見最後面）。線只動 transform（scale），愛心一直在。 */
.origin {
  left: 50%;
  right: 0;
  bottom: calc(var(--rail-y, 22%) + 1.5px);
  height: 0;
}
.origin-heart {
  top: 0;
  left: 0;
  translate: -50% -50%;
  animation: beat 2.4s var(--ease-standard) infinite;
}
/* 心跳：每 2.4 秒跳一下，同一拍送出一道訊號 */
@keyframes beat {
  0%,
  30%,
  100% {
    transform: scale(1);
  }
  10% {
    transform: scale(1.18);
  }
  20% {
    transform: scale(1.05);
  }
}
/* 多退 1.5px（線的半寬），愛心中心與各頁 3px 橫線的中心同一個 y */
.origin-line {
  top: -1.5px;
  left: 0;
  right: 0;
  height: 3px;
  transform-origin: left;
  transform: scaleX(0);
}

/* 訊號：一條虛線標出線會長出來的路，一道光點（尾巴漸淡）沿著它從愛心跑到盡頭。
   光點的位移用 translate 100%＝跑道自己的長度，所以跑道要跟虛線同長。
   桌機停在「出發」按鈕的左緣（按鈕 3rem 寬、離右 2rem），手機沒有按鈕，跑到離右緣 1.5rem 為止。 */
.signal-path {
  top: -0.5px;
  left: 0;
  right: 5rem;
  height: 1px;
  background: repeating-linear-gradient(to right, currentColor 0 3px, transparent 3px 9px);
  opacity: 0.55;
  transition: opacity 0.4s var(--ease-standard);
}
.signal-run {
  top: -3px;
  left: 0;
  right: 5rem;
  height: 6px;
  animation: signal-x 2.4s var(--ease-standard) infinite;
}
.signal-run::before {
  content: '';
  position: absolute;
  top: 1.5px;
  left: -14px;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(to right, transparent, currentColor);
}
@keyframes signal-x {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  12%,
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(100%);
  }
}

@media (max-width: 63.999rem) {
  .signal-path,
  .signal-run {
    right: 1.5rem;
  }
  /* 無 JS 的直式堆疊：線改成沿左緣往下長、接第一頁的直線
     （愛心落在直線的 x：1.5rem 內距 + 線半寬 1px），線從愛心往下長（scaleY） */
  .hero:not(.is-live) .origin {
    left: calc(1.5rem + 1px);
    right: auto;
    bottom: 0;
    width: 0;
    height: 8rem;
  }
  .hero:not(.is-live) .origin-line {
    top: 0;
    bottom: 0;
    left: -1px;
    right: auto;
    width: 2px;
    height: auto;
    transform-origin: top;
    transform: scaleY(0);
  }
  /* 手機：葉影不動、只留清楚那一層。模糊層、混色與 26 秒的漂移在 iPhone 上是首屏每一幀的合成負擔
     （新人 09-17：進場會卡）；葉影本來就大半被圓上的照片蓋住，靜止版看不出差別 */
  .leaf-art,
  .leaf-sharp {
    animation: none;
  }
  .leaf-sharp {
    opacity: 0.8;
  }
  .leaf-soft {
    display: none;
  }
}

/* ── 手機直向的時間軸起點（is-vertical，幾何見 script）──
   提示在上（比原本大一階：text-body）、愛心在下，都置中；線是 SVG path，pathLength=1 讓虛線與描線都用比例算，
   不管螢幕多寬節奏都一樣，vector-effect 讓線寬固定。
   出發前：虛線沿著路徑往下流（dashoffset 遞減＝往終點跑，一個週期剛好一組 dash＋gap，循環無縫）；
   出發後：虛線淡出、心跳停、金線從愛心照同一條路畫到底（1.2 秒，與桌機的線同速）。 */
.v-origin {
  height: 120px;
}
.v-hint {
  bottom: calc(100% + 0.75rem);
  translate: -50% 0;
  white-space: nowrap;
  transition: opacity 0.4s var(--ease-standard);
}
.v-heart {
  translate: -50% 0;
  animation: beat 2.4s var(--ease-standard) infinite;
}
.v-line {
  overflow: visible;
}
.v-signal {
  stroke: currentColor;
  stroke-width: 1px;
  stroke-dasharray: 0.018 0.03;
  opacity: 0.55;
  animation: v-flow 1.2s linear infinite;
  transition: opacity 0.4s var(--ease-standard);
}
.v-ink {
  stroke: currentColor;
  stroke-width: 2px;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
@keyframes v-flow {
  to {
    stroke-dashoffset: -0.048;
  }
}
.is-started .v-hint,
.is-started .v-signal {
  opacity: 0;
}
.is-started .v-signal,
.is-started .v-heart {
  animation: none;
}
.is-started .v-ink {
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 1.2s var(--ease-standard);
}

/* 出發之後：訊號收掉、心跳停、金線 1.2 秒慢慢長出來。沒有 JS（不是 live）直接畫滿、也沒有訊號 */
.hero:not(.is-live) .origin-line,
.is-started .origin-line {
  transform: none;
}
.is-started .origin-line {
  transition: transform 1.2s var(--ease-standard);
}
.hero:not(.is-live) .signal-path,
.hero:not(.is-live) .signal-run,
.is-started .signal-path,
.is-started .signal-run {
  opacity: 0;
  animation: none;
}
.hero:not(.is-live) .origin-heart,
.is-started .origin-heart {
  animation: none;
}

/* ── 葉影 ──
   外層 .leaf：錨左上、尺寸同 InviteStage（52%、最小 460px）；放射狀 mask 羽化右緣下緣，multiply 讓白底消失在紙色裡；
   視差的位移寫在這一層（--px／--py 由 pointermove 寫），mask 跟著一起挪。
   中層 .leaf-art：26 秒來回漂一次——挪 12px、轉 0.6°、放大 2%，慢到不會被注意、停下來才發現它換了位置。
   兩張圖：清楚的那張 22 秒在 1 ↔ 0.55 之間呼吸；糊的那張（blur 10px、multiply 疊在清楚那張上）固定 0.33。
   影子本身約 10% 灰，兩層合起來：清楚 1 時約 13%、邊緣硬；淡到 0.55 時約 9%、糊的比例變高、邊緣軟——
   就是「雲飄過、光散掉」。全部只動 transform／opacity，模糊是靜態的一層，不逐格重算 */
.leaf {
  left: 0;
  top: 0;
  width: 52%;
  min-width: 460px;
  mix-blend-mode: multiply;
  -webkit-mask-image: radial-gradient(ellipse at top left, #000 38%, transparent 78%);
  mask-image: radial-gradient(ellipse at top left, #000 38%, transparent 78%);
  translate: var(--px, 0px) var(--py, 0px);
  transition: translate 600ms var(--ease-standard);
}
.leaf-art {
  animation: leaf-drift 26s ease-in-out infinite alternate;
}
.leaf img {
  width: 100%;
  height: auto;
  max-width: none;
}
.leaf-sharp {
  animation: leaf-breathe 22s ease-in-out infinite alternate;
}
.leaf-soft {
  opacity: 0.33;
  filter: blur(10px);
  mix-blend-mode: multiply;
}
@keyframes leaf-drift {
  from {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  to {
    transform: translate(-12px, 9px) rotate(0.6deg) scale(1.02);
  }
}
@keyframes leaf-breathe {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.55;
  }
}
</style>
