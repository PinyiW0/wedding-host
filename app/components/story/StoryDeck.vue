<!-- app/components/story/StoryDeck.vue — 首屏＋七頁故事的容器。面板永遠排成一列，翻頁＝軌道往左平移
     （JS 只寫 --dp 這個 var，CSS 消費），差別在「誰驅動 --dp」：
     1. 桌機（lg 以上）用捲動：外層拉高成 N 個視窗高、內層 sticky 一個視窗高，往下捲多少、軌道就平移多少。
        不劫持滾輪，捲軸、鍵盤、觸控板都照原生走；html 加 scroll-snap（proximity）讓停下來時對齊整頁。
        按鈕與方向鍵翻頁時自己驅動捲動（1.8 秒、ease-in-out），從首屏出發時線先長 0.45 秒、頁才開始動，
        線就像把下一頁拉進來。使用者一碰滾輪或觸控就交還控制。按鈕貼在橫線右端，文字沿用車票的語彙：
        出發 → 下一站 → 翻完變成往下的「繼續往下」。
     2. 手機（lg 以下、JS 接管後）用手勢：整組面板固定一個視窗高。往左滑＝下一頁、往右滑＝上一頁
        （內容跟著手指走，與相簿、限時動態同一個方向）；點畫面右側 25%＝下一頁、左側 25%＝上一頁，中間不做事。
        底部另有頁次軸，走到哪一頁看得見、也能直接點著跳（拖曳一定要有點擊替代，WCAG 2.5.7）。
        頁次軸上七頁故事各一顆愛心、書收成一個標記；「左右翻頁，上下閱讀」只在前兩頁提示，之後就不再佔一層。
        放手後自己滑到定位（0.42 秒）；拖不到門檻就彈回原頁。判斷手勢方向：先看前 8px 是橫的還是直的，
        直的就整個交還原生捲動（每頁內容比一屏長時可以在頁內上下捲）；從螢幕左右緣 24px 內起手的橫向手勢不接管，
        那是 iOS Safari 的上下頁手勢。
     3. 無 JS：面板直式堆疊、原生捲動，內容全部看得完（不靠 JS 的終態）。
     「走到哪一頁」都看 --dp，分兩段：下一頁進到 65% 算「到了」（reached），文字與時間軸開始出場，停下前就能讀；
     軌道停穩 120ms 才算「停在這一頁」（settled），拼貼件才一件一件落下——跟翻頁的平移疊在一起就看不出逐件的節奏。
     兩者都只增不減，往回翻時線與照片都還在。
     桌機另有一台金線小火車貼在時間軸上：翻頁時軌道往左流、小火車停在畫面上「這一頁要去的那一站」前面，
     看起來就是火車沿著軌道一站一站開過去（首屏在畫面外左側，進書時從右側開出去）。
     七頁之後是一本書（StoryBook）：它是軌道最後一個面板，--dp 超過 --base 之後軌道不再平移（min() 封頂），
     多出來的進度（每一頁一個視窗高／一次手勢）交給書翻頁，所以捲軸、按鈕、手指拖都能來回刷翻頁。
     左下角另有「跳過故事」，從第 1 頁起到最後一頁前都在（首屏只留「出發」一個動作），點了直接跳到三隻貓那段，不用一頁一頁翻。 -->
<script setup lang="ts">
import type { StoryHeroContent, StorySlide, StorySpread } from '~/types/story'

const props = defineProps<{
  hero: StoryHeroContent
  slides: StorySlide[]
  /** 七頁之後的書：每個跨頁佔一頁進度，翻完才是整組面板的結尾 */
  spreads: StorySpread[]
}>()

/** 與 Tailwind 的 lg 同值：面板的桌機版面（橫線、拼貼）也是在這個寬度切 */
const DECK_QUERY = '(min-width: 64rem)'
/** 翻一頁的時間（ms）：線先長、頁再跟上，「慢慢」是新人要的 */
const PAN_MS = 1100
/** 從首屏出發時，線先長這麼久、頁才開始動 */
const HERO_LEAD_MS = 250
/** 手機放開手指後滑到定位的時間（ms）：手勢要跟得上手，比桌機的引導動畫快 */
const SWIPE_MS = 420
/** 手勢要判定成「換頁」的門檻：拖過螢幕寬的兩成二，或甩得夠快（px/ms） */
const SWIPE_RATIO = 0.22
const SWIPE_VELOCITY = 0.5
/** 判斷手勢是橫是直之前，先讓手指走這麼多 px */
const AXIS_LOCK_PX = 8
/** 點左右兩側這個比例內＝上一頁／下一頁（沿用 Web Stories、Instagram 限時動態的定義），中間 50% 不做事 */
const TAP_ZONE = 0.25
/** 螢幕左右緣這麼多 px 內起手的橫向手勢不接管：那是 iOS Safari 的上一頁／下一頁手勢 */
const EDGE_GUARD_PX = 24
/** 下一頁進入 65% 時開始顯示內容，切頁停下前文字就能讀。 */
const REACH = 0.35
/** 軌道停下這麼久（ms）才算停穩，拼貼件開始逐件落下 */
const SETTLE_MS = 120

const root = ref<HTMLElement | null>(null)
const live = ref(false)
const isDeck = ref(false)
const started = ref(false)
const reached = ref(0)
const settled = ref(0)
const progress = ref(0)
const animating = ref(false)

/** 手機的翻頁模式：JS 接管、但寬度不到 lg。無 JS 時兩個模式都不成立，面板直式堆疊 */
const mobileDeck = computed(() => live.value && !isDeck.value)

/** 書所在的面板序號：首屏 0、七頁故事 1…7、書 8。--dp 到這裡軌道就停，之後的進度給書翻頁 */
const base = computed(() => props.slides.length + 1)
const panelCount = computed(() => base.value + props.spreads.length)
/** 書內進度：0 是第一跨攤開、每加 1 翻一張 */
const bookProgress = computed(() => Math.min(Math.max(0, props.spreads.length - 1), Math.max(0, progress.value - base.value)))
/** 頁次軸的標記：首屏是起點的小圓點、七頁故事各一顆愛心，書收成一個標記（五個跨頁各佔一顆的話，底部會擠成一排點）。
 *  at 是這個標記對應的進度，也是點下去要去的地方 */
const pagerMarks = computed(() => [
  { key: 'hero', label: '首屏', at: 0 },
  ...props.slides.map((slide, i) => ({ key: slide.key, label: `第 ${i + 1} 頁：${slide.title}`, at: i + 1 })),
  ...(props.spreads.length ? [{ key: 'book', label: `第 ${base.value} 頁起：${props.spreads[0]!.title}`, at: base.value }] : []),
])
/** 頁次軸最右端的標記對應的進度（書的第一跨；沒有書就是最後一頁） */
const pagerEnd = computed(() => pagerMarks.value.at(-1)!.at)
const atEnd = computed(() => progress.value >= panelCount.value - 1.01)
const onHero = computed(() => progress.value < 0.5)
const ctaLabel = computed(() => (onHero.value ? props.hero.cta.start : atEnd.value ? props.hero.cta.end : props.hero.cta.next))

/** 書翻到哪一跨（進度四捨五入）；還在首屏或故事頁時是負數，對不到任何一跨 */
const spreadHere = computed(() => Math.round(progress.value) - base.value)
/** 目前這一跨、指定那一面的照片在這個角落是不是深色（內容層的 darkCorners）；文字面與淺色照片都算淺 */
function cornerDark(corner: 'top' | 'bottom', side: 'left' | 'right') {
  const s = props.spreads[spreadHere.value]
  if (!s)
    return false
  const page = s.kind === 'bleed' ? s : s[side]
  return page.kind !== 'copy' && (page.darkCorners?.includes(corner) ?? false)
}
/** 右上角的選單開關壓在深色照片上：桌機看右面、手機看疊在上面的左面 */
const menuDark = computed(() => cornerDark('top', isDeck.value ? 'right' : 'left'))
/** 桌機右下角的「下一站」壓在深色照片上 */
const nextDark = computed(() => isDeck.value && cornerDark('bottom', 'right'))
// 整組面板蓋著右上角時，選單開關的顏色跟著這一跨走（usePublicChrome）
usePublicChrome().watchCorner('story-deck', root, () => menuDark.value)
/** 頁次軸上「目前在哪一顆」：書裡的每一跨都算書那一顆 */
const pagerHere = computed(() => Math.min(pagerEnd.value, Math.round(progress.value)))
/** 「左右翻頁，上下閱讀」只在前兩頁提示：學會了就不必一直佔著底部一層 */
const showSwipeHint = computed(() => pagerHere.value >= 1 && pagerHere.value <= 2)

/** 金線小火車在每一頁要停的位置（面板寬的比例）：兩地那頁停在目的地的愛心前、片刻頁停在中間那顆前、
 *  歸零頁停在左邊那顆愛心出發的地方（35%）前，不擋兩顆愛心往中間走。首屏與書各放在畫面外左、右側 */
const trainStops = computed(() => [
  -0.1,
  ...props.slides.map(slide => (slide.marker?.kind === 'span' ? 0.65 : slide.marker?.kind === 'zero' ? 0.35 : 0.5)),
  1.15,
])

/** 進度 p 時小火車在畫面上的位置：相鄰兩站之間照翻頁的比例內插。
 *  軌道本身一次平移一整個面板寬，小火車只在兩站之間挪一小段，所以看起來是它沿著線往前開 */
function trainAt(p: number) {
  const stops = trainStops.value
  const k = Math.min(stops.length - 1, Math.floor(p))
  const from = stops[k] ?? 0
  const to = stops[k + 1] ?? from
  return from + (to - from) * (p - k)
}

/** 每一頁「上一個標記的公里數」：這一頁的數字從這裡走到自己的公里數。
 *  歸零頁例外：不是接著上一段（65），是從故事裡出現過最遠的一段（201）縮小到 0，
 *  才看得出「這一路走來，最遠的距離也歸零了」。 */
const prevKms = computed(() => {
  let last = 0
  let max = 0
  return props.slides.map((slide) => {
    const prev = slide.marker?.kind === 'zero' ? max : last
    if (slide.marker?.kind === 'span') {
      last = slide.marker.km
      max = Math.max(max, slide.marker.km)
    }
    else if (slide.marker?.kind === 'zero') {
      last = 0
    }
    return prev
  })
})

let top = 0
let vh = 1
let vw = 1
let frame = 0
let panFrame = 0
let settleTimer = 0
let deckQuery: MediaQueryList | null = null

// 手勢狀態：一次只追一根手指
let dragId: number | null = null
let dragStartX = 0
let dragStartY = 0
let dragStartProgress = 0
let dragAxis: 'x' | 'y' | null = null
let dragLastX = 0
let dragLastT = 0
let dragVelocity = 0
/** 這一下是不是按在按鈕／連結上；是的話點擊歸它，不拿來翻頁 */
let dragOnControl = false

// 量測快取：捲動中讀 getBoundingClientRect 會逐幀觸發 layout
function measure() {
  if (!root.value)
    return
  top = root.value.getBoundingClientRect().top + window.scrollY
  vh = window.innerHeight || 1
  vw = window.innerWidth || 1
}

function clampProgress(p: number) {
  return Math.min(panelCount.value - 1, Math.max(0, p))
}

/** 寫入翻頁位置：手機由手勢與 settleTo 直接呼叫，桌機由 tick 把捲動換算過來。
 *  每寫一次就重新計時，停下 SETTLE_MS 沒再動才記成「停穩」 */
function setProgress(p: number) {
  progress.value = p
  root.value?.style.setProperty('--dp', p.toFixed(4))
  root.value?.style.setProperty('--train-x', trainAt(p).toFixed(4))
  if (p > 0.02)
    started.value = true
  reached.value = Math.max(reached.value, Math.floor(p + REACH))
  clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => {
    settled.value = Math.max(settled.value, Math.floor(progress.value + REACH))
  }, SETTLE_MS)
}

function tick() {
  frame = 0
  if (window.scrollY > 8)
    started.value = true
  if (!isDeck.value || !root.value)
    return
  const raw = (window.scrollY - top) / vh
  setProgress(Math.min(panelCount.value - 1, Math.max(0, raw)))
}

function schedule() {
  if (!frame)
    frame = requestAnimationFrame(tick)
}

function onResize() {
  measure()
  schedule()
}

function cancelPan() {
  if (panFrame) {
    cancelAnimationFrame(panFrame)
    panFrame = 0
  }
  animating.value = false
}

/** 自己驅動的翻頁捲動：每幀 scrollTo，捲動事件照常觸發 tick；動畫中先拿掉 snap 免得互搶 */
function panTo(targetY: number, lead = 0) {
  cancelPan()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, targetY)
    return
  }
  animating.value = true
  const startY = window.scrollY
  const distance = targetY - startY
  let origin: number | null = null
  function step(now: number) {
    if (origin === null)
      origin = now + lead
    const t = Math.min(1, Math.max(0, (now - origin) / PAN_MS))
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    window.scrollTo(0, startY + distance * eased)
    if (t < 1) {
      panFrame = requestAnimationFrame(step)
    }
    else {
      panFrame = 0
      animating.value = false
    }
  }
  panFrame = requestAnimationFrame(step)
}

function goTo(index: number) {
  const target = clampProgress(index)
  const fromHero = onHero.value && target === 1
  started.value = true
  panTo(top + target * vh, fromHero ? HERO_LEAD_MS : 0)
}

/** 手機：放開手指後自己滑到某一頁（桌機是捲動，這裡只動 --dp） */
function settleTo(index: number) {
  cancelPan()
  const target = clampProgress(index)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setProgress(target)
    return
  }
  animating.value = true
  const from = progress.value
  const distance = target - from
  let origin: number | null = null
  function step(now: number) {
    if (origin === null)
      origin = now
    const t = Math.min(1, Math.max(0, (now - origin) / SWIPE_MS))
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    setProgress(from + distance * eased)
    if (t < 1) {
      panFrame = requestAnimationFrame(step)
    }
    else {
      panFrame = 0
      animating.value = false
    }
  }
  panFrame = requestAnimationFrame(step)
}

function onPointerDown(event: PointerEvent) {
  if (!mobileDeck.value || (event.pointerType === 'mouse' && event.button !== 0))
    return
  cancelPan()
  // 起手點落在按鈕／連結上（首屏圓弧的照片、跳過故事、頁次軸）就不當成翻頁的點擊：
  // 否則點右半邊的照片會同時翻出祝福又翻掉整頁。拖曳不受影響，從照片上滑走照樣翻頁
  dragOnControl = !!(event.target as Element | null)?.closest?.('button, a, [role="button"]')
  dragId = event.pointerId
  dragAxis = null
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartProgress = progress.value
  dragLastX = event.clientX
  dragLastT = event.timeStamp
  dragVelocity = 0
}

function onPointerMove(event: PointerEvent) {
  if (dragId === null || event.pointerId !== dragId)
    return
  const dx = event.clientX - dragStartX
  const dy = event.clientY - dragStartY
  if (dragAxis === null) {
    if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX)
      return
    // 直的手勢整個交還原生捲動：頁內容比一屏長時要能上下捲、也要能捲出整組面板
    if (Math.abs(dy) >= Math.abs(dx)) {
      dragId = null
      return
    }
    // 從螢幕左右緣起手的橫向手勢是 iOS Safari 的上下頁，不跟它搶——硬擋要沒收使用者的瀏覽器返回
    if (dragStartX < EDGE_GUARD_PX || dragStartX > vw - EDGE_GUARD_PX) {
      dragId = null
      return
    }
    dragAxis = 'x'
    started.value = true
  }
  event.preventDefault()
  const dt = event.timeStamp - dragLastT
  if (dt > 0)
    dragVelocity = (event.clientX - dragLastX) / dt
  dragLastX = event.clientX
  dragLastT = event.timeStamp
  // 內容跟著手指走：往左拉，下一頁從右邊進來（與相簿、限時動態同一個方向）
  setProgress(clampProgress(dragStartProgress - dx / vw))
}

function onPointerUp(event: PointerEvent) {
  if (dragId === null || event.pointerId !== dragId)
    return
  const dx = event.clientX - dragStartX
  const dy = event.clientY - dragStartY
  const swiped = dragAxis === 'x'
  dragId = null
  dragAxis = null

  if (swiped) {
    // 甩得夠快就換一頁，否則看拖到哪一頁比較近。往左甩（速度為負）是下一頁
    const flick = Math.abs(dragVelocity) > SWIPE_VELOCITY
    const far = Math.abs(dx) / vw > SWIPE_RATIO
    if (flick)
      settleTo(Math.round(dragStartProgress) + (dragVelocity < 0 ? 1 : -1))
    else
      settleTo(far ? Math.round(progress.value) : Math.round(dragStartProgress))
    return
  }
  // 沒滑動的點擊：左側＝上一頁、右側＝下一頁，中間留白不做事（閱讀時不會誤觸）。
  // 點在按鈕上的那一下歸按鈕自己處理，不翻頁
  const tapped = !dragOnControl && Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX
  if (tapped && event.clientX < vw * TAP_ZONE) {
    settleTo(Math.round(dragStartProgress) - 1)
    return
  }
  if (tapped && event.clientX > vw * (1 - TAP_ZONE)) {
    settleTo(Math.round(dragStartProgress) + 1)
    return
  }
  // 手指按下時會停掉還在跑的滑動動畫，這裡把沒走完的那段補回最近的一頁，不卡在兩頁之間
  if (progress.value % 1 !== 0)
    settleTo(Math.round(progress.value))
}

function onPointerCancel(event: PointerEvent) {
  if (dragId === null || event.pointerId !== dragId)
    return
  const swiped = dragAxis === 'x'
  dragId = null
  dragAxis = null
  if (swiped)
    settleTo(Math.round(progress.value))
}

/** 跳過故事：不管走到哪一頁，直接接到整組面板之後的段落（三隻貓）。
 *  桌機沿用同一條翻頁動畫；手機沒有 --dp 可以算，量面板本身的下緣去捲。 */
function skipStory() {
  started.value = true
  if (isDeck.value) {
    panTo(top + panelCount.value * vh)
    return
  }
  if (!root.value)
    return
  const bottom = root.value.getBoundingClientRect().bottom + window.scrollY
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: bottom, behavior: reduce ? 'auto' : 'smooth' })
}

function onNext() {
  if (atEnd.value) {
    skipStory()
    return
  }
  goTo(Math.round(progress.value) + 1)
}

function onKey(event: KeyboardEvent) {
  if (!isDeck.value || !root.value)
    return
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')
    return
  // 只有整組面板佔著視窗時才接管左右鍵；捲過之後還給頁面
  const rect = root.value.getBoundingClientRect()
  if (rect.top > 1 || rect.bottom < vh - 1)
    return
  event.preventDefault()
  goTo(Math.round(progress.value) + (event.key === 'ArrowRight' ? 1 : -1))
}

// 桌機：使用者自己動手（滾輪、觸控）就停掉翻頁動畫，把控制還給他。
// 手機的滑動動畫不在這裡停——手指按下時 onPointerDown 已經停過了
function onUserScroll() {
  if (isDeck.value && panFrame)
    cancelPan()
}

function applyMode() {
  isDeck.value = deckQuery?.matches ?? false
  cancelPan()
  measure()
  if (isDeck.value) {
    tick()
    return
  }
  // 手機：--dp 由手勢與 settleTo 直接寫，換模式時先對齊到最近的一頁
  setProgress(clampProgress(Math.round(progress.value)))
}

// 桌機翻頁時讓 html 對齊整頁（自己驅動的動畫進行中先拿掉）；離開本頁自動移除
useHead({
  style: [{ innerHTML: 'html.story-deck-snap{scroll-snap-type:y proximity}' }],
  htmlAttrs: { class: computed(() => (isDeck.value && !animating.value ? 'story-deck-snap' : '')) },
})

onMounted(() => {
  live.value = true
  deckQuery = window.matchMedia(DECK_QUERY)
  deckQuery.addEventListener('change', applyMode)
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('wheel', onUserScroll, { passive: true })
  window.addEventListener('touchstart', onUserScroll, { passive: true })
  window.addEventListener('keydown', onKey)
  // 手指離開軌道範圍也要收得到後續事件，所以 move／up 掛在 window（down 綁在軌道上）
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  applyMode()
})

onBeforeUnmount(() => {
  deckQuery?.removeEventListener('change', applyMode)
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('wheel', onUserScroll)
  window.removeEventListener('touchstart', onUserScroll)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  cancelPan()
  clearTimeout(settleTimer)
  if (frame)
    cancelAnimationFrame(frame)
})
</script>

<template>
  <div
    ref="root"
    class="deck relative bg-paper"
    :class="{ 'is-deck': isDeck, 'is-swipe-deck': mobileDeck }"
    :style="{ '--n': panelCount, '--base': base }"
  >
    <!-- 翻頁的對齊點：每一頁一個視窗高，html 的 scroll-snap 靠這些對齊（只在桌機模式存在） -->
    <template v-if="isDeck">
      <span
        v-for="k in panelCount"
        :key="k"
        class="snap pointer-events-none absolute left-0 w-px"
        :style="{ '--k': k - 1 }"
        aria-hidden="true"
      />
    </template>

    <div class="stage">
      <!-- dragstart.prevent：手指／滑鼠滑過照片時，瀏覽器會啟動原生圖片拖曳並中斷手勢，翻頁就翻不動 -->
      <div class="track" @pointerdown="onPointerDown" @dragstart.prevent>
        <StoryHero :hero="hero" :started="started" :live="live" class="panel" />
        <StorySlide
          v-for="(slide, i) in slides"
          :key="slide.key"
          :slide="slide"
          :index="i + 1"
          :drawn="reached >= i + 1"
          :settled="settled >= i + 1"
          :live="live"
          :prev-km="prevKms[i] ?? 0"
          class="panel"
        />
        <!-- 書：最後一個面板。進度從 base 起算，reached 也換算成「走到第幾跨」 -->
        <StoryBook
          v-if="spreads.length"
          :spreads="spreads"
          :progress="bookProgress"
          :reached="reached - base"
          :live="live"
          :index="base"
          class="panel"
        />
      </div>

      <!-- 底部淡出：頁次軸、跳過故事與音樂碟疊在照片上時，先讓內容淡進紙色，字才讀得清楚。
           放在軌道之後、頁次軸之前，疊放順序就是 DOM 順序 -->
      <span v-if="mobileDeck" class="scrim pointer-events-none absolute inset-x-0 bottom-0" aria-hidden="true" />

      <!-- 手機的頁次軸：走到哪一頁看得見，也是「不用滑動就能翻頁」的操作（WCAG 2.5.7 的點擊替代）。
           視覺點很小，命中範圍靠 padding 撐到 24px 以上 -->
      <nav v-if="mobileDeck" class="pager absolute" :style="{ '--pager-end': pagerEnd }" aria-label="故事頁次">
        <span v-if="showSwipeHint" class="absolute bottom-full left-0 mb-2 text-caption tracking-wider text-ink-500">
          左右翻頁，上下閱讀
        </span>
        <span class="pager-track absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden="true" />
        <span class="pager-fill absolute inset-x-0 top-1/2 h-px origin-left bg-gold" aria-hidden="true" />
        <button
          v-for="mark in pagerMarks"
          :key="mark.key"
          type="button"
          class="pager-dot absolute top-1/2 flex size-6 items-center justify-center"
          :class="{ 'is-past': reached >= mark.at, 'is-here': pagerHere === mark.at }"
          :style="{ '--k': mark.at }"
          :aria-label="mark.label"
          :aria-current="pagerHere === mark.at ? 'true' : undefined"
          @click="settleTo(mark.at)"
        >
          <span v-if="mark.key === 'hero'" class="block size-1.5 rounded-full bg-current" />
          <!-- 書：一本攤開的小書，與愛心同一個大小、同一套顏色規則 -->
          <svg v-else-if="mark.key === 'book'" viewBox="0 0 16 16" class="size-3.5" aria-hidden="true">
            <path fill="currentColor" d="M1 3.2c2.4-.9 4.8-.7 6.5.6v10c-1.7-1.2-4.1-1.4-6.5-.6zm14 0c-2.4-.9-4.8-.7-6.5.6v10c1.7-1.2 4.1-1.4 6.5-.6z" />
          </svg>
          <StoryHeart v-else class="size-3" />
        </button>
      </nav>

      <!-- 跳過故事：左下角，第 1 頁起到最後一頁前都在，點了直接接到三隻貓那段（桌機/手機都有）。
           首屏不顯示：還沒出發就先問要不要跳過，會跟「出發」搶同一個決定 -->
      <button
        v-if="live && !onHero && reached < panelCount - 1"
        type="button"
        class="skip absolute bottom-6 left-6 z-40 font-serif-tc text-caption tracking-widest text-ink-300 transition-colors duration-250 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
        @click="skipStory"
      >
        跳過故事
      </button>

      <!-- 金線小火車：桌機才有，輪子壓在時間軸上緣。位置由 --train-x 決定（JS 跟著翻頁進度寫），不做持續動畫。
           車身填紙色，軌道線不會從車廂中間穿過去 -->
      <div v-if="isDeck" class="train-lane pointer-events-none absolute inset-x-0 h-8" aria-hidden="true">
        <svg class="train absolute bottom-0 left-0 h-8 w-22 text-gold-deep" viewBox="0 0 88 32" fill="none">
          <g stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round">
            <!-- 車廂（在後面，火車往右開） -->
            <rect x="1.5" y="9.5" width="33" height="16" rx="2" class="fill-paper" />
            <rect x="6" y="13.5" width="6" height="5" rx=".5" />
            <rect x="15" y="13.5" width="6" height="5" rx=".5" />
            <rect x="24" y="13.5" width="6" height="5" rx=".5" />
            <path d="M34.5 21.5h5" />
            <!-- 車頭：駕駛室、鍋爐、煙囪 -->
            <path d="M39.5 25.5v-19h15v19z" class="fill-paper" />
            <path d="M37.5 6.5h19" />
            <rect x="43" y="10" width="8" height="6" rx=".5" />
            <path d="M54.5 12.5h21a6.5 6.5 0 0 1 0 13h-21z" class="fill-paper" />
            <path d="M66.5 12.5v-6h5v6" class="fill-paper" />
            <path d="M65.5 6.5h7" />
            <circle cx="75" cy="3" r="1.6" />
            <circle cx="80.5" cy="1.8" r="1.1" />
            <!-- 輪子：下緣剛好是 viewBox 底，貼著軌道 -->
            <circle cx="9" cy="28" r="3.25" class="fill-paper" />
            <circle cx="27" cy="28" r="3.25" class="fill-paper" />
            <circle cx="47" cy="28" r="3.25" class="fill-paper" />
            <circle cx="62" cy="28" r="3.25" class="fill-paper" />
            <circle cx="75" cy="28" r="3.25" class="fill-paper" />
          </g>
        </svg>
      </div>

      <!-- 手機翻完書：左下角換成「繼續往下」（桌機是右下那顆箭頭轉成向下），點了接到三隻貓那段。
           手機沒有翻頁按鈕，翻到最後一跨若沒有這個提示，賓客不知道底下還有流程與地點 -->
      <button
        v-if="mobileDeck && atEnd"
        type="button"
        class="skip absolute bottom-6 left-6 z-40 inline-flex items-center gap-1.5 font-serif-tc text-caption tracking-widest text-ink-500 transition-colors duration-250 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
        @click="skipStory"
      >
        {{ hero.cta.end }}
        <svg viewBox="0 0 24 24" class="size-4 text-gold-deep" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-6-6 6 6 6-6" />
        </svg>
      </button>

      <!-- 翻頁按鈕：貼在橫線右端（線從畫面出去的地方），桌機才有。還沒出發時外圈隨首屏的訊號一起擴散。
           標籤壓在深色照片上（書的第一、二跨右下角）時換紙白，圓鈕本身金底紙白箭頭不用換 -->
      <div v-if="isDeck" class="cta absolute" :class="{ 'is-idle': !started }">
        <span class="cta-label absolute bottom-full left-1/2 mb-3 whitespace-nowrap font-serif-tc text-caption tracking-widest transition-colors duration-250" :class="nextDark ? 'text-paper' : 'text-gold-deep'">{{ ctaLabel }}</span>
        <button
          type="button"
          class="next relative inline-flex size-12 items-center justify-center rounded-full bg-gold text-paper transition-colors duration-250 hover:bg-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
          :aria-label="ctaLabel"
          @click="onNext"
        >
          <svg viewBox="0 0 24 24" class="size-5 transition-transform duration-250" :class="atEnd ? 'rotate-90' : ''" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 時間軸的高度：首屏的愛心與各頁的橫線都離面板底這麼多，接起來才是同一條線。
   22% 是原本的設計高度，再往下 40px（新人 09-04 裁示）：首屏的圓心停在 22%，
   圓周最外側那兩張照片就落在同一條高度上，線會從照片上穿過去。整條線一起下移才不會斷開，
   首屏的圓不跟著走（見 StoryHero 的 --ring-cy）*/
.deck {
  --rail-y: calc(22% - 40px);
}

/* 桌機模式：外層 N 個視窗高、內層 sticky 一個視窗高、軌道照 --dp 往左平移（百分比是軌道自己的寬＝一個面板寬） */
.is-deck {
  height: calc(var(--n, 1) * 100vh);
}
.is-deck .stage {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
}

/* 手機模式：翻頁不靠捲動，整組面板就是一個視窗高的框，--dp 由手勢寫。
   用 svh 不用 dvh：dvh 會隨行動瀏覽器的工具列收合改變，整屏面板會跟著抖一下 */
.is-swipe-deck {
  height: 100svh;
  overflow: hidden;
}
.is-swipe-deck .stage {
  height: 100%;
  overflow: hidden;
}
/* touch-action: pan-y——直向捲動交給瀏覽器原生處理（頁內容比一屏長時要捲得動），
   橫向留給 pointer 事件自己判讀，瀏覽器不要插手。
   user-select: none——手勢判斷出方向前的那幾 px 會把內文選起來，翻完一頁整段變反白 */
.is-swipe-deck .track {
  touch-action: pan-y;
  user-select: none;
}
/* 每一頁自己是一個捲動區：內容比一屏長時在頁內上下捲，不會影響左右翻頁。
   不設 overscroll-behavior：捲到頁底後要能接著把整個頁面往下捲出故事區，不然使用者會被困在故事裡 */
.is-swipe-deck .track > .panel {
  overflow-y: auto;
}
/* 書的面板例外：overflow-y: auto 會連帶 overflow-x: auto，紙翻到一半的透視投影會撐出橫向捲動；書本來就是一屏，不需要頁內捲 */
.is-swipe-deck .track > .panel.book-panel {
  overflow: hidden;
}
/* 各頁底部留白，讓內容捲到底時停在頁次軸上方（首屏本來就有 pb-44，不必再加）。
   7rem＝頁次軸離底 5.5rem 加上它自己的 1.5rem，內容的下緣正好停在頁次軸的上緣 */
.is-swipe-deck .track > .panel:not([data-panel="0"]) {
  padding-bottom: 7rem;
}
/* 故事內文的捲動區停在頁次上方，矮螢幕也能把照片完整捲出來。 */
.is-swipe-deck .track > .panel:not([data-panel="0"]):not(.book-panel) {
  height: calc(100% - 8rem);
  padding-bottom: 1rem;
}
.scrim {
  height: 9rem;
  background: linear-gradient(to top, var(--color-paper) 38%, transparent);
}

/* 平移到 --base（書的面板）就封頂：之後的進度不再動軌道，由書自己拿去翻頁 */
.is-deck .track,
.is-swipe-deck .track {
  display: flex;
  height: 100%;
  transform: translateX(calc(min(var(--dp, 0), var(--base, 0)) * -100%));
  will-change: transform;
}
.is-deck .track > .panel,
.is-swipe-deck .track > .panel {
  flex: 0 0 100%;
  height: 100%;
}
.snap {
  top: calc(var(--k, 0) * 100vh);
  height: 100vh;
  scroll-snap-align: start;
}

/* ── 手機的頁次軸 ──（class 不叫 rail：各頁面板自己的直線已經用掉那個名字）
   離底 4.5rem，避開左下的「跳過故事」與右下的音樂碟。
   金線的長度直接吃 --dp（0 到 N−1），不必再寫 JS；標記平均分佈在同一條線上。
   左緣退到 4rem（＝各頁的 px-6 加 pl-10，正文的起點）：各頁那條直線在 1.5rem，
   頁次軸從 1.5rem 起就會與直線交叉成十字。退到正文起點後兩條線不相交，直線一路往下、自己淡進紙色收尾。 */
.pager {
  left: 4rem;
  right: 1.5rem;
  bottom: 5.5rem;
  height: 1.5rem;
}
.pager-track,
.pager-fill {
  translate: 0 -50%;
}
/* 書收成最右端一個標記：翻進書之後金線就停在那裡，不再往外長 */
.pager-fill {
  transform: scaleX(calc(min(var(--dp, 0), var(--pager-end)) / var(--pager-end)));
}
.pager-dot {
  left: calc(var(--k, 0) / var(--pager-end) * 100%);
  translate: -50% -50%;
  color: var(--color-line);
  transition:
    color 0.4s var(--ease-standard),
    scale 0.3s var(--ease-standard);
}
/* 走過的填金，目前這一頁再放大一點——一眼看得出走到第幾頁 */
.pager-dot.is-past {
  color: var(--color-gold);
}
.pager-dot.is-here {
  color: var(--color-gold-deep);
  scale: 1.35;
}
.pager-dot:focus-visible {
  outline: 2px solid var(--color-gold-deep);
  outline-offset: 2px;
  border-radius: 9999px;
}

/* 小火車：輪子下緣壓在時間軸的上緣（線高 3px）；右緣停在站前 1.5rem，不碰到那一站的愛心。
   車道與面板同寬、設成尺寸容器，100cqw 就是面板寬（100vw 會多算捲軸，站的位置會偏）。
   只動 translate，捲動時不觸發 layout */
.train-lane {
  bottom: calc(var(--rail-y) + 3px);
  container-type: inline-size;
}
.train {
  translate: calc(var(--train-x, -0.1) * 100cqw - 100% - 1.5rem) 0;
}

/* 按鈕中心對在橫線上：離右 2rem，底 = 線的中心 − 按鈕半高 */
.cta {
  right: 2rem;
  bottom: calc(var(--rail-y) + 1.5px - 1.5rem);
}
.cta-label {
  translate: -50% 0;
}
/* 還沒出發：外圈每 2.4 秒擴散一次，與首屏愛心的心跳、訊號同一個節拍 */
.next::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 9999px;
  border: 1px solid var(--color-gold);
  opacity: 0;
}
.is-idle .next::after {
  animation: ring 2.4s var(--ease-standard) infinite;
}
@keyframes ring {
  0% {
    opacity: 0.7;
    transform: scale(0.9);
  }
  35%,
  100% {
    opacity: 0;
    transform: scale(1.7);
  }
}
</style>
