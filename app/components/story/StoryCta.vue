<!-- app/components/story/StoryCta.vue — 其餘出口。目前只剩婚紗照一個（新人 09-15 拿掉「留下你的祝福」與「看完整流程表」）。
     出口收成一行文字連結：襯線字、金色細底線、後面一支小箭頭——不做成大按鈕（新人：按鈕太突兀）。
     賓客照片收集（新人的雲端資料夾）由內容的 photoDrive.enabled 控制，婚禮當天才開，同一個樣式。 -->
<script setup lang="ts">
import type { StoryPhotoDrive } from '~/types/story'

defineProps<{
  date: string
  names: string
  entries: { key: string, label: string, to: string }[]
  photoDrive: StoryPhotoDrive
  /** 滑鼠掃過區塊時依序浮現的照片。 */
  trail: string[]
}>()

const illustration = ref<HTMLImageElement | null>(null)
const illustrationPending = ref(false)
let illustrationObserver: IntersectionObserver | null = null

onMounted(() => {
  if (!illustration.value || !('IntersectionObserver' in window)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  illustrationPending.value = true
  illustrationObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      illustrationPending.value = false
      illustrationObserver?.disconnect()
    }
  }, { threshold: 0.15 })
  illustrationObserver.observe(illustration.value)
})

onBeforeUnmount(() => illustrationObserver?.disconnect())
</script>

<template>
  <!-- 紀念冊的最後一頁：插圖、婚期與署名。 -->
  <section aria-labelledby="story-cta-title" class="relative overflow-hidden bg-cream px-6 py-20 text-center lg:py-28">
    <StoryImageTrail v-if="trail.length" :images="trail" />
    <!-- 眉標（JOIN US · 與我們同行）2026-09-15 拿掉：「期待與你相見」本身就是標題，上面那句是它的引子 -->
    <p class="font-serif-tc text-body text-ink-700">
      走過十一年，這一次
    </p>
    <h2 id="story-cta-title" class="mt-3 font-serif-tc text-h2 font-semibold text-ink">
      期待與你相見
    </h2>
    <!-- 插圖 1186×1412 帶透明：WebP q80 106KB（原 PNG 1.5MB 是全頁最大的一張圖，原始檔不入 repo） -->
    <img
      ref="illustration"
      src="/images/story/wedding-couple.webp"
      alt="新娘穿著粉色禮服手捧花束，與身穿灰色西裝的新郎相伴的插圖"
      width="1186"
      height="1412"
      loading="lazy"
      decoding="async"
      class="story-cta-illustration mx-auto mt-8 h-auto w-full max-w-72 object-contain sm:max-w-sm"
      :class="{ 'is-pending': illustrationPending }"
    >

    <p class="mt-6 font-display text-body-l tracking-widest text-gold-deep">
      {{ date }}
    </p>
    <p class="mt-2 font-serif-tc text-body tracking-widest text-ink-700">
      {{ names }}
    </p>

    <div class="relative z-10 mx-auto mt-8 flex max-w-md flex-col items-center gap-5">
      <NuxtLink
        v-for="entry in entries"
        :key="entry.key"
        :to="entry.to"
        class="group inline-flex items-center gap-2 border-b border-gold pb-1 font-serif-tc text-body-l tracking-widest text-ink transition-colors duration-250 hover:border-gold-deep hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
      >
        {{ entry.label }}
        <svg viewBox="0 0 24 24" class="size-4 text-gold transition-transform duration-250 group-hover:translate-x-0.5" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </NuxtLink>
      <a
        v-if="photoDrive.enabled"
        :href="photoDrive.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group inline-flex items-center gap-2 border-b border-gold pb-1 font-serif-tc text-body-l tracking-widest text-ink transition-colors duration-250 hover:border-gold-deep hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
      >
        {{ photoDrive.label }}
        <svg viewBox="0 0 24 24" class="size-4 text-gold transition-transform duration-250 group-hover:translate-x-0.5" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
    </div>
  </section>
</template>

<style scoped>
.story-cta-illustration {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 800ms ease-out, transform 800ms cubic-bezier(0.22, 1, 0.36, 1);
}

.story-cta-illustration.is-pending {
  opacity: 0;
  transform: translateY(24px);
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .story-cta-illustration,
  .story-cta-illustration.is-pending {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
