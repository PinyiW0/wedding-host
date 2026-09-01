<!-- app/components/gallery/GallerySeriesShowcase.vue — landing 的單一系列區塊
     高 280vh 的區塊內用 position: sticky 把一屏釘住（pin 純 CSS、零 JS），
     捲動進度由 useScrollProgress 寫成 --sp，照片欄各自以不同幅度位移做視差。
     --sp 預設 0.5（構圖中性位）：無 JS 或 reduced-motion 時畫面依然完整。
     本檔不在公開頁白名單，display 字級走 <style scoped>。 -->
<script setup lang="ts">
import type { GallerySeries } from '~/types/gallery'

const props = defineProps<{
  series: GallerySeries
  anchorId: string
  to: string
}>()

const blockRef = ref<HTMLElement | null>(null)
/** 名字是否就位；SSR 預設 true，沒有 JS 時大字永遠看得見 */
const isActive = ref(true)

const leftChars = computed(() => Array.from(props.series.title))
const rightChars = computed(() => Array.from(props.series.word))

const { register } = useScrollProgress()

onMounted(() => {
  register(blockRef.value, {
    varName: '--sp',
    // 進出各留一段：名字在區塊剛進場與快離場時退場，中段才完全就位
    onProgress: (p) => {
      isActive.value = p > 0.08 && p < 0.92
    },
  })
})
</script>

<template>
  <section :id="anchorId" ref="blockRef" class="ss">
    <NuxtLink
      :to="to"
      class="ss-pin"
      :data-active="isActive ? 'true' : 'false'"
      :aria-label="`看「${series.title}」系列，共 ${series.photos.length} 張`"
    >
      <div class="ss-collage" aria-hidden="true">
        <figure
          v-for="(photo, i) in series.showcase"
          :key="photo.src"
          class="ss-card"
          :class="`ss-card-${i + 1}`"
        >
          <img :src="photo.src" :alt="photo.alt" loading="lazy" decoding="async" class="ss-img">
        </figure>
      </div>

      <h2 class="ss-names">
        <span class="sr-only">{{ series.title }} — {{ series.subtitleEn }}</span>
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
            :style="{ '--i': String(i) }"
          >{{ char }}</span>
        </span>
      </h2>

      <span class="ss-meta" aria-hidden="true">
        <span class="ss-desc">{{ series.description }}</span>
        <span class="ss-cta">看 {{ series.photos.length }} 張</span>
      </span>
    </NuxtLink>
  </section>
</template>

<style scoped>
.ss {
  position: relative;
  height: 240vh;
}

.ss-pin {
  position: sticky;
  top: 0;
  display: block;
  height: 100dvh;
  overflow: hidden;
}

.ss-pin:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: -6px;
}

/* 手機：中英文疊成一欄靠左，照片讓到右半邊（橫向排會被照片整個蓋掉）
   桌機：左中文、右英文各靠一側，中間留給照片穿過 */
.ss-names {
  position: absolute;
  left: clamp(16px, 4vw, 56px);
  right: 52%;
  top: 50%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  transform: translateY(-50%);
  font-family: var(--font-display);
  font-size: clamp(2rem, 7.5vw, 7rem);
  line-height: 1;
  font-weight: 400;
  color: var(--color-ink);
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

.ss-word {
  display: inline-flex;
}

.ss-word-right {
  font-style: italic;
  color: var(--color-ink-500);
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

.ss-pin[data-active="false"] .ss-char {
  opacity: 0;
  transform: translateY(0.4em);
}

/* 照片拼貼：疊在名字之上（與參考站一致，照片會壓過大字） */
.ss-collage {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.ss-card {
  position: absolute;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--color-cream);
  box-shadow: var(--shadow);
  /* 視差：--sp 由 0→1，卡片自 +shift/2 移到 -shift/2 */
  transform: translate3d(0, calc((var(--sp, 0.5) - 0.5) * var(--shift, -40vh)), 0);
  will-change: transform;
}

.ss-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 手機：兩張靠右錯開，左半邊留給文字 */
.ss-card-1 {
  right: 4%;
  top: 8%;
  width: 52%;
  aspect-ratio: 3 / 4;
  --shift: -46vh;
}

.ss-card-2 {
  right: 22%;
  top: 54%;
  width: 40%;
  aspect-ratio: 3 / 4;
  --shift: -72vh;
}

.ss-card-3 {
  display: none;
}

@media (min-width: 1024px) {
  .ss-card-1 {
    left: 12%;
    right: auto;
    top: 12%;
    width: 24%;
    aspect-ratio: 3 / 4;
    --shift: -64vh;
  }

  .ss-card-2 {
    left: 40%;
    right: auto;
    top: 26%;
    width: 27%;
    aspect-ratio: 4 / 5;
    --shift: -42vh;
  }

  .ss-card-3 {
    display: block;
    right: 9%;
    top: 16%;
    width: 20%;
    aspect-ratio: 3 / 4;
    --shift: -88vh;
  }
}

/* 說明與 CTA：釘在底部中央，跟著名字一起進出 */
.ss-meta {
  position: absolute;
  left: 50%;
  bottom: clamp(72px, 12vh, 120px);
  z-index: 3;
  display: grid;
  justify-items: center;
  gap: 10px;
  width: max-content;
  max-width: min(88vw, 30rem);
  transform: translateX(-50%);
  text-align: center;
  transition:
    transform 400ms var(--ease-emphasized),
    opacity 400ms var(--ease-standard);
}

.ss-pin[data-active="false"] .ss-meta {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

.ss-desc {
  font-size: var(--text-body);
  color: var(--color-ink-500);
}

.ss-cta {
  padding: 10px 24px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  background: var(--color-paper);
  font-size: var(--text-body);
  letter-spacing: 0.06em;
  color: var(--color-ink);
  transition:
    background-color 250ms var(--ease-standard),
    color 250ms var(--ease-standard);
}

.ss-pin:hover .ss-cta,
.ss-pin:focus-visible .ss-cta {
  background: var(--color-ink);
  color: var(--color-paper);
}

/* 動效關閉時照片永遠停在中性位（--sp 0.5）壓在系列名上，
   捲動版靠位移錯開的可讀性在這裡不會發生——改讓文字浮到照片之上並加紙色暈邊。 */
@media (prefers-reduced-motion: reduce) {
  .ss-names {
    z-index: 3;
  }

  .ss-char {
    text-shadow:
      0 0 6px var(--color-paper),
      0 0 20px var(--color-paper);
  }

  .ss-desc {
    padding: 4px 14px;
    border-radius: var(--radius-full);
    background: var(--color-paper);
  }
}
</style>
