<!-- app/pages/thankyou/[weddingId]/[guestId].vue — 賓客公開謝卡（信封開封 + 花田裝飾，RWD） -->
<script setup lang="ts">
import { getPublicThankYouCard, listFlowers } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
const guestId = computed(() => String(route.params.guestId))

const { data: card } = await getPublicThankYouCard(weddingId, guestId, { default: () => null })

// 花田裝飾（取樣少量、非互動）
const { data: flowers } = await listFlowers(weddingId, { default: () => [] })
const flowerList = computed(() => flowers.value ?? [])

// 信封開封狀態
const opened = ref(false)
function openEnvelope() {
  opened.value = true
}

// 金箔圓印：取署名前兩字
const seal = computed(() => (card.value?.signature || '囍').slice(0, 2))
</script>

<template>
  <div data-testid="thankyou-public-page" class="flex min-h-[70vh] flex-col items-center justify-center py-6">
    <!-- 信封（未開封） -->
    <Transition name="envelope" mode="out-in">
      <div v-if="!opened" key="envelope" class="flex flex-col items-center">
        <button
          type="button"
          data-testid="thankyou-envelope"
          aria-label="開啟你的專屬謝卡"
          class="group relative h-52 w-80 max-w-full rounded-lg border border-gold/40 bg-paper shadow-lg transition-transform duration-300 hover:-translate-y-1"
          @click="openEnvelope"
        >
          <!-- 信封封蓋（三角） -->
          <span
            class="pointer-events-none absolute inset-x-0 top-0 mx-auto h-0 w-0"
            style="border-left: 160px solid transparent; border-right: 160px solid transparent; border-top: 104px solid var(--color-paper-soft, #f3ede3)"
          />
          <span class="pointer-events-none absolute inset-2 rounded border border-gold/20" />
          <!-- 郵票（囍） -->
          <span class="pointer-events-none absolute right-3 top-3 z-10 flex size-9 items-center justify-center border border-gold/40 bg-paper font-display text-body text-gold-deep">
            囍
          </span>
          <!-- 蠟印 -->
          <span class="absolute left-1/2 top-1/2 z-10 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold-light font-display text-body-l font-semibold text-gold-deep shadow">
            {{ seal }}
          </span>
        </button>
        <p class="mt-6 text-body-l text-ink-500">
          {{ card?.guestName ? `親愛的 ${card.guestName}，` : '' }}有一封專屬謝卡要給您
        </p>
        <p class="mt-1 text-caption text-ink-300">
          輕觸信封開啟
        </p>
      </div>

      <!-- 謝卡（開封後滑出；內文元素兩拍錯落淡入） -->
      <div v-else key="card" class="card-wrap relative w-full max-w-xl">
        <div data-testid="thankyou-card">
          <ThankYouCardPreview
            :greeting="card?.greeting"
            :guest-name="card?.guestName"
            :content="card?.content"
            placeholder="謝謝您與我們一同見證這份幸福，您的祝福我們銘記在心。"
            :signature="card?.signature"
            :signature-date="card?.signatureDate"
            :image-url="card?.templateImageUrl"
            :seal="seal"
          />
        </div>

        <!-- 花田裝飾：右下一叢，與 RSVP 花田統一套系 -->
        <div
          v-if="flowerList.length > 0"
          class="pointer-events-none absolute -bottom-6 -right-2 z-20 w-44 opacity-60"
        >
          <FlowerField :flowers="flowerList" :max="4" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 開封過渡：信封封蓋向後翻起淡出、謝卡上滑淡入 */
.envelope-enter-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.envelope-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
  transform-origin: top;
}
.envelope-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.96);
}
.envelope-leave-to {
  opacity: 0;
  transform: rotateX(18deg) scale(0.94);
}

/* 第二拍：信箋內文元素錯落淡入 */
.card-wrap :deep(.ty-card-body > *) {
  animation: card-item-in 0.5s ease both;
}
.card-wrap :deep(.ty-card-body > *:nth-child(2)) {
  animation-delay: 0.1s;
}
.card-wrap :deep(.ty-card-body > *:nth-child(3)) {
  animation-delay: 0.18s;
}
.card-wrap :deep(.ty-card-body > *:nth-child(4)) {
  animation-delay: 0.26s;
}
.card-wrap :deep(.ty-card-body > *:nth-child(5)) {
  animation-delay: 0.34s;
}
@keyframes card-item-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
