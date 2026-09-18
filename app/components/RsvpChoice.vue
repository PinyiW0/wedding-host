<!-- app/components/RsvpChoice.vue — 回函卡的勾選項（issue #168）
     這張表單是夾在喜帖裡的回函卡（喜帖頁 /invite 是同一個實體的另一半），
     所以選中不是「按鈕換底色」，是「空框被人用筆勾起來」：
       未選＝印在紙上的空框（ink-500 對紙 5.39:1）
       選中＝加一道手繪勾（ink 對紙 17.66:1）＋字重 300→600
     完全不填底色——設計者 09-18 指出原本的墨底白字與淡金底都太重。
     三個訊號並存（勾記／字重／框色），不只靠顏色，符合 WCAG 1.4.11。 -->
<script setup lang="ts">
const props = defineProps<{ selected: boolean }>()
</script>

<template>
  <button
    type="button"
    :aria-pressed="props.selected ? 'true' : 'false'"
    class="flex min-h-12 items-start gap-3 text-left font-serif-tc text-body-l transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
    :class="props.selected ? 'font-semibold text-ink' : 'font-normal text-ink-700 hover:text-gold-deep'"
  >
    <!-- 框與勾同一張圖；勾故意畫出框外，像筆沒對準（需 overflow-visible 才露得出來） -->
    <svg class="mt-1.5 size-5 shrink-0 overflow-visible" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" class="stroke-ink-500" stroke-width="1.25" />
      <path
        v-if="props.selected"
        d="M3.6 10.2C5.1 11.9 6.3 13.6 7.4 15.6C10.2 10.6 14.4 5.4 20.6 -0.4"
        class="stroke-ink"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span class="pt-0.5 leading-snug"><slot /></span>
  </button>
</template>
