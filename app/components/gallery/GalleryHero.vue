<!-- app/components/gallery/GalleryHero.vue — 婚紗相簿首屏
     滿版照片內縮一圈紙色邊框（邊框寬度由頁面的 --gallery-frame 決定，開場動畫的落點以此對齊）。
     標語拆成四個大字圍在照片四邊（上方那個會輪換），往下捲時各自朝外散開。
     捲動進度 --hp 預設 0＝全部就位，所以沒有 JS 或關閉動效時就是一張完整的首屏。
     本檔不在 visual-hierarchy 的公開頁白名單內，display 級字級一律走 <style scoped>。 -->
<script setup lang="ts">
import type { GalleryHeroContent } from '~/types/gallery'

const props = defineProps<{
  hero: GalleryHeroContent
  /** CTA 指向的第一個系列錨點 id */
  firstSeriesId: string
}>()

/** 上方大字輪換間隔 */
const SWAP_MS = 3400

const rootRef = ref<HTMLElement | null>(null)
const wordIndex = ref(0)
let swapTimer: ReturnType<typeof setInterval> | undefined

const topWord = computed(() => {
  const list = props.hero.words.top
  return list[wordIndex.value % list.length] ?? list[0] ?? ''
})

const { register } = useScrollProgress()

onMounted(() => {
  register(rootRef.value, { varName: '--hp', mode: 'leave' })
  // 文字輪換是 JS 驅動的，繞得過 main.css 的 CSS guard，得自己判斷
  if (props.hero.words.top.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  swapTimer = setInterval(() => {
    wordIndex.value += 1
  }, SWAP_MS)
})

onBeforeUnmount(() => clearInterval(swapTimer))
</script>

<template>
  <section ref="rootRef" class="gh-root">
    <div class="gh-frame">
      <img
        :src="hero.src"
        :alt="hero.alt"
        class="gh-img"
        fetchpriority="high"
      >
      <div class="gh-scrim" aria-hidden="true" />

      <!-- 標語的完整文字給螢幕閱讀器；畫面上由四邊的大字呈現 -->
      <h1 class="sr-only">
        {{ hero.tagline }}
      </h1>

      <div class="gh-top">
        <!-- 開場描完的那個字樣，縮小落回頁首 -->
        <img src="/images/gallery/Union.svg" alt="" class="gh-logo">
        <span class="gh-word gh-word-top" aria-hidden="true">
          <Transition name="gh-swap" mode="out-in">
            <span :key="topWord" class="gh-word-swap">{{ topWord }}</span>
          </Transition>
        </span>
      </div>

      <span class="gh-word gh-word-left" aria-hidden="true">{{ hero.words.left }}</span>
      <span class="gh-word gh-word-right" aria-hidden="true">{{ hero.words.right }}</span>

      <div class="gh-bottom">
        <span class="gh-word gh-word-bottom" aria-hidden="true">{{ hero.words.bottom }}</span>
        <p class="gh-subtitle">
          {{ hero.subtitle }}
        </p>
        <a class="gh-cta" :href="`#${firstSeriesId}`">
          {{ hero.ctaLabel }}
        </a>
      </div>

      <p class="gh-sign">
        {{ hero.names }}<span class="gh-dot" aria-hidden="true">·</span>{{ hero.date }}
      </p>

      <div class="gh-count">
        <GalleryCountdown :target="hero.weddingAt" :married-label="hero.marriedLabel" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.gh-root {
  position: relative;
  min-height: 100dvh;
  padding: var(--gallery-frame, 16px);
  background: var(--color-paper);
}

.gh-frame {
  position: relative;
  min-height: calc(100dvh - var(--gallery-frame, 16px) * 2);
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--color-cream);
}

.gh-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 往下捲時照片微微推近，比整張定住有空氣感；放大不會露出邊 */
  transform: scale(calc(1 + var(--hp, 0) * 0.06));
}

/* 上下各一道墨色漸層：托住四邊的白字 */
.gh-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom, rgb(17 17 17 / 34%), transparent 30%),
    linear-gradient(to top, rgb(17 17 17 / 62%), transparent 58%);
}

/* ── 四邊大字 ── */
.gh-word {
  position: absolute;
  font-family: var(--font-display);
  font-size: clamp(2.25rem, 7vw, 6rem);
  line-height: 1;
  font-weight: 400;
  color: var(--color-paper);
  text-shadow: 0 2px 24px rgb(17 17 17 / 32%);
  pointer-events: none;
  white-space: nowrap;
}

.gh-top {
  position: absolute;
  left: 50%;
  top: clamp(14px, 3vh, 32px);
  display: grid;
  justify-items: center;
  gap: clamp(4px, 1vh, 12px);
  /* 往下捲時整組往上退場 */
  transform: translateX(-50%) translateY(calc(var(--hp, 0) * -16vh));
  opacity: calc(1 - var(--hp, 0) * 1.4);
}

.gh-logo {
  width: clamp(88px, 11vw, 138px);
  height: auto;
  /* 深色墨稿的字樣壓在照片上會看不見，轉成紙白 */
  filter: brightness(0) invert(1);
  opacity: 0.9;
}

.gh-word-top {
  position: static;
  display: block;
}

.gh-word-swap {
  display: inline-block;
}

/* 輪換：上一個字往上淡出、下一個字自下方遞上 */
.gh-swap-enter-active,
.gh-swap-leave-active {
  transition:
    transform 400ms var(--ease-emphasized),
    opacity 250ms var(--ease-standard);
}

.gh-swap-enter-from {
  opacity: 0;
  transform: translateY(0.38em);
}

.gh-swap-leave-to {
  opacity: 0;
  transform: translateY(-0.38em);
}

.gh-word-left {
  left: clamp(16px, 4vw, 64px);
  top: 50%;
  transform: translateY(-50%) translateX(calc(var(--hp, 0) * -22vw));
  opacity: calc(1 - var(--hp, 0) * 1.4);
}

/* 右緣讓給倒數條 */
.gh-word-right {
  right: clamp(52px, 7vw, 108px);
  top: 50%;
  transform: translateY(-50%) translateX(calc(var(--hp, 0) * 22vw));
  opacity: calc(1 - var(--hp, 0) * 1.4);
}

.gh-bottom {
  position: absolute;
  left: 50%;
  bottom: clamp(88px, 15vh, 150px);
  display: grid;
  justify-items: center;
  gap: 14px;
  width: max-content;
  max-width: min(88vw, 34rem);
  text-align: center;
  transform: translateX(-50%) translateY(calc(var(--hp, 0) * 16vh));
  opacity: calc(1 - var(--hp, 0) * 1.4);
}

.gh-word-bottom {
  position: static;
}

.gh-subtitle {
  font-size: var(--text-body-l);
  color: var(--color-paper);
  opacity: 0.88;
}

.gh-cta {
  padding: 12px 28px;
  border: 1px solid rgb(250 247 241 / 62%);
  border-radius: var(--radius-full);
  font-size: var(--text-body);
  letter-spacing: 0.08em;
  color: var(--color-paper);
  transition:
    background-color 250ms var(--ease-standard),
    color 250ms var(--ease-standard),
    border-color 250ms var(--ease-standard);
}

.gh-cta:hover,
.gh-cta:focus-visible {
  background: var(--color-paper);
  color: var(--color-ink);
  border-color: var(--color-paper);
}

.gh-cta:focus-visible {
  outline: 2px solid var(--color-gold-light);
  outline-offset: 3px;
}

/* 手機的底部導覽膠囊是滿版的，署名要讓到它上面 */
.gh-sign {
  position: absolute;
  left: clamp(16px, 3vw, 32px);
  bottom: 78px;
  display: flex;
  align-items: center;
  font-family: var(--font-display);
  font-size: var(--text-body-l);
  letter-spacing: 0.06em;
  color: var(--color-paper);
  opacity: calc(0.9 - var(--hp, 0));
}

.gh-dot {
  margin-inline: 10px;
  opacity: 0.6;
}

/* 倒數：貼右緣，往下捲時淡出 */
.gh-count {
  position: absolute;
  inset: 0 clamp(6px, 1.4vw, 18px) 0 auto;
  width: clamp(34px, 5vw, 52px);
  opacity: calc(1 - var(--hp, 0) * 1.6);
}

@media (min-width: 640px) {
  .gh-sign {
    bottom: clamp(16px, 3vh, 28px);
  }
}
</style>
