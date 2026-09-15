<!-- app/components/gallery/GalleryCursor.vue — 全站游標
     只在滑鼠裝置（hover:hover + pointer:fine）啟用；觸控裝置完全不掛載，不佔任何開銷。
     兩個狀態：平常是一顆小墨點跟著游標走，滑到 [data-cursor] 的東西上才漲成圓牌並亮出字。
     位置更新走 rAF 節流（沿用 useScrollProgress 的慣例：事件只記最新座標，畫面更新交給下一影格）。
     顯示哪個字看 [data-cursor] 的屬性值本身，不用另外傳 prop。
     原生游標的隱藏由本元件掛在 <html> 的 class 控制——掛載成功才隱藏，
     JS 沒跑起來時原生游標原封不動（放在各元件的 scoped style 做不到這件事）。 -->
<script setup lang="ts">
const supported = ref(false)
/** 游標是否在視窗內；離開視窗時連小墨點一起收掉 */
const inside = ref(false)
const visible = ref(false)

/** off 離開視窗／dot 平常的小墨點／pill 滑在 [data-cursor] 上的圓牌 */
const state = computed(() => {
  if (!inside.value)
    return 'off'
  return visible.value ? 'pill' : 'dot'
})
const label = ref('View')
const cursorRef = ref<HTMLElement | null>(null)

let rafId = 0
let dirty = false
let lastX = -200
let lastY = -200

function tick() {
  rafId = 0
  if (!dirty)
    return
  dirty = false
  cursorRef.value?.style.setProperty('--cx', `${lastX}px`)
  cursorRef.value?.style.setProperty('--cy', `${lastY}px`)
}

function onMove(e: PointerEvent) {
  lastX = e.clientX
  lastY = e.clientY
  inside.value = true
  dirty = true
  if (!rafId)
    rafId = requestAnimationFrame(tick)
}

function onOver(e: PointerEvent) {
  const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]')
  if (!target)
    return
  label.value = target.dataset.cursor || 'View'
  visible.value = true
}

function onOut(e: PointerEvent) {
  const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]')
  if (!target)
    return
  const related = (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]')
  if (related === target)
    return
  visible.value = false
}

function onLeaveWindow() {
  visible.value = false
  inside.value = false
}

onMounted(() => {
  supported.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (!supported.value)
    return
  document.documentElement.classList.add('gc-native-off')
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerover', onOver, { passive: true })
  window.addEventListener('pointerout', onOut, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeaveWindow)
})

onUnmounted(() => {
  if (rafId)
    cancelAnimationFrame(rafId)
  document.documentElement.classList.remove('gc-native-off')
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerover', onOver)
  window.removeEventListener('pointerout', onOut)
  document.documentElement.removeEventListener('pointerleave', onLeaveWindow)
})
</script>

<template>
  <div v-if="supported" ref="cursorRef" class="gc-root" :data-state="state" aria-hidden="true">
    <span class="gc-dot" />
    <span class="gc-pill">{{ label }}</span>
  </div>
</template>

<style scoped>
/* 掛載成功才把原生游標讓出來；連結、按鈕的 cursor: pointer 也要一起蓋掉，所以帶 * */
:global(html.gc-native-off),
:global(html.gc-native-off *) {
  cursor: none;
}

.gc-root {
  position: fixed;
  top: 0;
  left: 0;
  /* 要蓋過選單面板（65）與開關（70） */
  z-index: 90;
  pointer-events: none;
  transform: translate(var(--cx, -200px), var(--cy, -200px));
}

.gc-dot,
.gc-pill {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--radius-full);
  background: var(--color-ink);
}

/* 平常態：一顆小墨點。
   放大成圓牌時墨點跟著一起放大再淡出、圓牌則從跟墨點一樣的尺寸長起來
   （14 / 84 ≒ 0.167），看起來是同一顆東西長大，不是兩個元素硬切換。
   刻意放慢到 500ms，且 easing 用 ease-standard 不用 ease-emphasized：
   emphasized 的曲線太前傾（120ms 就走完 86%），單純拉長時間感覺不出來變慢。 */
.gc-dot {
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 300ms var(--ease-standard),
    transform 500ms var(--ease-standard);
}

.gc-root[data-state="dot"] .gc-dot {
  opacity: 1;
  transform: scale(1);
}

.gc-root[data-state="pill"] .gc-dot {
  opacity: 0;
  transform: scale(6);
}

.gc-pill {
  display: grid;
  width: 84px;
  height: 84px;
  margin: -42px 0 0 -42px;
  place-items: center;
  color: var(--color-paper);
  font-family: var(--font-display);
  font-size: var(--text-body);
  font-style: italic;
  letter-spacing: 0.04em;
  opacity: 0;
  transform: scale(0.167);
  transition:
    opacity 420ms var(--ease-standard),
    transform 500ms var(--ease-standard);
}

.gc-root[data-state="pill"] .gc-pill {
  opacity: 1;
  transform: scale(1);
}
</style>
