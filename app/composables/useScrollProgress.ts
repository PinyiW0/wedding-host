// 捲動進度引擎：把「元素相對視窗的位置」換算成 0~1 寫進 CSS var，交給 CSS 的 transform 消費。
// 沿用 InviteStage 的慣例——事件只設旗標、rAF 節流、JS 只寫 var 不碰 style.transform。
//
// 全域單例：整站同時只有一個 rAF loop 與一個 IntersectionObserver，
// landing 的三個 showcase 與系列頁的數十張照片共用，不會各自起 loop。
//
// reduced-motion 時完全不啟動：CSS var 維持宣告端的預設值（--sp: 0.5、--gp: 1），
// 也就是「構圖最完整」的中性狀態，無 JS 或關閉動效時畫面依然正確。

/**
 * block：區塊捲過視窗的進度
 * center：元素中心貼近視窗中心的程度
 * leave：元素被捲出視窗的進度（0＝貼齊視窗頂、1＝已捲掉一個視窗高）。
 *        滿版 hero 的高度等於視窗高，block 模式沒有可捲行程，得用這個。
 */
type ProgressMode = 'block' | 'center' | 'leave'

export interface ScrollProgressOptions {
  /** 寫入的 CSS var 名稱，預設 --sp */
  varName?: string
  mode?: ProgressMode
  /** 進度更新時的回呼，用於切換 data-* 這類非數值狀態 */
  onProgress?: (progress: number) => void
}

interface Entry {
  el: HTMLElement
  varName: string
  mode: ProgressMode
  onProgress?: (progress: number) => void
  /** 是否在視窗附近（由 IntersectionObserver 切換），只有 true 才進入每幀計算 */
  active: boolean
  top: number
  height: number
  last: number
}

/** center 模式的作用範圍：距視窗中心超過 0.6 個視窗高就視為 0 */
const CENTER_SPAN_RATIO = 0.6

const entries = new Map<HTMLElement, Entry>()

let observer: IntersectionObserver | null = null
let motionQuery: MediaQueryList | null = null
let enabled = false
let instances = 0
let frame = 0

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

// 量測寫進 entry 快取：捲動中讀 getBoundingClientRect 會逐幀觸發 layout
function measure(entry: Entry) {
  const rect = entry.el.getBoundingClientRect()
  entry.top = rect.top + window.scrollY
  entry.height = rect.height
}

function compute(entry: Entry): number {
  const viewport = window.innerHeight
  if (entry.mode === 'center') {
    const distance = Math.abs(entry.top + entry.height / 2 - (window.scrollY + viewport / 2))
    return clamp01(1 - distance / (viewport * CENTER_SPAN_RATIO))
  }
  if (entry.mode === 'leave')
    return clamp01((window.scrollY - entry.top) / viewport)
  const span = entry.height - viewport
  // 區塊比視窗矮時沒有可捲的行程，直接停在中性位
  if (span <= 0)
    return 0.5
  return clamp01((window.scrollY - entry.top) / span)
}

function tick() {
  frame = 0
  for (const entry of entries.values()) {
    if (!entry.active)
      continue
    const progress = compute(entry)
    if (Math.abs(progress - entry.last) < 0.001)
      continue
    entry.last = progress
    entry.el.style.setProperty(entry.varName, progress.toFixed(4))
    entry.onProgress?.(progress)
  }
}

function schedule() {
  if (!enabled || frame)
    return
  frame = requestAnimationFrame(tick)
}

function onScroll() {
  schedule()
}

function onResize() {
  for (const entry of entries.values())
    measure(entry)
  schedule()
}

function stopEngine() {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  if (frame) {
    cancelAnimationFrame(frame)
    frame = 0
  }
  // 把寫過的 var 拿掉，讓 CSS 端退回宣告的預設值
  for (const entry of entries.values()) {
    entry.el.style.removeProperty(entry.varName)
    entry.last = Number.NaN
  }
}

function startEngine() {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  // 使用者中途關掉「減少動態」時，已註冊但沒被觀察的元素要在這裡補上
  for (const el of entries.keys())
    observer?.observe(el)
  onResize()
}

function updateMotion() {
  const next = !motionQuery?.matches
  if (next === enabled)
    return
  enabled = next
  if (enabled)
    startEngine()
  else stopEngine()
}

export function useScrollProgress() {
  const owned: HTMLElement[] = []

  function register(el: HTMLElement | null | undefined, options: ScrollProgressOptions = {}) {
    if (!el || entries.has(el))
      return
    const entry: Entry = {
      el,
      varName: options.varName ?? '--sp',
      mode: options.mode ?? 'block',
      onProgress: options.onProgress,
      active: false,
      top: 0,
      height: 0,
      last: Number.NaN,
    }
    entries.set(el, entry)
    owned.push(el)
    if (enabled) {
      measure(entry)
      observer?.observe(el)
    }
  }

  onMounted(() => {
    instances += 1
    if (instances === 1) {
      motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      motionQuery.addEventListener('change', updateMotion)
      // 提前 20% 視窗高就納入計算，元素露臉時進度已經是對的
      observer = new IntersectionObserver((records) => {
        for (const record of records) {
          const entry = entries.get(record.target as HTMLElement)
          if (!entry)
            continue
          entry.active = record.isIntersecting
          if (record.isIntersecting)
            measure(entry)
        }
        schedule()
      }, { rootMargin: '20% 0px' })
      updateMotion()
    }
    if (!enabled)
      return
    for (const el of owned) {
      const entry = entries.get(el)
      if (entry)
        measure(entry)
      observer?.observe(el)
    }
    schedule()
  })

  onBeforeUnmount(() => {
    for (const el of owned) {
      observer?.unobserve(el)
      entries.delete(el)
    }
    owned.length = 0

    instances -= 1
    if (instances > 0)
      return
    motionQuery?.removeEventListener('change', updateMotion)
    motionQuery = null
    observer?.disconnect()
    observer = null
    if (enabled) {
      stopEngine()
      enabled = false
    }
  })

  return { register }
}
