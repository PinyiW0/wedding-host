<!-- app/components/story/StoryHeartDots.vue — 網點版的愛心：跟一對戒指同一套語言，灰金雙色的小圓點鋪成愛心、
     左上受光右下偏暗、每顆點底下一圈淡淡的墨暈。只用在「距離歸零」那一站合起來的那顆愛心，
     其他站與片刻的愛心仍是 StoryHeart 的實心版。尺寸由外部 class 給，跟 StoryHeart 一樣；
     點的位置是純函式算出來的（storyHeartDots.ts），沒有亂數，SSR 與 client 一致。 -->
<script setup lang="ts">
import { heartDots } from './storyHeartDots'

const props = withDefaults(defineProps<{
  /** 格距（viewBox 24 為整顆愛心）：桌機 48px 的用 1.7（≈ 3.4px，比戒指略密，48px 的愛心才讀得出形狀）、手機 28px 的用 1.4 */
  pitch?: number
}>(), { pitch: 1.7 })

/** 四階色調（暗 → 亮），對應戒指 canvas 讀的同四個 token */
const TONE_CLASS = ['fill-ink-500', 'fill-neutral-400', 'fill-gold-deep', 'fill-gold']

const dots = computed(() => heartDots(props.pitch))
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true" class="block">
    <!-- 紙色的實心底：把後面的金線切開，圓點是印在紙上的，不是浮在線上 -->
    <path
      class="fill-paper"
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
    />
    <!-- 墨暈：同色、大一圈、很淡，先畫在底下 -->
    <g opacity="0.12">
      <circle v-for="(d, i) in dots" :key="`halo-${i}`" :cx="d.x" :cy="d.y" :r="d.r * 1.9" :class="TONE_CLASS[d.tone]" />
    </g>
    <circle v-for="(d, i) in dots" :key="i" :cx="d.x" :cy="d.y" :r="d.r" :class="TONE_CLASS[d.tone]" />
  </svg>
</template>
