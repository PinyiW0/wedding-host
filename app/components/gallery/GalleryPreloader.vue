<!-- app/components/gallery/GalleryPreloader.vue — 相簿開場（client-only 疊層）
     三段：① 字樣隨真實預載進度上墨 + 數字滾輪 ② 照片自中央一張張疊出、整疊放大
     ③ 最後一張放大成 hero 後疊層淡出。疊層底下的頁面 SSR 完整輸出，這裡只是蓋在上面演。
     hero 卡片的版面盒＝最終 hero 的位置（inset: --gallery-frame），開場只用 transform 縮回中央，
     放大結束時與底下的 hero 幾何重合，淡出即無縫定格。
     reduced-motion 直接不渲染、立刻 emit done。 -->
<script setup lang="ts">
import type { GalleryHeroContent } from '~/types/gallery'

const props = defineProps<{
  montage: string[]
  hero: GalleryHeroContent
}>()

const emit = defineEmits<{ done: [] }>()

/** 進度條至少走這麼久：快取命中時不會 0 直接跳 100，字樣也才有時間一筆一筆寫完 */
const MIN_LOAD_MS = 1600
/** 圖片載不完的硬上限，逾時就放行 */
const LOAD_TIMEOUT_MS = 5000
/** 蒙太奇＋放大的總長，與 <style> 內的 keyframe 編排對應 */
const SHOW_MS = 2600

const phase = ref<'loading' | 'show'>('loading')
const active = ref(false)
const progress = ref(0)

const percent = computed(() => Math.round(progress.value * 100))
/** 百位在未滿 100 前留著位置但不顯示，數字不會左右跳動 */
const digits = computed(() => {
  const value = Math.min(percent.value, 100)
  return [Math.floor(value / 100), Math.floor(value / 10) % 10, value % 10]
})

const sources = computed(() => [...props.montage, props.hero.src])

let frame = 0
let showTimer: ReturnType<typeof setTimeout> | undefined
let startedAt = 0
let loadedCount = 0
let forceComplete = false
let previousOverflow = ''

function finish() {
  if (!active.value)
    return
  active.value = false
  document.body.style.overflow = previousOverflow
  emit('done')
}

function beginShow() {
  if (phase.value !== 'loading')
    return
  phase.value = 'show'
  showTimer = setTimeout(finish, SHOW_MS)
}

function tick(now: number) {
  frame = 0
  const total = sources.value.length
  const loadedRatio = forceComplete || total === 0 ? 1 : loadedCount / total
  // 取「實際載入」與「最短時長」的較小值：既等圖也等戲演完
  const target = Math.min(loadedRatio, (now - startedAt) / MIN_LOAD_MS)
  const next = progress.value + (target - progress.value) * 0.12
  progress.value = target - next < 0.005 ? target : next

  if (progress.value >= 0.999) {
    progress.value = 1
    beginShow()
    return
  }
  frame = requestAnimationFrame(tick)
}

function preload() {
  for (const src of sources.value) {
    const img = new Image()
    const count = () => {
      loadedCount += 1
    }
    // 失敗也計數：少一張圖不該讓開場卡在 80%
    img.onload = count
    img.onerror = count
    img.src = src
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    finish()
}

onMounted(() => {
  // 動效關閉時整段不演：使用者看到的就是底下那頁完整的靜態內容
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    emit('done')
    return
  }

  active.value = true
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  // 疊層的 hero 卡片以視窗為準定位，頁面得停在最上面才對得齊
  window.scrollTo(0, 0)

  preload()
  startedAt = performance.now()
  frame = requestAnimationFrame(tick)
  window.addEventListener('keydown', onKeydown)
  setTimeout(() => {
    forceComplete = true
  }, LOAD_TIMEOUT_MS)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(showTimer)
  if (frame)
    cancelAnimationFrame(frame)
  if (active.value)
    document.body.style.overflow = previousOverflow
})
</script>

<template>
  <Transition name="pl">
    <div
      v-if="active"
      class="pl-root"
      :data-phase="phase"
      :style="{ '--load-p': progress.toFixed(4) }"
    >
      <!-- ① 上墨中的字樣 -->
      <div class="pl-loader">
        <div class="pl-logo">
          <GalleryLogoMark :progress="progress" :aria-label="hero.names" />
        </div>

        <p class="pl-count" aria-hidden="true">
          <span
            v-for="(digit, i) in digits"
            :key="i"
            class="pl-digit"
            :class="{ 'pl-digit-lead': i === 0 && percent < 100 }"
          >
            <span class="pl-reel" :style="{ '--d': String(digit) }">
              <span v-for="n in 10" :key="n">{{ n - 1 }}</span>
            </span>
          </span>
        </p>
        <p class="pl-percent" aria-hidden="true">
          %
        </p>
      </div>

      <!-- ② 照片自中央疊出，整疊持續放大 -->
      <div v-if="phase === 'show'" class="pl-stack" aria-hidden="true">
        <img
          v-for="(src, i) in montage"
          :key="src"
          :src="src"
          alt=""
          class="pl-card"
          :style="{ '--i': String(i) }"
        >
      </div>

      <!-- ③ 最後一張＝hero，放大到與底下的 hero 重合 -->
      <img
        v-if="phase === 'show'"
        :src="hero.src"
        alt=""
        class="pl-hero"
        aria-hidden="true"
      >

      <button type="button" class="pl-skip" @click="finish">
        跳過開場
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.pl-root {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--color-paper);
  overflow: hidden;
}

.pl-leave-active {
  transition: opacity 400ms var(--ease-standard);
}

.pl-leave-to {
  opacity: 0;
}

/* ── ① 描線與計數 ── */
.pl-loader {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transition: opacity 400ms var(--ease-standard);
}

/* 進蒙太奇時整組淡出，不是硬切 */
.pl-root[data-phase="show"] .pl-loader {
  opacity: 0;
  pointer-events: none;
}

.pl-logo {
  width: min(56vw, 420px);
}

.pl-count {
  /* Cormorant 是舊體數字（3、4、9 有下伸部），格高留 1.4em 才不會被裁掉 */
  --cell: 1.4em;

  position: absolute;
  left: clamp(16px, 4vw, 56px);
  top: 50%;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-variant-numeric: lining-nums tabular-nums;
  color: var(--color-ink-700);
}

.pl-digit {
  display: block;
  height: var(--cell);
  overflow: hidden;
}

/* 未滿 100 時百位留位不顯示，數字不左右跳 */
.pl-digit-lead {
  opacity: 0;
}

.pl-reel {
  display: block;
  transform: translateY(calc(var(--d, 0) * var(--cell) * -1));
  /* 進度更新很密，滾動要短才停得住，不然整段都在滑動中 */
  transition: transform 150ms var(--ease-standard);
}

.pl-reel > span {
  display: grid;
  place-items: center;
  height: var(--cell);
  line-height: 1;
}

.pl-percent {
  position: absolute;
  right: clamp(16px, 4vw, 56px);
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  color: var(--color-ink-700);
}

/* ── ② 蒙太奇 ── */
.pl-stack {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  animation: pl-zoom 1900ms var(--ease-standard) both;
}

.pl-card {
  grid-area: 1 / 1;
  width: 46vw;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  animation: pl-card-in 420ms var(--ease-standard) both;
  animation-delay: calc(var(--i, 0) * 300ms);
}

/* 每張各自歪一點、錯開一點，疊起來才像一疊照片而不是對齊的圖層 */
.pl-card:nth-child(2n) {
  transform: rotate(2.4deg) translate(2%, -1.5%);
}

.pl-card:nth-child(3n) {
  transform: rotate(-3deg) translate(-2.5%, 1%);
}

/* 手機只演前四張，節奏才不會拖 */
.pl-card:nth-child(n + 5) {
  display: none;
}

@media (min-width: 1024px) {
  .pl-card {
    width: 21vw;
  }

  .pl-card:nth-child(n + 5) {
    display: block;
  }
}

@keyframes pl-zoom {
  from {
    transform: scale(0.78);
  }

  to {
    transform: scale(1.12);
  }
}

@keyframes pl-card-in {
  from {
    opacity: 0;
  }
}

/* ── ③ hero 放大 ── */
.pl-hero {
  position: absolute;
  inset: var(--gallery-frame, 16px);
  width: auto;
  height: auto;
  object-fit: cover;
  border-radius: var(--radius);
  animation: pl-hero-grow 900ms var(--ease-emphasized) both;
  animation-delay: 1500ms;
}

/* 每一幀都寫完整的 transform：只寫變化量會讓瀏覽器退回矩陣插值而跳動 */
@keyframes pl-hero-grow {
  0% {
    opacity: 0;
    transform: scale(0.26);
  }

  12% {
    opacity: 1;
    transform: scale(0.26);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.pl-skip {
  position: absolute;
  right: clamp(16px, 4vw, 56px);
  bottom: clamp(16px, 4vh, 40px);
  padding: 8px 18px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  background: rgb(250 247 241 / 78%);
  font-size: var(--text-caption);
  letter-spacing: 0.08em;
  color: var(--color-ink-500);
  cursor: pointer;
  transition:
    background-color 250ms var(--ease-standard),
    color 250ms var(--ease-standard);
}

.pl-skip:hover,
.pl-skip:focus-visible {
  background: var(--color-ink);
  color: var(--color-paper);
}

.pl-skip:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
}
</style>
