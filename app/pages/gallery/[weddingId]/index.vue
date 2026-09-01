<!-- app/pages/gallery/[weddingId]/index.vue — 公開婚紗相簿首頁
     由入口頁（/invite/[weddingId]）的拍立得導入。內容為單一婚禮的靜態照片（見 useGalleryContent）。
     結構：開場動畫（client-only 疊層）→ hero →三個系列區塊 → 出口。
     開場疊層之下的內容 SSR 完整輸出，沒有 JS 或開啟「減少動態」時直接看到靜態全頁。 -->
<script setup lang="ts">
definePageMeta({ layout: 'story' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const content = useGalleryContent()

/** 開場是否還在演；true 時把底部導覽收起來，不跟開場搶畫面 */
const isOpening = ref(true)

function anchorId(slug: string): string {
  return `series-${slug}`
}

const navItems = computed(() =>
  content.series.map(series => ({ label: series.title, href: `#${anchorId(series.slug)}` })),
)

useSeoMeta({
  title: '婚紗照 — Alex & Lele',
  description: content.description,
  ogTitle: '婚紗照 — Alex & Lele',
  ogDescription: content.description,
  ogImage: content.hero.src,
})
</script>

<template>
  <div class="gallery-page bg-paper">
    <ClientOnly>
      <GalleryPreloader
        :montage="content.montage"
        :hero="content.hero"
        @done="isOpening = false"
      />
    </ClientOnly>

    <GalleryHero
      :hero="content.hero"
      :first-series-id="anchorId(content.series[0]!.slug)"
    />

    <GallerySeriesShowcase
      v-for="series in content.series"
      :key="series.slug"
      :series="series"
      :anchor-id="anchorId(series.slug)"
      :to="`/gallery/${weddingId}/${series.slug}`"
    />

    <footer class="gp-outro">
      <p class="text-overline uppercase text-gold-deep">
        {{ content.eyebrow }}
      </p>
      <p class="mx-auto mt-4 max-w-xl text-body-l text-ink-500">
        {{ content.description }}
      </p>
      <nav class="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center" aria-label="其他頁面">
        <UButton :to="`/invite/${weddingId}`" size="xl" color="neutral" variant="outline">
          回到喜帖
        </UButton>
        <UButton :to="`/story/${weddingId}`" size="xl" color="primary">
          看我們的故事
        </UButton>
      </nav>
    </footer>

    <GalleryStickyNav v-show="!isOpening" :items="navItems" />

    <MusicToggle :src="content.music.src" />
  </div>
</template>

<style scoped>
/* hero 與開場動畫的落點共用同一圈紙色邊框寬度；自訂屬性會沿 DOM 繼承給兩個子元件 */
.gallery-page {
  --gallery-frame: clamp(10px, 2.4vw, 26px);

  position: relative;
}

.gp-outro {
  padding: 96px 24px 132px;
  text-align: center;
}

@media (min-width: 1024px) {
  .gp-outro {
    padding-block: 128px 160px;
  }
}
</style>
