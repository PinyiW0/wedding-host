<!-- app/pages/gallery/[weddingId]/index.vue — 公開婚紗相簿首頁
     由入口頁（/invite/[weddingId]）的拍立得導入。內容為單一婚禮的靜態照片（見 useGalleryContent）。
     結構：開場動畫（client-only 疊層）→ hero → 一行名字 → 三個系列區塊 → 出口。
     開場疊層之下的內容 SSR 完整輸出，沒有 JS 或開啟「減少動態」時直接看到靜態全頁。 -->
<script setup lang="ts">
definePageMeta({ layout: 'story' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const content = useGalleryContent()

/** 開場是否還在演；true 時把選單收起來，不跟開場搶畫面 */
const isOpening = ref(true)

// 頁尾逐行入場：整頁每個區塊都是捲動觸發，只有頁尾原本是「捲到就在那裡」。
// data-anim 在 onMounted 才掛上——沒有 JS 時屬性不存在，文字一律直接顯示。
const outroRef = ref<HTMLElement | null>(null)
const animReady = ref(false)
const outroIn = ref(false)

/** 句尾的句號 */
const FULL_STOP = /。$/

/** 頁尾收尾句拆成子句：手機一句一行、不帶標點；桌機仍是完整一句。
    同一份 DOM 兩種排法，標點只是在手機上被藏起來，螢幕閱讀器聽到的還是完整句子 */
const outroClauses = computed(() => content.outro.replace(FULL_STOP, '').split('，'))

const { register } = useScrollProgress()

function anchorId(slug: string): string {
  return `series-${slug}`
}

onMounted(() => {
  animReady.value = true
  register(outroRef.value, {
    varName: '--gt',
    mode: 'travel',
    // 頁尾在文件最底，捲到底時 travel 進度只到 0.22 左右，門檻要壓在那之下
    onProgress: (p) => {
      if (p > 0.14)
        outroIn.value = true
    },
  })
})

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
        :together-since="content.togetherSince"
        @done="isOpening = false"
      />
    </ClientOnly>

    <GalleryHero :hero="content.hero" />

    <GalleryInterlude :words="content.interludes" />

    <PublicMenu v-show="!isOpening" :wedding-id="weddingId" series-anchors />

    <GallerySeriesShowcase
      v-for="(series, i) in content.series"
      :key="series.slug"
      :series="series"
      :anchor-id="anchorId(series.slug)"
      :to="`/gallery/${weddingId}/${series.slug}`"
      :layout="i"
    />

    <footer
      ref="outroRef"
      class="gp-outro"
      :data-anim="animReady ? 'true' : 'false'"
      :data-in="outroIn ? 'true' : 'false'"
    >
      <img
        :src="content.outroArt"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        class="gp-line gp-art"
        :style="{ '--i': '0' }"
      >
      <p class="gp-line text-overline uppercase text-gold-deep" :style="{ '--i': '1' }">
        {{ content.eyebrow }}
      </p>
      <p class="gp-line mx-auto mt-4 max-w-xl text-body-l text-ink-500" :style="{ '--i': '2' }">
        <span v-for="(clause, i) in outroClauses" :key="i" class="gp-clause">{{ clause }}<span class="gp-punct">{{ i < outroClauses.length - 1 ? '，' : '。' }}</span></span>
      </p>
      <!-- 選單靠 JS，這行純文字連結是 JS 沒跑起來時唯一的出口，不能拿掉 -->
      <nav class="gp-line gp-links" :style="{ '--i': '3' }" aria-label="其他頁面">
        <NuxtLink :to="`/invite/${weddingId}`" class="gp-link">
          前往喜帖
        </NuxtLink>
        <span class="gp-sep" aria-hidden="true">·</span>
        <NuxtLink :to="`/story/${weddingId}`" class="gp-link">
          我們的故事
        </NuxtLink>
      </nav>
    </footer>

    <!-- 玫瑰花瓣：從城市那一段開始灑，一路掉到頁尾 -->
    <GalleryPetals anchor="series-city" />

    <MusicToggle :src="content.music.src" />
    <PublicBackToTop />
    <GalleryCursor />
  </div>
</template>

<style scoped>
/* hero 與開場動畫的落點共用這個值；自訂屬性會沿 DOM 繼承給兩個子元件。
   0＝hero 滿版出血（新人指定）。開場最後那張放大到的幾何位置也吃這個值，
   兩邊一起改才會在放大結束時無縫重合——要把紙色外框加回來就只動這一行 */
.gallery-page {
  --gallery-frame: 0px;

  position: relative;
}

.gp-outro {
  padding: 96px 24px 132px;
  text-align: center;
}

/* 逐行入場，step 120ms。沒有 data-anim（無 JS）時這條不成立＝文字直接顯示 */
.gp-line {
  transition:
    opacity 700ms var(--ease-standard),
    transform 700ms var(--ease-emphasized);
  transition-delay: calc(var(--i, 0) * 120ms);
}

.gp-outro[data-anim="true"][data-in="false"] .gp-line {
  opacity: 0;
  transform: translateY(20px);
}

/* 關掉動效時捲動引擎不啟動、data-in 永遠是 false，這裡要把它救回來 */
@media (prefers-reduced-motion: reduce) {
  .gp-outro[data-anim="true"][data-in="false"] .gp-line {
    opacity: 1;
    transform: none;
  }
}

/* 收尾的水彩插圖，站在 Wedding Gallery 眉標上方。跟著頁尾一起逐行升起 */
.gp-art {
  display: block;
  width: auto;
  height: clamp(150px, 24vh, 260px);
  margin: 0 auto 32px;
  object-fit: contain;
}

/* 原本是兩顆 UButton（後台元件），跟這頁的編輯風格是兩套語言。
   改成一行細字連結——功能一樣，但不搶焦點 */
/* 手機：一個子句一行、標點收掉（新人指示）。桌機還原成一整句 */
.gp-clause {
  display: block;
}

.gp-punct {
  display: none;
}

@media (min-width: 640px) {
  .gp-clause {
    display: inline;
  }

  .gp-punct {
    display: inline;
  }
}

.gp-links {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 14px;
  margin-top: 44px;
  font-size: var(--text-body);
}

.gp-link {
  padding-bottom: 3px;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink-500);
  transition:
    color 250ms var(--ease-standard),
    border-color 250ms var(--ease-standard);
}

.gp-link:hover,
.gp-link:focus-visible {
  color: var(--color-ink);
  border-color: var(--color-gold);
}

.gp-link:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 4px;
}

.gp-sep {
  color: var(--color-ink-300);
}

@media (min-width: 1024px) {
  .gp-outro {
    padding-block: 128px 160px;
  }
}
</style>
