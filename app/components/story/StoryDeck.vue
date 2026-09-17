<!-- app/components/story/StoryDeck.vue — 首屏＋七頁故事＋一本書的容器。「走到哪一頁」統一記在 --dp（JS 只寫這個 var），
     差別在版面與「誰驅動 --dp」：
     1. 桌機（lg 以上）：面板排成一列、翻頁＝軌道往左平移，用捲動驅動——外層拉高成 N 個視窗高、內層 sticky 一個視窗高，
        往下捲多少、軌道就平移多少。不劫持滾輪，捲軸、鍵盤、觸控板都照原生走；html 加 scroll-snap（proximity）讓停下來時對齊整頁。
        按鈕與方向鍵翻頁時自己驅動捲動（1.1 秒、ease-in-out），從首屏出發時線先長 0.25 秒、頁才開始動，
        線就像把下一頁拉進來。使用者一碰滾輪或觸控就交還控制。按鈕貼在橫線右端，文字沿用車票的語彙：
        出發 → 下一站 → 翻完變成往下的「繼續往下」。
     2. 手機（lg 以下、JS 接管後）：面板直式堆疊、各頁照內容高，往下捲就是翻頁（issue #162，新人 09-16 實測：
        直向閱讀的習慣，橫向手勢與底部頁次軸跟它打架）。原生捲動、**不掛 scroll-snap**：09-17 iPhone 實測 snap 會讓每一下
        滑動都被拉到頁頂停住，真機 svh 664 而頁高 740～770，讀到頁底也被彈回去，感覺「斷斷續續」；翻頁的感覺改由
        逐頁的進場與左右點擊區承擔。各頁也**不撐到一屏**（09-17 稍早曾掛 min-height: 100svh，見樣式段的說明）。
        進度由捲動位置換算：目前在第 k 段、下一段佔了視窗多少比例就是小數部分；手機不寫 --dp／--train-x
        （沒有東西在讀，寫在根元素上反而讓整組面板每一幀重算樣式）。
        點畫面右側 25%＝下一頁、左側 25%＝上一頁（捲到那一頁的頂端），中間不做事——捲動之外的點擊替代（WCAG 2.5.7）。
        書的五個跨頁在手機各自是一頁（照片鋪滿整屏），所以停點數與桌機的進度停點一樣是 1＋7＋5；
        第一跨是進相簿的門（StoryBookOpener）：一個 1.5 屏高的軌道，照片一露面就隨捲動撐開、升到頂端釘住撐滿，停點仍是軌道的頂端。
        翻到最後一跨不再放「繼續往下」：往下捲本來就會接到貓咪區，多一顆按鈕是多餘的提醒（新人 09-17）。
     3. 無 JS：面板直式堆疊、原生捲動，內容全部看得完（不靠 JS 的終態）——手機模式就是這個版面加上進場與點擊區。
     「走到哪一頁」分兩段：下一頁進到 65% 算「到了」（reached），文字與時間軸開始出場，停下前就能讀；
     桌機停穩 120ms 才算「停在這一頁」（settled），拼貼件才一件一件落下——跟翻頁的移動疊在一起就看不出逐件的節奏。
     手機沒有「停穩」這回事（原生捲動、手指不停就不停），走到就算停穩，照片接在文字後面 0.24 秒出來。
     兩者都只增不減，往回翻時線與照片都還在。
     桌機另有一台金線小火車貼在時間軸上：翻頁時軌道往左流、小火車停在畫面上「這一頁要去的那一站」前面，
     看起來就是火車沿著軌道一站一站開過去（首屏在畫面外左側，進書時從右側開出去）。
     七頁之後是一本書（StoryBook）：桌機它是軌道最後一個面板，--dp 超過 --base 之後軌道不再平移（min() 封頂），
     多出來的進度（每一頁一個視窗高）交給書翻頁，所以捲軸、按鈕都能來回刷翻頁。
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
/** 手機點擊翻頁時捲到那一頁的時間（ms）：比桌機的引導動畫快，點了就要到 */
const TAP_MS = 420
/** 手指按下到放開移動不超過這麼多 px 才算「點一下」（超過就是在捲動，交給瀏覽器） */
const TAP_SLOP_PX = 8
/** 點左右兩側這個比例內＝上一頁／下一頁（沿用 Web Stories、Instagram 限時動態的定義），中間 50% 不做事 */
const TAP_ZONE = 0.25
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
/** 手機：已經捲過整組面板（下緣過了視窗中線）。跳過故事／繼續往下是 fixed 的，離開故事區就要收掉 */
const beyond = ref(false)

/** 手機的直向翻頁模式：JS 接管、但寬度不到 lg。無 JS 時兩個模式都不成立，面板一樣直式堆疊、只是沒有 snap 與進場 */
const scrollDeck = computed(() => live.value && !isDeck.value)

/** 書所在的面板序號：首屏 0、七頁故事 1…7、書 8。--dp 到這裡軌道就停，之後的進度給書翻頁 */
const base = computed(() => props.slides.length + 1)
const panelCount = computed(() => base.value + props.spreads.length)
/** 書內進度：0 是第一跨攤開、每加 1 翻一張。手機不翻紙（五跨直式疊），固定 0——
 *  不然捲動的每一幀都會改到 StoryBook 的 inline style，整本書跟著重新渲染 */
const bookProgress = computed(() => (isDeck.value ? Math.min(Math.max(0, props.spreads.length - 1), Math.max(0, progress.value - base.value)) : 0))
/** 手機：走到第 5 頁就把書的照片抓下來（書從第 8 頁開始）。書的照片 1440×2048 起跳，等捲到才抓、才解碼，
 *  進到那一跨的瞬間會頓一下（新人 09-17：「照片區會頓」）；提早三頁抓，翻到時已經解碼好了 */
const warmBook = computed(() => reached.value >= base.value - 3)
const atEnd = computed(() => progress.value >= panelCount.value - 1.01)
const onHero = computed(() => progress.value < 0.5)
const ctaLabel = computed(() => (onHero.value ? props.hero.cta.start : atEnd.value ? props.hero.cta.end : props.hero.cta.next))

/** 書翻到哪一跨（進度四捨五入）；還在首屏或故事頁時是負數，對不到任何一跨 */
const spreadHere = computed(() => Math.round(progress.value) - base.value)
/** 手機第一跨的門開了沒（StoryBookOpener）：門還沒開時框外是紙色，右上角的開關要維持墨色 */
const openerOpen = ref(false)
/** 目前這一跨、指定那一面的照片在這個角落是不是深色（內容層的 darkCorners）；文字面與淺色照片都算淺。
 *  手機（直向疊、照片鋪滿整屏）不分左右面，一律看照片那一面 */
function cornerDark(corner: 'top' | 'bottom', side: 'left' | 'right') {
  const s = props.spreads[spreadHere.value]
  if (!s)
    return false
  if (scrollDeck.value && spreadHere.value === 0 && !openerOpen.value)
    return false
  const page = s.kind === 'bleed' ? s : isDeck.value ? s[side] : s.left.kind === 'photo' ? s.left : s.right
  return page.kind !== 'copy' && (page.darkCorners?.includes(corner) ?? false)
}
/** 右上角的選單開關壓在深色照片上：桌機看右面、手機看鋪滿整屏的那張照片 */
const menuDark = computed(() => cornerDark('top', 'right'))
/** 桌機右下角的「下一站」壓在深色照片上 */
const nextDark = computed(() => isDeck.value && cornerDark('bottom', 'right'))
// 整組面板蓋著右上角時，選單開關的顏色跟著這一跨走（usePublicChrome）
usePublicChrome().watchCorner('story-deck', root, () => menuDark.value)

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
let sizeObserver: ResizeObserver | null = null
/** 手機：每個停點（首屏、七頁、書的每一跨）的頂端在文件裡的 y，與整組面板的下緣 */
let stopTops: number[] = []
let deckBottom = 0

// 點擊狀態：一次只追一根手指（手機的點擊翻頁；捲動本身交給瀏覽器）
let dragId: number | null = null
let dragStartX = 0
let dragStartY = 0
/** 這一下是不是按在按鈕／連結上；是的話點擊歸它，不拿來翻頁 */
let dragOnControl = false

// 量測快取：捲動中讀 getBoundingClientRect 會逐幀觸發 layout
function measure() {
  if (!root.value)
    return
  const rect = root.value.getBoundingClientRect()
  top = rect.top + window.scrollY
  vh = window.innerHeight || 1
  vw = window.innerWidth || 1
  if (isDeck.value)
    return
  // 手機：停點是首屏、七頁、書的每一跨（書的面板本身不算，它的頂端就是第一跨的頂端）
  const stops = root.value.querySelectorAll<HTMLElement>('.track > .panel:not(.book-panel), .book-panel .spread')
  stopTops = Array.from(stops, el => el.getBoundingClientRect().top + window.scrollY)
  deckBottom = rect.bottom + window.scrollY
}

function clampProgress(p: number) {
  return Math.min(panelCount.value - 1, Math.max(0, p))
}

/** 寫入翻頁位置：桌機與手機都由 tick 把捲動換算過來。
 *  --dp／--train-x 只有桌機的軌道與小火車在讀；自訂屬性會繼承，寫在根元素上整組面板的後代都得重算樣式，
 *  手機每一幀都寫等於白白重算幾百個元素（含兩組 SVG 字樣），所以手機不寫。
 *  每寫一次就重新計時，停下 SETTLE_MS 沒再動才記成「停穩」 */
function setProgress(p: number) {
  progress.value = p
  if (isDeck.value) {
    root.value?.style.setProperty('--dp', p.toFixed(4))
    root.value?.style.setProperty('--train-x', trainAt(p).toFixed(4))
  }
  if (p > 0.02)
    started.value = true
  reached.value = Math.max(reached.value, Math.floor(p + REACH))
  // 手機不等「停穩」：原生捲動是連續的，手指不停就永遠不會停穩，拍立得等到停下來時那一頁已經捲過去了
  // （新人 09-17：滑到下一段文字時上一段的照片還沒出現）；走到就算停穩，照片接在文字後面出來（延遲寫在 StorySlide）
  if (!isDeck.value) {
    settled.value = reached.value
    return
  }
  clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => {
    settled.value = Math.max(settled.value, Math.floor(progress.value + REACH))
  }, SETTLE_MS)
}

function tick() {
  frame = 0
  const y = window.scrollY
  if (y > 8)
    started.value = true
  if (!root.value)
    return
  if (isDeck.value) {
    setProgress(clampProgress((y - top) / vh))
    return
  }
  if (!stopTops.length)
    return
  // 手機：目前在第 k 段（頂端已經捲過的最後一段），小數部分＝下一段佔了視窗多少。
  // 用「下一段露出多少」不用「這一段捲了多少」：頁比一屏高時，讀到頁底也不會提早把下一頁的進場放掉
  let k = 0
  while (k < stopTops.length - 1 && y >= stopTops[k + 1]!)
    k++
  const next = stopTops[k + 1]
  const frac = next === undefined ? 0 : Math.min(1, Math.max(0, (y + vh - next) / vh))
  setProgress(clampProgress(k + frac))
  beyond.value = y + vh * 0.5 > deckBottom
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
function panTo(targetY: number, lead = 0, duration = PAN_MS) {
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
    const t = Math.min(1, Math.max(0, (now - origin) / duration))
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

/** 翻到第 index 頁：桌機捲到那一頁的視窗高、手機捲到那一頁的頂端（停點）。都是自己驅動的捲動，tick 再把它換算回 --dp */
function goTo(index: number) {
  const target = clampProgress(index)
  started.value = true
  if (isDeck.value) {
    const fromHero = onHero.value && target === 1
    panTo(top + target * vh, fromHero ? HERO_LEAD_MS : 0)
    return
  }
  const stopTop = stopTops[target]
  if (stopTop !== undefined)
    panTo(stopTop, 0, TAP_MS)
}

function onPointerDown(event: PointerEvent) {
  if (!scrollDeck.value || (event.pointerType === 'mouse' && event.button !== 0))
    return
  cancelPan()
  // 起手點落在按鈕／連結上（首屏圓弧的照片、跳過故事、鑽石）就不當成翻頁的點擊：
  // 否則點右半邊的照片會同時翻出祝福又翻掉整頁
  dragOnControl = !!(event.target as Element | null)?.closest?.('button, a, [role="button"]')
  dragId = event.pointerId
  dragStartX = event.clientX
  dragStartY = event.clientY
}

/** 手機：沒移動的點擊才翻頁——左側＝上一頁、右側＝下一頁，中間留白不做事（閱讀時不會誤觸）。
 *  手指有移動就是在捲動，整個交給瀏覽器；點在按鈕上的那一下歸按鈕自己處理 */
function onPointerUp(event: PointerEvent) {
  if (dragId === null || event.pointerId !== dragId)
    return
  dragId = null
  const dx = event.clientX - dragStartX
  const dy = event.clientY - dragStartY
  if (dragOnControl || Math.abs(dx) >= TAP_SLOP_PX || Math.abs(dy) >= TAP_SLOP_PX)
    return
  const here = Math.round(progress.value)
  if (event.clientX < vw * TAP_ZONE)
    goTo(here - 1)
  else if (event.clientX > vw * (1 - TAP_ZONE))
    goTo(here + 1)
}

function onPointerCancel(event: PointerEvent) {
  if (dragId !== null && event.pointerId === dragId)
    dragId = null
}

/** 跳過故事：不管走到哪一頁，直接接到整組面板之後的段落（三隻貓）。
 *  桌機沿用同一條翻頁動畫；手機捲到整組面板的下緣 */
function skipStory() {
  started.value = true
  if (isDeck.value) {
    panTo(top + panelCount.value * vh)
    return
  }
  panTo(deckBottom, 0, TAP_MS)
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

// 使用者自己動手（滾輪、觸控）就停掉翻頁動畫，把控制還給他
function onUserScroll() {
  if (panFrame)
    cancelPan()
}

function applyMode() {
  isDeck.value = deckQuery?.matches ?? false
  cancelPan()
  measure()
  tick()
}

// 桌機翻頁時讓 html 對齊頁頂（一頁一個視窗高）；自己驅動的動畫進行中先拿掉；離開本頁自動移除。
// 手機不掛（見檔頭 2.）：iOS 的 snap 會把每一下滑動都拉去頁頂停住，捲起來一頓一頓的
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
  // 手指離開軌道範圍也要收得到放開，所以 up／cancel 掛在 window（down 綁在軌道上）
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  // 手機的停點在照片載入、字型換上時會移動：整組面板的高度一變就重量
  if (root.value) {
    sizeObserver = new ResizeObserver(onResize)
    sizeObserver.observe(root.value)
  }
  applyMode()
})

onBeforeUnmount(() => {
  deckQuery?.removeEventListener('change', applyMode)
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('wheel', onUserScroll)
  window.removeEventListener('touchstart', onUserScroll)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  sizeObserver?.disconnect()
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
    :class="{ 'is-deck': isDeck, 'is-scroll-deck': scrollDeck }"
    :style="{ '--n': panelCount, '--base': base }"
  >
    <!-- 翻頁的對齊點：每一頁一個視窗高，html 的 scroll-snap 靠這些對齊（只在桌機模式存在；手機直接對齊每個面板的頂端） -->
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
      <!-- dragstart.prevent：手指按在照片上時，瀏覽器會啟動原生圖片拖曳，點擊翻頁就收不到放開 -->
      <div class="track" @pointerdown="onPointerDown" @dragstart.prevent>
        <StoryHero :hero="hero" :started="started" :live="live" :vertical="scrollDeck" class="panel" />
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
        <!-- 書：最後一個面板。進度從 base 起算，reached 也換算成「走到第幾跨」；手機五跨直式疊、各自一屏 -->
        <StoryBook
          v-if="spreads.length"
          :spreads="spreads"
          :progress="bookProgress"
          :reached="reached - base"
          :live="live"
          :stacked="scrollDeck"
          :warm="warmBook"
          :index="base"
          class="panel"
          @opener-open="openerOpen = $event"
        />
      </div>

      <!-- 跳過故事：左下角，第 1 頁起到最後一頁前都在，點了直接接到三隻貓那段（桌機/手機都有；手機是 fixed，捲出故事區就收）。
           首屏不顯示：還沒出發就先問要不要跳過，會跟「出發」搶同一個決定 -->
      <button
        v-if="live && !onHero && !beyond && reached < panelCount - 1"
        type="button"
        class="skip absolute bottom-6 left-6 z-40 font-serif-tc text-caption tracking-widest text-ink-500 transition-colors duration-250 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
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

/* 手機模式（直向翻頁，issue #162）：面板直式堆疊、原生捲動（不 snap，見檔頭），就是無 JS 的那個版面，
   多的只有進度驅動的進場與左右點擊區。各頁**不撐到一屏**：09-17 稍早曾掛 min-height: 100svh 讓每頁至少一屏，
   那是配 snap 翻頁的；snap 拿掉後這個撐高只剩副作用——內容不到一屏的頁（只有插畫的五口之家、歸零那頁）在插畫下面
   空出一大截才接下一章（新人 09-17 截圖：「中間間隔太遠」）。章與章的間距現在就是這一頁的底距 3rem 加下一頁的上距 5rem
   （都在 StorySlide）；首屏自己是 min-h-svh、書的四跨自己是 100svh（StoryBook），不靠這裡 */
/* 跳過故事：桌機貼在一屏高的 stage 左下；手機的 stage 是整組面板的高度，改釘在視窗左下（捲出故事區由 v-if 收掉）。
   手機墊一枚紙色小章：釘在視窗上的字會壓到照片與拍立得，跟右下角「回到最上方」同一套底 */
.is-scroll-deck .skip {
  position: fixed;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  background: rgb(250 247 241 / 88%);
  box-shadow: 0 0 0 1px var(--color-line);
}

/* 桌機：平移到 --base（書的面板）就封頂：之後的進度不再動軌道，由書自己拿去翻頁 */
.is-deck .track {
  display: flex;
  height: 100%;
  transform: translateX(calc(min(var(--dp, 0), var(--base, 0)) * -100%));
  will-change: transform;
}
.is-deck .track > .panel {
  flex: 0 0 100%;
  height: 100%;
}
.snap {
  top: calc(var(--k, 0) * 100vh);
  height: 100vh;
  scroll-snap-align: start;
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
