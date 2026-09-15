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

// 首圖沿用 landing hero 的捲動語彙：往下捲時照片推近、標題退場、暗角壓上來
const heroRef = ref<HTMLElement | null>(null)
const { register } = useScrollProgress()

onMounted(() => {
  register(heroRef.value, { varName: '--hp', mode: 'leave' })
})

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
    <header ref="heroRef" class="gs-hero" :style="{ '--cover-focus': series.coverFocus }">
      <img :src="series.cover" :alt="coverAlt" class="gs-hero-img" fetchpriority="high">
      <div class="gs-hero-scrim" aria-hidden="true" />
      <div class="gs-hero-shade" aria-hidden="true" />
      <div class="gs-hero-content">
        <p class="text-overline uppercase">
          {{ series.word }}
        </p>
        <h1 class="mt-4 font-display text-h1 lg:text-display-l">
          {{ series.title }}
        </h1>
        <p class="mt-4 text-body-l">
          {{ series.description }}
        </p>
        <p class="gs-hero-line">
          {{ content.seriesLine }}
        </p>
      </div>
    </header>

    <GallerySeriesFlow :photos="series.photos" />

    <nav v-if="neighbours" class="gs-side" aria-label="切換系列">
      <NuxtLink
        :to="seriesPath(neighbours.prev.slug)"
        class="gs-nav gs-nav-prev"
        :aria-label="`上一個系列：${neighbours.prev.title}`"
      >
        <svg class="gs-nav-mark" viewBox="0 0 88 12" aria-hidden="true">
          <path class="gs-nav-shaft" d="M12 6 H86" />
          <path class="gs-nav-head" d="M20 1.5 L12 6 L20 10.5" />
        </svg>
        <span class="gs-nav-name">{{ neighbours.prev.title }}</span>
      </NuxtLink>
      <NuxtLink
        :to="seriesPath(neighbours.next.slug)"
        class="gs-nav gs-nav-next"
        :aria-label="`前往下一篇故事：${neighbours.next.title}`"
      >
        <svg class="gs-nav-mark" viewBox="0 0 88 12" aria-hidden="true">
          <path class="gs-nav-shaft" d="M76 6 H2" />
          <path class="gs-nav-head" d="M68 1.5 L76 6 L68 10.5" />
        </svg>
        <span class="gs-nav-name">{{ neighbours.next.title }}</span>
      </NuxtLink>
    </nav>

    <footer v-if="neighbours" class="gs-outro">
      <p class="text-overline uppercase text-gold-deep">
        NEXT CHAPTER
      </p>
      <p class="mt-2 text-body text-ink-500">
        {{ content.nextHint }}
      </p>
      <NuxtLink :to="seriesPath(neighbours.next.slug)" class="gs-next" data-cursor="Next">
        <img :src="neighbours.next.preview" alt="" class="gs-next-img">
        <span class="gs-next-label">
          <span class="font-display text-h2">{{ neighbours.next.title }}</span>
          <span class="mt-1 block text-body text-ink-500">{{ neighbours.next.word }}</span>
        </span>
      </NuxtLink>

      <!-- 選單靠 JS，這行純文字連結是 JS 沒跑起來時唯一的出口，不能拿掉 -->
      <nav class="gs-links" aria-label="其他頁面">
        <NuxtLink :to="`/gallery/${weddingId}`" class="gs-link">
          回相簿入口
        </NuxtLink>
        <span class="gs-sep" aria-hidden="true">·</span>
        <NuxtLink :to="`/story/${weddingId}`" class="gs-link">
          我們的故事
        </NuxtLink>
      </nav>
    </footer>

    <PublicMenu :wedding-id="weddingId" />
    <MusicToggle :src="content.music.src" />
    <PublicBackToTop />
    <GalleryCursor />
  </div>
</template>

<style scoped>
/* 原本是兩顆 UButton（後台元件），跟這頁的編輯風格是兩套語言，改成一行細字連結 */
.gs-links {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 14px;
  margin-top: 48px;
  font-size: var(--text-body);
}

.gs-link {
  padding-bottom: 3px;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink-500);
  transition:
    color 250ms var(--ease-standard),
    border-color 250ms var(--ease-standard);
}

.gs-link:hover,
.gs-link:focus-visible {
  color: var(--color-ink);
  border-color: var(--color-gold);
}

.gs-link:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 4px;
}

.gs-sep {
  color: var(--color-ink-300);
}

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
  object-position: center var(--cover-focus, 50%);
  /* 沿用 landing hero 的語彙：往下捲時照片微微推近 */
  transform: scale(calc(1 + var(--hp, 0) * 0.08));
}

.gs-hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgb(17 17 17 / 66%), transparent 62%);
}

/* 光影：首圖捲出去的過程暗角收攏上來，和照片流的聚光是同一套語彙 */
.gs-hero-shade {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 92% at 50% 46%, transparent 34%, rgb(17 17 17 / 72%) 100%);
  opacity: calc(var(--hp, 0) * 0.9);
}

.gs-hero-content {
  position: relative;
  max-width: 34rem;
  transform: translateY(calc(var(--hp, 0) * -12vh));
  opacity: calc(1 - var(--hp, 0) * 1.5);
}

.gs-hero-line {
  margin-top: 18px;
  font-family: var(--font-display);
  font-size: var(--text-body-l);
  font-style: italic;
  letter-spacing: 0.04em;
  opacity: 0.86;
}

/* 左右緣的切換箭頭只在桌機出現；手機靠頁尾的「下一個系列」卡片與回首頁按鈕導覽。
   不用圓框 chevron：改成一支細線從箭頭尖端長出來，hover 時線延伸、系列名跟著滑進來。
   墨色配紙色暈邊，壓在紙上或照片上都讀得到。 */
.gs-side {
  display: none;
}

@media (min-width: 1024px) {
  .gs-side {
    display: block;
  }

  .gs-nav {
    position: fixed;
    top: 50%;
    z-index: 30;
    display: flex;
    align-items: center;
    /* 線本身只有 12px 高，靠上下留白把可點區撐到 48px */
    padding-block: 18px;
    color: var(--color-ink);
    transform: translateY(-50%);
  }

  .gs-nav-prev {
    left: clamp(12px, 2vw, 28px);
  }

  .gs-nav-next {
    right: clamp(12px, 2vw, 28px);
  }

  .gs-nav-mark {
    display: block;
    width: 88px;
    height: 12px;
    overflow: visible;
    fill: none;
    stroke: currentcolor;
    stroke-width: 1;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter:
      drop-shadow(0 0 5px var(--color-paper))
      drop-shadow(0 0 12px var(--color-paper));
  }

  /* 線的路徑從箭頭尖端起算，dashoffset 收起來時只露出靠近尖端的一小截 */
  .gs-nav-shaft {
    stroke-dasharray: 74;
    stroke-dashoffset: 50;
    transition: stroke-dashoffset 400ms var(--ease-emphasized);
  }

  .gs-nav:hover .gs-nav-shaft,
  .gs-nav:focus-visible .gs-nav-shaft {
    stroke-dashoffset: 0;
  }

  /* 系列名絕對定位：不佔版面寬度，收合時也不會把箭頭推走 */
  .gs-nav-name {
    position: absolute;
    top: 50%;
    font-family: var(--font-display);
    font-size: var(--text-body-l);
    letter-spacing: 0.08em;
    white-space: nowrap;
    text-shadow:
      0 0 6px var(--color-paper),
      0 0 16px var(--color-paper);
    opacity: 0;
    transition:
      opacity 250ms var(--ease-standard),
      transform 400ms var(--ease-emphasized);
  }

  .gs-nav-prev .gs-nav-name {
    left: 100%;
    margin-left: 14px;
    transform: translateY(-50%) translateX(-10px);
  }

  .gs-nav-next .gs-nav-name {
    right: 100%;
    margin-right: 14px;
    transform: translateY(-50%) translateX(10px);
  }

  .gs-nav:hover .gs-nav-name,
  .gs-nav:focus-visible .gs-nav-name {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }

  .gs-nav:focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 6px;
    border-radius: var(--radius);
  }
}

.gs-outro {
  padding: 24px 24px clamp(64px, 12vh, 128px);
  text-align: center;
}

/* 不鎖 16:9：33 張裡只有 9 張是橫式，硬套固定比例會把直式那幾張裁到只剩一條。
   改成保留原比例、用高度封頂，橫直式都完整看得到。 */
.gs-next {
  position: relative;
  display: inline-block;
  margin: 20px auto 0;
  overflow: hidden;
  border-radius: var(--radius);
  vertical-align: top;
}

.gs-next-img {
  display: block;
  width: auto;
  height: auto;
  max-width: min(92vw, 640px);
  max-height: 52vh;
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
