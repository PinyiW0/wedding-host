<!-- app/components/story/StoryDoodles.vue — 故事一頁上散落的小貼紙：手繪金星與愛心（新人提供的 SVG，改成內聯吃 currentColor），
     外加那只粉色水彩蝴蝶結，以及第 3 頁那條一筆畫的愛心線。
     每一張貼哪裡、多大，都由內容層帶進來（位置照該頁的設計稿量），本元件只負責畫。
     只在桌機出現：手機一屏要先留給文字、站與照片，貼紙擠進去只會讓照片縮得更小。
     出場跟著同一頁的拼貼件走：軌道停穩（is-settled）後排在照片之後落下，不做持續動畫——它們是貼在紙上的貼紙，不是要動的東西。
     2026-09-15 起內容層只用蝴蝶結與愛心線；金星金心的圖形留著，放回 kind 就能救回。
     愛心線原本是紅色（全頁手繪的東西都是金色、只有它是紅），同一天改成金色；
     試過改成從她的迴紋針拉到他的迴紋針、中段掛小愛心的相片繩，新人覺得怪，形狀維持原本的愛心。 -->
<script setup lang="ts">
import type { StoryDoodle } from '~/types/story'

defineProps<{ items: StoryDoodle[] }>()

/** 每種貼紙的原始比例，用來由寬度推高度（素材的 viewBox） */
const RATIO: Record<StoryDoodle['kind'], string> = {
  'bow': '326 / 267',
  'star-a': '36 / 36',
  'star-b': '43 / 38',
  'star-c': '26 / 25',
  'heart-l': '52 / 59',
  'heart-r': '52 / 59',
  'heart-line': '155 / 120',
}

function spotStyle(d: StoryDoodle, i: number) {
  return {
    'left': `${d.x}%`,
    'top': `${d.y}%`,
    'width': `${d.w}%`,
    'aspectRatio': RATIO[d.kind],
    '--i': 6 + i,
  }
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
    <template v-for="(d, i) in items" :key="`${d.kind}-${i}`">
      <img
        v-if="d.kind === 'bow'"
        src="/images/story/bow.webp"
        alt=""
        loading="lazy"
        width="326"
        height="267"
        class="reveal doodle"
        :style="spotStyle(d, i)"
      >
      <!-- 星星三種形狀，實心金；由 kind 決定用哪一顆，不重複用同一顆 -->
      <svg v-else-if="d.kind === 'star-a'" class="reveal doodle text-gold-light" :style="spotStyle(d, i)" viewBox="0 0 36 36" fill="none">
        <path d="M13.4572 1.00004L12.8942 11.7105L0.999992 17.6575L11.1373 21.5281L12.9623 34.0244L20.9705 23.3161L34.9712 24.5102L26.0051 14.0945L33.1235 4.57593L21.8149 7.25034L13.4572 1.00004Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      </svg>
      <svg v-else-if="d.kind === 'star-b'" class="reveal doodle text-gold-light" :style="spotStyle(d, i)" viewBox="0 0 43 38" fill="none">
        <path d="M31.75 1L21.5 7.85714L7.83333 1L11.25 13L1 23.2857H16.375L24.9167 37L28.3333 21.5714H42L31.75 13V1Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      </svg>
      <svg v-else-if="d.kind === 'star-c'" class="reveal doodle text-gold-light" :style="spotStyle(d, i)" viewBox="0 0 26 25" fill="none">
        <path d="M10.5214 8.68182L12.415 2L14.3087 8.68182H24.0001L18.0959 14.4091L20.9363 22.0455L12.415 16.3182L4.84054 23L8.62779 14.4091L2.00011 9.63636L10.5214 8.68182Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round" />
      </svg>
      <!-- 一筆畫的金色愛心，把兩張拍立得連起來：走到這一頁時線自己描出來。
           座標直接用設計稿的像素當 viewBox，數字才對得回原圖 -->
      <svg v-else-if="d.kind === 'heart-line'" class="reveal doodle heart-line text-gold-deep" :style="spotStyle(d, i)" viewBox="375 180 155 120" fill="none">
        <path
          d="M412 285C425 278 434 272 441 266C455 256 468 248 472 232C480 205 462 186 448 196C438 203 432 212 429 221C424 206 412 196 402 202C386 212 380 234 390 248C400 258 420 262 441 266C470 272 500 268 522 262"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <!-- 兩個手繪愛心互為鏡像，描邊不填色，跟時間軸上的實心愛心分得開 -->
      <svg v-else-if="d.kind === 'heart-l'" class="reveal doodle text-gold-light" :style="spotStyle(d, i)" viewBox="0 0 52 59" fill="none">
        <path d="M21.2146 7.94686C24.0146 17.9469 18.3812 28.4469 15.2146 32.4469C17.2146 29.9468 44.7146 10.4469 47.2146 26.9469C49.2146 40.1469 21.7146 53.1136 7.71457 57.9469C3.71457 45.9469 4.71457 24.6135 5.71457 15.4469C6.21457 0.946862 17.7146 -4.55314 21.2146 7.94686Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        <path d="M18.2146 1.4469C33.4146 3.4469 24.5479 23.9469 18.2146 33.9469C28.1346 25.1469 36.6812 21.9469 39.7146 21.4469C43.7146 19.9469 52.2146 22.9469 50.7146 31.9469C49.5146 39.1469 23.2146 51.6136 10.2146 56.9469L4.71456 41.9469C-6.08544 9.5469 9.21456 1.4469 18.2146 1.4469Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      </svg>
      <svg v-else class="reveal doodle text-gold-light" :style="spotStyle(d, i)" viewBox="0 0 52 59" fill="none">
        <path d="M30.6753 7.94686C27.8753 17.9469 33.5087 28.4469 36.6753 32.4469C34.6753 29.9468 7.17535 10.4469 4.67535 26.9469C2.67535 40.1469 30.1753 53.1136 44.1753 57.9469C48.1753 45.9469 47.1753 24.6135 46.1753 15.4469C45.6753 0.946862 34.1753 -4.55314 30.6753 7.94686Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        <path d="M33.6754 1.4469C18.4754 3.4469 27.342 23.9469 33.6754 33.9469C23.7554 25.1469 15.2087 21.9469 12.1754 21.4469C8.17535 19.9469 -0.324646 22.9469 1.17535 31.9469C2.37535 39.1469 28.6754 51.6136 41.6754 56.9469L47.1754 41.9469C57.9754 9.5469 42.6754 1.4469 33.6754 1.4469Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      </svg>
    </template>
  </div>
</template>

<style scoped>
/* 位置是拼貼台的百分比，量到的是中心點，所以用 translate 退回一半；
   高度交給 aspect-ratio 由素材比例決定，圖不會被壓扁 */
.doodle {
  position: absolute;
  height: auto;
  translate: -50% -50%;
  transition:
    opacity 0.6s var(--ease-standard),
    transform 0.6s var(--ease-standard);
  transition-delay: calc(var(--i, 0) * 90ms);
}
/* 出場與同一頁的拼貼件同一套（StorySlide 的 scoped 規則管不到子元件裡的元素，這裡自己寫一份）：
   JS 接管且軌道還沒停在這一頁才先藏，停穩了依 --i 接在照片之後落下 */
.is-live:not(.is-settled) .doodle {
  opacity: 0;
  transform: translateY(14px);
}

/* 金色愛心線：走到這一頁時一筆描出來。
   這是唯一一個不走 transform／opacity 的動畫（creative-direction §4）——
   「線自己畫出來」只能動 stroke-dashoffset，改用 transform 做不到這件事。
   它是 paint 層、單一元素、只跑一次，代價與淡入同級。
   440 是這條 path 的長度取整後留餘裕，比實際長一點只會讓起筆多空半拍。 */
.heart-line path {
  stroke-dasharray: 440;
  stroke-dashoffset: 440;
}
.is-settled .heart-line path {
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 1.4s var(--ease-standard) 0.6s;
}
/* 沒有 JS（SSR／翻頁沒接管）時本來就是終態，線要在位；
   reduced-motion 由 main.css 的全域 guard 把 transition 收成瞬間，終點一樣是畫好的線 */
.slide:not(.is-live) .heart-line path {
  stroke-dashoffset: 0;
}
</style>
