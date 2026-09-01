<!-- app/pages/gallery/[weddingId]/[series].vue — 單一系列的照片頁
     由相簿首頁的系列區塊進入。左右緣（手機為頁尾）可切換上一／下一系列，頁尾預告下一組。
     本檔在 visual-hierarchy 的公開頁白名單內，可直接用 display 級字級。 -->
<script setup lang="ts">
definePageMeta({ layout: 'story' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const content = useGalleryContent()
const slug = String(route.params.series)
const series = findGallerySeries(content, slug)

if (!series) {
  throw createError({
    statusCode: 404,
    statusMessage: '找不到這個系列',
    fatal: true,
  })
}

const neighbours = adjacentGallerySeries(content, slug)

/** 首圖沿用該張照片自己的描述，不另編一段 */
const coverAlt = computed(
  () => series?.photos.find(photo => photo.src === series?.cover)?.alt ?? series?.description ?? '',
)

function seriesPath(target: string): string {
  return `/gallery/${weddingId.value}/${target}`
}

useSeoMeta({
  title: `${series.title} — 婚紗照`,
  description: series.description,
  ogTitle: `${series.title} — 婚紗照`,
  ogDescription: series.description,
  ogImage: series.cover,
})
</script>

<template>
  <div v-if="series" class="gs-page bg-paper">
    <header class="gs-hero">
      <img :src="series.cover" :alt="coverAlt" class="gs-hero-img" fetchpriority="high">
      <div class="gs-hero-scrim" aria-hidden="true" />
      <div class="gs-hero-content">
        <p class="text-overline uppercase">
          {{ series.subtitleEn }}
        </p>
        <h1 class="mt-4 font-display text-h1 lg:text-display-l">
          {{ series.title }}
        </h1>
        <p class="mt-4 text-body-l">
          {{ series.description }}
        </p>
        <p class="mt-2 text-caption">
          共 {{ series.photos.length }} 張
        </p>
      </div>
    </header>

    <GallerySeriesFlow :photos="series.photos" />

    <nav v-if="neighbours" class="gs-side" aria-label="切換系列">
      <NuxtLink
        :to="seriesPath(neighbours.prev.slug)"
        class="gs-arrow gs-arrow-prev"
        :aria-label="`上一個系列：${neighbours.prev.title}`"
      >
        <UIcon name="i-heroicons-chevron-left" class="size-5" />
      </NuxtLink>
      <NuxtLink
        :to="seriesPath(neighbours.next.slug)"
        class="gs-arrow gs-arrow-next"
        :aria-label="`下一個系列：${neighbours.next.title}`"
      >
        <UIcon name="i-heroicons-chevron-right" class="size-5" />
      </NuxtLink>
    </nav>

    <footer v-if="neighbours" class="gs-outro">
      <p class="text-overline uppercase text-gold-deep">
        Next Series
      </p>
      <NuxtLink :to="seriesPath(neighbours.next.slug)" class="gs-next">
        <img :src="neighbours.next.cover" alt="" class="gs-next-img">
        <span class="gs-next-label">
          <span class="font-display text-h2">{{ neighbours.next.title }}</span>
          <span class="mt-1 block text-body text-ink-500">{{ neighbours.next.subtitleEn }}</span>
        </span>
      </NuxtLink>

      <nav class="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center" aria-label="其他頁面">
        <UButton :to="`/gallery/${weddingId}`" size="xl" color="neutral" variant="outline">
          回相簿首頁
        </UButton>
        <UButton :to="`/story/${weddingId}`" size="xl" color="primary">
          看我們的故事
        </UButton>
      </nav>
    </footer>

    <MusicToggle :src="content.music.src" />
  </div>
</template>

<style scoped>
.gs-hero {
  position: relative;
  display: grid;
  place-items: end center;
  min-height: 72dvh;
  overflow: hidden;
  padding: 24px 24px clamp(40px, 8vh, 88px);
  text-align: center;
  color: var(--color-paper);
}

.gs-hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gs-hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgb(17 17 17 / 66%), transparent 62%);
}

.gs-hero-content {
  position: relative;
  max-width: 34rem;
}

/* 左右緣的切換箭頭只在桌機出現；手機靠頁尾的「下一個系列」卡片與回首頁按鈕導覽 */
.gs-side {
  display: none;
}

@media (min-width: 1024px) {
  .gs-side {
    display: block;
  }

  .gs-arrow {
    position: fixed;
    top: 50%;
    z-index: 30;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-full);
    background: rgb(250 247 241 / 88%);
    color: var(--color-ink);
    transform: translateY(-50%);
    backdrop-filter: blur(8px);
    transition:
      background-color 250ms var(--ease-standard),
      color 250ms var(--ease-standard);
  }

  .gs-arrow:hover,
  .gs-arrow:focus-visible {
    background: var(--color-ink);
    color: var(--color-paper);
  }

  .gs-arrow-prev {
    left: clamp(12px, 2vw, 28px);
  }

  .gs-arrow-next {
    right: clamp(12px, 2vw, 28px);
  }
}

.gs-outro {
  padding: 24px 24px clamp(64px, 12vh, 128px);
  text-align: center;
}

.gs-next {
  position: relative;
  display: block;
  width: min(92vw, 640px);
  margin: 20px auto 0;
  overflow: hidden;
  border-radius: var(--radius);
}

.gs-next-img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  transition: transform 400ms var(--ease-emphasized);
}

.gs-next:hover .gs-next-img,
.gs-next:focus-visible .gs-next-img {
  transform: scale(1.03);
}

.gs-next:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 4px;
}

.gs-next-label {
  display: block;
  padding: 16px 20px 4px;
}
</style>
