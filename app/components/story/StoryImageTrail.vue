<!-- app/components/story/StoryImageTrail.vue — 結尾那一區冒照片的拖尾（參考 coveomusic.com 的 Discography 那一區）。
     鋪在父層（要 position: relative）的整個範圍上，自己不接事件、聽父層的事件。兩層：
     1. 進場先冒幾張停著（桌機 6 張、手機 4 張）：跟著這一區捲進視窗的行程（useScrollProgress 的 travel），
        每走一小段在插畫兩側預排的位置冒一張、不收回。誰都看得到——原本只有滑鼠掃過才有東西，
        手機（大多數賓客）完全沒有、桌機也沒有任何提示，而且這一區在 1440 寬時插畫兩側各空 500px（2026-09-15 審視）。
        這幾張同時也是提示：「這裡會冒照片」。
     2. 桌機滑鼠掃過再冒（只認 pointerType mouse）：游標每移一段就在游標處貼一張小拍立得，0.45 秒放大、停一下、0.7 秒縮回。
        間距至少是卡片寬的 1.25 倍——原本 80px 一張、卡片 136px 寬，任何速度每張都壓在前一張上（實測快掃 10 張全疊、慢掃 4 張全疊）。
        掃得快：間距拉開、卡片縮小；慢慢移：卡片維持原大、多停一會。位置往垂直方向隨機偏一點，一路掃過去不會排成一直線。
     手機不用手指拖（手指一動瀏覽器就接管成捲動，事件會被取消），改成點一下冒一張當彩蛋。
     全部用 DOM 加 CSS transition、只動 transform；不用任何動畫庫。reduced-motion：進場那幾張直接放好（不動），滑鼠與點擊都不掛。
     照片一律裝飾（aria-hidden、pointer-events none），底下的內容照常可點。 -->
<script setup lang="ts">
const props = defineProps<{
  /** 輪流冒出來的照片，長邊 320px 左右的小圖就夠 */
  images: string[]
}>()

/** 進場先冒出來、停著不走的幾張：位置是這一區寬高的百分比，避開中間的插畫與上下的文字。
 *  前四個在最外側，手機只放這四張（內側兩個在 390 寬會整張躲在裙子後面）；桌機六張都放。
 *  桌機卡片約佔寬 9.4%、高 19%，同一側上下兩張的 y 隔 28 才不會疊到；x 13／87 是手機 390 寬剛好不被左右緣裁掉的位置 */
const REST_SLOTS = [
  { x: 13, y: 32, tilt: -8 },
  { x: 87, y: 30, tilt: 6 },
  { x: 12, y: 60, tilt: 3 },
  { x: 88, y: 58, tilt: -4 },
  { x: 26, y: 53, tilt: 5 },
  { x: 74, y: 55, tilt: -6 },
]
/** 第 i 張在捲動行程走到 REST_FROM + i × REST_EVERY 時冒出來。
 *  這一區是頁尾，行程最多只到 0.55 左右（頁面到底了），所以最後一張要落在那之前（0.05 + 5 × 0.08 = 0.45） */
const REST_FROM = 0.05
const REST_EVERY = 0.08
/** 一口氣捲到底、好幾個門檻同時到時，仍然一張隔 140ms 冒 */
const REST_GAP_MS = 140

/** 游標移動：卡片寬 8.5rem（136px），間距至少 1.25 倍才不會疊到前一張；掃得快再拉開到 300 */
const STEP_MIN_PX = 170
const STEP_MAX_PX = 300
/** 兩張之間至少隔這麼久（ms） */
const GAP_MS = 120
/** 速度的兩端（px/ms）：慢於 0.6 算慢、快於 2.5 算快，中間線性 */
const SLOW = 0.6
const FAST = 2.5
/** 快掃時卡片縮到 0.72；慢移時多停 400ms */
const FAST_SCALE = 0.72
const SLOW_HOLD_MS = 400
/** 掃過的軌跡往垂直方向隨機偏 ±22px */
const JITTER_PX = 22
/** 放大 0.45 秒、停 0.3 秒、縮回 0.7 秒 */
const IN_MS = 450
const HOLD_MS = 300
const OUT_MS = 700
/** 掃出來的同時最多幾張：超過就把最舊的先收掉（進場那幾張不算） */
const MAX_SHOTS = 8
/** 掃出來的卡片隨機傾角的幅度（度） */
const TILT = 14

interface Shot {
  el: HTMLElement
  timer: number
}

interface Placement {
  x: number
  y: number
  /** x／y 的單位：進場那幾張用百分比（換視窗寬也留在插畫兩側），掃出來的用 px（貼在游標處） */
  unit: 'px' | '%'
  tilt: number
  /** 卡片大小的倍率（快掃縮小） */
  size: number
}

const root = useTemplateRef<HTMLElement>('root')
const { register } = useScrollProgress()

let host: HTMLElement | null = null
let reduced = false
let next = 0
const live: Shot[] = []
const resting: HTMLElement[] = []

// 進場那幾張：門檻到了先排隊，一張隔 REST_GAP_MS 出來
let restCount = 0
let restPlaced = 0
let restQueued = 0
let restTimer = 0

// 游標：上一張貼在哪、什麼時候
let lastX = Number.NaN
let lastY = Number.NaN
let lastT = 0
let lastPointerType = ''

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function retire(shot: Shot) {
  window.clearTimeout(shot.timer)
  const el = shot.el
  el.style.transition = `transform ${OUT_MS}ms cubic-bezier(0.64, 0, 0.78, 0)`
  el.style.transform = `${el.dataset.pose} scale(0)`
  window.setTimeout(() => el.remove(), OUT_MS)
}

/** 貼一張卡片：從 0 放大到 1（reduced-motion 直接放好），回傳元素給呼叫端決定要不要收回 */
function place(at: Placement): HTMLElement | null {
  if (!root.value || !props.images.length)
    return null
  const src = props.images[next % props.images.length]!
  next++
  const el = document.createElement('div')
  el.className = 'shot'
  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  img.decoding = 'async'
  el.appendChild(img)
  // 中心對準座標；姿勢（置中＋傾角）記在 dataset，縮回時要接同一個姿勢
  const pose = `translate(-50%, -50%) rotate(${at.tilt.toFixed(1)}deg)`
  el.dataset.pose = pose
  el.style.left = `${at.x}${at.unit}`
  el.style.top = `${at.y}${at.unit}`
  el.style.setProperty('--size', String(at.size))
  root.value.appendChild(el)
  if (reduced) {
    el.style.transform = `${pose} scale(1)`
    return el
  }
  el.style.transform = `${pose} scale(0)`
  el.style.transition = `transform ${IN_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
  // 下一格才放大，瀏覽器才會把 scale(0) 當起點
  requestAnimationFrame(() => {
    el.style.transform = `${pose} scale(1)`
  })
  return el
}

/** 掃出來或點出來的一張：停一下就收回 */
function spawn(at: Placement, holdMs: number) {
  const el = place(at)
  if (!el)
    return
  const shot: Shot = { el, timer: 0 }
  shot.timer = window.setTimeout(() => {
    const i = live.indexOf(shot)
    if (i >= 0)
      live.splice(i, 1)
    retire(shot)
  }, IN_MS + holdMs)
  live.push(shot)
  if (live.length > MAX_SHOTS)
    retire(live.shift()!)
}

/** 進場那幾張：從排隊裡放一張，還有就 140ms 後放下一張 */
function placeRest() {
  restTimer = 0
  if (restPlaced >= restQueued)
    return
  const slot = REST_SLOTS[restPlaced]!
  restPlaced++
  const el = place({ x: slot.x, y: slot.y, unit: '%', tilt: slot.tilt, size: 1 })
  if (el)
    resting.push(el)
  if (restPlaced < restQueued)
    restTimer = window.setTimeout(placeRest, REST_GAP_MS)
}

function onProgress(progress: number) {
  if (restQueued >= restCount)
    return
  // 走到第幾張的門檻了（只增不減：捲回去不收）
  const due = Math.min(restCount, Math.floor((progress - REST_FROM) / REST_EVERY) + 1)
  if (due <= restQueued)
    return
  restQueued = due
  if (!restTimer)
    placeRest()
}

function onMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || !host)
    return
  const rect = host.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const now = event.timeStamp
  if (Number.isNaN(lastX)) {
    lastX = x
    lastY = y
    lastT = now
    return
  }
  const dx = x - lastX
  const dy = y - lastY
  const dist = Math.hypot(dx, dy)
  const dt = Math.max(1, now - lastT)
  // 自上一張以來的平均速度決定這一張的間距、大小與停留：快＝拉開、縮小、停短；慢＝原大、多停
  const speed = clamp01((dist / dt - SLOW) / (FAST - SLOW))
  const step = STEP_MIN_PX + (STEP_MAX_PX - STEP_MIN_PX) * speed
  if (dist < step || dt < GAP_MS)
    return
  lastX = x
  lastY = y
  lastT = now
  // 往行進方向的垂直方向偏一點，掃過去不會排成一直線
  const jitter = (Math.random() - 0.5) * 2 * JITTER_PX
  const tilt = (Math.random() - 0.5) * 2 * TILT
  spawn({
    x: x + (-dy / dist) * jitter,
    y: y + (dx / dist) * jitter,
    unit: 'px',
    tilt,
    size: 1 - (1 - FAST_SCALE) * speed,
  }, HOLD_MS + SLOW_HOLD_MS * (1 - speed))
}

function onLeave() {
  lastX = Number.NaN
  lastY = Number.NaN
}

function onDown(event: PointerEvent) {
  lastPointerType = event.pointerType
}

/** 手機點一下冒一張（click 只在沒有捲動的輕點才會發，拖著捲不會誤觸） */
function onClick(event: MouseEvent) {
  if (lastPointerType !== 'touch' || !host)
    return
  const rect = host.getBoundingClientRect()
  spawn({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    unit: 'px',
    tilt: (Math.random() - 0.5) * 2 * TILT,
    size: 1,
  }, HOLD_MS + SLOW_HOLD_MS)
}

onMounted(() => {
  host = root.value?.parentElement ?? null
  if (!host)
    return
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  restCount = window.matchMedia('(min-width: 64rem)').matches ? 6 : 4
  // 先把圖抓進快取，第一張才不會冒出一個空框
  for (const src of props.images) {
    const img = new Image()
    img.src = src
  }
  if (reduced) {
    // 不動：進場那幾張直接放好，滑鼠與點擊都不掛（捲動進度引擎在 reduced-motion 下也不會啟動）
    restQueued = restCount
    while (restPlaced < restQueued)
      placeRest()
    return
  }
  register(host, { varName: '--trail', mode: 'travel', onProgress })
  host.addEventListener('pointermove', onMove, { passive: true })
  host.addEventListener('pointerleave', onLeave)
  host.addEventListener('pointerdown', onDown, { passive: true })
  host.addEventListener('click', onClick)
})

onBeforeUnmount(() => {
  host?.removeEventListener('pointermove', onMove)
  host?.removeEventListener('pointerleave', onLeave)
  host?.removeEventListener('pointerdown', onDown)
  host?.removeEventListener('click', onClick)
  window.clearTimeout(restTimer)
  for (const shot of live)
    window.clearTimeout(shot.timer)
})
</script>

<template>
  <div ref="root" class="trail pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
</template>

<style scoped>
/* 小拍立得：紙白框、下緣厚一點、淡影；圖用 cover 裁成 3:4。
   --size 是快掃時的縮小倍率；手機整體小一號（6rem），插畫兩側只剩 50px，卡片一半躲在裙子後面 */
.trail :deep(.shot) {
  position: absolute;
  width: calc(var(--size, 1) * 8.5rem);
  padding: 0.4rem 0.4rem 1.1rem;
  background: var(--color-paper);
  box-shadow:
    0 1px 1px rgb(17 17 17 / 6%),
    0 10px 24px rgb(17 17 17 / 14%);
  transform-origin: center;
  will-change: transform;
}
.trail :deep(.shot img) {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
}
@media (width < 64rem) {
  .trail :deep(.shot) {
    width: calc(var(--size, 1) * 6rem);
  }
}
</style>
