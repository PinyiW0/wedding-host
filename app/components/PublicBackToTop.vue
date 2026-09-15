<!-- app/components/PublicBackToTop.vue — 公開頁右下角的「回到最上方」
     一顆奶油色的小膠囊：左邊一支細箭頭、右邊寫 Scroll up。
     原本的決定是「沒有圓鈕、沒有底色」，靠 mix-blend-mode: difference 讓線在照片上翻白、在紙上翻黑——
     2026-09-15 實測推翻：這顆是浮在內容上的 fixed 元素，手機捲到花田標題時 Scroll up 直接壓在「Bloom」上，
     捲到當天流程（深色照片配灰藍天空）時 difference 算出來是中灰，整顆看不見。純文字沒有底就沒有可讀的保證，
     所以加一層 90% 的 cream 底與一圈 line 細框：在紙色區塊上只是淡淡一塊、在照片上是一枚看得見的小章。
     捲出第一個視窗（＝滾出 hero）之後才出現，之前完全不佔位、也點不到。
     桌機疊在金唱片（MusicToggle，桌機 fixed bottom-6 right-6、size-12）正上方，bottom 用唱片的尺寸算出來、右緣與唱片對齊；
     手機的唱片 09-15 移到右上漢堡旁邊，右下角空出來，這顆直接落在角落。
     data-in 由捲動事件驅動：沒有 JS 時屬性永遠是 false，按鈕不會出現（它本來就只是捷徑）。
     hideOnDesktop：有些頁面桌機版有自己的翻頁／捲動控制（如 /story 的翻頁按鈕），
     這顆「回到最上方」在桌機反而多餘，只留給手機。 -->
<script setup lang="ts">
withDefaults(defineProps<{
  hideOnDesktop?: boolean
}>(), { hideOnDesktop: false })

const isVisible = ref(false)
let ticking = false

function update() {
  ticking = false
  isVisible.value = window.scrollY > window.innerHeight
}

function onScroll() {
  if (ticking)
    return
  ticking = true
  requestAnimationFrame(update)
}

function toTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

onMounted(() => {
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <button
    type="button"
    class="bt rounded-full bg-cream/90 ring-1 ring-line"
    :data-in="isVisible ? 'true' : 'false'"
    :data-hide-desktop="hideOnDesktop ? 'true' : 'false'"
    aria-label="回到頁面最上方"
    @click="toTop"
  >
    <svg class="bt-mark" viewBox="0 0 12 34" fill="none" aria-hidden="true">
      <path d="M6 34V2" stroke="currentColor" vector-effect="non-scaling-stroke" />
      <path d="M1.6 6.4 6 2l4.4 4.4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </svg>
    <span class="bt-label" aria-hidden="true">Scroll up</span>
  </button>
</template>

<style scoped>
.bt {
  /* 金唱片的尺寸與邊距：桌機這顆疊在唱片正上方，bottom 由唱片算出來；右緣與唱片右緣同一條線（都是 --edge）。
     膠囊是橫的，比唱片寬，不再對齊唱片中軸——中軸對齊會把膠囊推出螢幕右緣 */
  --disc: 2.75rem;
  --edge: 1.5rem;

  position: fixed;
  right: var(--edge);
  bottom: var(--edge);
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 12px;
  color: var(--color-ink);
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition:
    opacity 400ms var(--ease-standard),
    transform 400ms var(--ease-standard);
}

@media (min-width: 640px) {
  .bt {
    --disc: 3rem;
  }
}

.bt[data-in="true"] {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

@media (min-width: 64rem) {
  .bt {
    bottom: calc(var(--edge) + var(--disc) + 1rem);
  }
  .bt[data-hide-desktop="true"] {
    display: none;
  }
}

.bt:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 6px;
}

/* 一條線 + 頂端一個小箭頭。stroke 用 non-scaling-stroke，
   不管 SVG 縮到多小都維持 1px 髮絲線。高度縮到 20px，跟一行 10px 的字放在同一顆膠囊裡才不會頭重腳輕 */
.bt-mark {
  width: 8px;
  height: 20px;
  stroke-width: 1;
  transition: transform 300ms var(--ease-standard);
}

.bt[data-in="true"]:hover .bt-mark,
.bt[data-in="true"]:focus-visible .bt-mark {
  transform: translateY(-4px);
}

/* 10px：這是一個固定在角落的操作標記，不是內文，字級刻意壓在 overline 之下 */
.bt-label {
  font-size: var(--text-micro);
  line-height: 1;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  /* 字距會在最後一個字後面多留一格，扣掉右內距才對稱 */
  margin-right: -0.16em;
}
</style>
