<!-- app/pages/flowers/[weddingId].vue — 花田 landing（公開，RWD）：賓客手繪小花花圈 -->
<!-- 視覺：粉嫩春日、單一花田焦點；花朵載入時自土裡長出綻放（grow-bloom） -->
<script setup lang="ts">
import { listFlowers } from '~/api'

// 滿版春日底色，不用 guest layout 的窄容器；導覽列改由頁面自行掛 GuestNav
definePageMeta({ layout: false })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const { data: flowers } = await listFlowers(weddingId, { default: () => [] })
const flowerList = computed(() => flowers.value ?? [])
</script>

<template>
  <div data-testid="flower-field-page" class="spring-day flex min-h-screen flex-col">
    <!-- 導覽列直接掛在頁面上：layout: false 只是為了滿版，導覽仍與其他公開頁共用同一個元件 -->
    <GuestNav />

    <!-- 單一焦點：祝福花田 -->
    <main class="flex flex-1 items-center justify-center px-6 py-12 lg:py-16">
      <div class="w-full max-w-4xl">
        <p class="rise text-center text-overline uppercase text-rose-400" style="--i: 0">
          Flower Field · 祝福花田
        </p>
        <h1 class="rise mt-5 text-center font-display text-h1 font-semibold leading-tight text-rose-ink lg:text-display-l" style="--i: 1">
          每一朵花，都是一份祝福
        </h1>
        <p class="rise mt-4 text-center text-body-l text-ink-500" style="--i: 2">
          賓客回覆喜帖時親手畫下，慢慢種成了這片花田
        </p>

        <div
          class="rise craft-paper relative mt-10 rounded-sm bg-white/70 px-6 py-12 lg:px-12 lg:py-14"
          style="--i: 3"
        >
          <span class="pointer-events-none absolute inset-2 border border-rose-300/50" aria-hidden="true" />
          <span class="craft-corners pointer-events-none absolute inset-2 text-rose-300" aria-hidden="true" />
          <div class="field-grow">
            <FlowerField
              v-if="flowerList.length > 0"
              :flowers="flowerList"
              interactive
              layout="wreath"
            >
              <template #center>
                <div class="flex items-center justify-center gap-3">
                  <span class="h-px w-8 bg-rose-300/70" />
                  <span class="size-1.5 rotate-45 bg-rose-300" />
                  <span class="h-px w-8 bg-rose-300/70" />
                </div>
                <p class="mt-4 font-display text-h2 font-semibold text-rose-ink">
                  {{ flowerList.length }}
                </p>
                <p class="mt-1 text-overline uppercase text-ink-300">
                  朵祝福
                </p>
              </template>
            </FlowerField>
            <EmptyState
              v-else
              title="花田尚未綻放"
              description="當賓客在回覆時畫下小花，這片花田就會慢慢盛開"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 頁面進場（文字與框單拍上浮，step 80ms） */
.rise {
  animation: rise-in 400ms var(--ease-standard) both;
  animation-delay: calc(var(--i, 0) * 80ms);
}
@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

/* 花朵長出綻放：自根部冒出 → 過衝綻開 → 立定（origin 設花莖底部；step 90ms 逐朵） */
.field-grow :deep(.bloom-wrap) {
  transform-origin: 50% 96%;
  /* backwards：動畫結束即釋放 transform，hover 放大才不被 fill 蓋住 */
  animation: grow-bloom 700ms var(--ease-emphasized) calc(360ms + var(--i, 0) * 90ms) backwards;
}
@keyframes grow-bloom {
  0% {
    opacity: 0;
    transform: scale(0.05) rotate(-8deg);
  }
  45% {
    opacity: 1;
    transform: scale(0.55) rotate(4deg);
  }
  72% {
    transform: scale(1.12) rotate(-2deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

/* 春日粉嫩底：櫻粉晨光漸層＋細碎星塵 */
.spring-day {
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.85) 1px, transparent 1.6px),
    radial-gradient(circle at 72% 40%, rgba(242, 197, 209, 0.7) 1px, transparent 1.7px),
    linear-gradient(180deg, #fdf3f0 0%, #fae9ee 42%, #fdf5ef 100%);
  background-size: 230px 210px, 180px 240px, 100% 100%;
}
</style>
