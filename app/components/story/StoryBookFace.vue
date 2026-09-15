<!-- app/components/story/StoryBookFace.vue — 書的一面：整面照片，或紙色文字頁（標題、眉標、幾行字，可選一張鋪底的插畫）。
     這一面貼在書的哪裡、轉多少、疊在哪一層，都由 StoryBook 掛在根元素上的 class 與變數決定；這裡只畫內容。
     文字頁的進場沿用 StorySlide 的 .reveal（走到這一跨才浮出，翻頁本身是主動作，照片不另外動）。
     手機（lg 以下）兩面上下疊：照片面吃剩餘高度（cover、依 focus 裁）、文字面自適應；鋪底的插畫塞不下就不顯示。 -->
<script setup lang="ts">
import type { StoryBookPage } from '~/types/story'

const props = defineProps<{
  page: StoryBookPage
  /** 這一跨的標題與它的 h2 id；withTitle 為真的那一面排 h2（文字頁排成看得見的標題，照片頁只給讀屏） */
  title: string
  titleId: string
  withTitle: boolean
  /** 第一跨的照片先載（書一露面就要在），其餘懶載 */
  eager: boolean
}>()

/** 有沒有中日韓文字：拉丁標題（We’re getting married!）換展示字體用 */
const CJK = /[\u3400-\u9FFF]/

/** 標題是拉丁文字（We’re getting married!）就用展示字體（Cormorant），中文標題維持 Noto Serif TC */
const latinTitle = computed(() => !CJK.test(props.title))
/** 文字塊離頁頂多少（桌機才用；沒給就垂直置中） */
const copyStyle = computed(() => (props.page.kind === 'copy' && props.page.top !== undefined ? { '--copy-top': `${props.page.top}%` } : {}))
/** 照片的裁切重心 */
const photoStyle = computed(() => (props.page.kind === 'photo' && props.page.focus ? { objectPosition: `${props.page.focus.x}% ${props.page.focus.y}%` } : {}))
</script>

<template>
  <div v-if="page.kind === 'photo'" class="face face-photo">
    <h2 v-if="withTitle" :id="titleId" class="sr-only">
      {{ title }}
    </h2>
    <img
      :src="page.src"
      :alt="page.alt"
      :loading="eager ? 'eager' : 'lazy'"
      class="photo"
      :style="photoStyle"
    >
  </div>
  <div
    v-else
    class="face face-copy bg-cream"
    :class="{ 'at-top': page.top !== undefined, 'has-art': !!page.art }"
    :style="copyStyle"
  >
    <!-- 桌機插圖使用文字下方的剩餘空間，避免寬矮視窗裁切後與標題重疊。 -->
    <div v-if="page.art" class="art-frame">
      <img
        :src="page.art.src"
        :alt="page.art.alt"
        :loading="eager ? 'eager' : 'lazy'"
        class="art"
      >
    </div>
    <div class="copy">
      <!-- 標題上方的小插圖：與標題、內文排成一組，整組在頁面垂直置中。純裝飾（畫的是對頁照片），手機不顯示 -->
      <img
        v-if="page.vignette"
        :src="page.vignette.src"
        alt=""
        :width="page.vignette.width"
        :height="page.vignette.height"
        :loading="eager ? 'eager' : 'lazy'"
        class="reveal vignette mx-auto mb-8 hidden lg:block"
        style="--i: 0"
      >
      <!-- 標題與故事各頁同級（text-h3），眉標是它底下一行金色小型大寫的英文 -->
      <h2
        v-if="withTitle"
        :id="titleId"
        class="reveal font-semibold text-ink"
        :class="latinTitle ? 'font-display text-h2 tracking-wide' : 'font-serif-tc text-h3 tracking-wider'"
        style="--i: 0"
      >
        {{ title }}
      </h2>
      <p v-if="page.eyebrow" class="reveal mt-3 font-display text-body-l font-semibold uppercase tracking-widest text-gold-deep" style="--i: 1">
        {{ page.eyebrow }}
      </p>
      <!-- 沒有眉標的頁（氣球那頁）內文貼近標題一點（新人 09-14） -->
      <div class="reveal space-y-1 font-serif-tc text-body leading-loose tracking-wider text-ink-500" :class="page.eyebrow ? 'mt-6' : 'mt-2'" style="--i: 2">
        <!-- 空字串是段落間距（同 StorySlide） -->
        <template v-for="(line, i) in page.lines" :key="i">
          <p v-if="line === ''" class="h-4" aria-hidden="true" />
          <p v-else>
            {{ line }}
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.face {
  position: relative;
}
/* 照片鋪滿整面：絕對定位而不是 height: 100%，手機那個 flex: 1 的盒子高度才不會被圖撐開 */
.photo {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.face-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2rem 1.5rem;
  text-align: center;
}
.art {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 100%;
}
.copy {
  position: relative;
}
/* 小插圖跟著視窗高度縮放：矮螢幕不能把標題擠出頁面，高螢幕也不要大到變成這一頁的第二張照片 */
.vignette {
  width: auto;
  height: clamp(12rem, 36vh, 20rem);
}

/* 桌機：文字塊指定離頁頂多少（百分比要對頁高算，所以用 top 不用 padding——padding 的百分比是對寬算的） */
@media (width >= 64rem) {
  .at-top > .copy {
    position: absolute;
    top: var(--copy-top);
    right: 1.5rem;
    left: 1.5rem;
  }
  .face-copy.has-art {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    justify-content: normal;
    padding: clamp(2rem, 6vh, 4rem) 0 0;
  }
  .has-art > .copy {
    position: relative;
    inset: auto;
    grid-row: 1;
    padding: 0 2rem 1.5rem;
  }
  .has-art > .art-frame {
    position: relative;
    grid-row: 2;
    min-height: 0;
    overflow: hidden;
  }
  .has-art .art {
    inset: auto 0 0;
    height: 145%;
    object-fit: contain;
  }
}
/* 手機：插畫收掉（半屏塞不下）、文字一律置中 */
@media (width < 64rem) {
  .art-frame {
    display: none;
  }
}

/* 進場：JS 接管且還沒走到這一跨（StoryBook 掛的 is-live／is-drawn）才先藏；delay 與 StorySlide 同一套 */
.reveal {
  transition:
    opacity 0.6s var(--ease-standard),
    transform 0.6s var(--ease-standard);
  transition-delay: calc(200ms + var(--i, 0) * 120ms);
}
.is-live .spread:not(.is-drawn) .reveal {
  opacity: 0;
  transform: translateY(14px);
}
</style>
