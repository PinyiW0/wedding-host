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
          <!-- 蠟印 -->
          <span class="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold-light font-display text-h3 font-semibold text-gold-deep shadow">
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

      <!-- 謝卡（開封後滑出） -->
      <div v-else key="card" class="w-full max-w-xl">
        <!-- 花田裝飾 -->
        <FlowerField
          v-if="flowerList.length > 0"
          :flowers="flowerList"
          :max="6"
          class="mb-4 opacity-90"
        />

        <article
          data-testid="thankyou-card"
          class="relative overflow-hidden rounded-lg bg-paper shadow-xl"
        >
          <span class="pointer-events-none absolute inset-2.5 z-10 rounded border border-gold/30" />
          <div v-if="card?.templateImageUrl" class="relative">
            <img :src="card.templateImageUrl" alt="" class="h-40 w-full object-cover">
            <span class="block h-px w-full bg-gold/50" />
          </div>
          <div class="relative flex flex-col items-center px-8 py-10 text-center">
            <p class="text-overline uppercase text-gold-deep">
              {{ card?.greeting }}
            </p>
            <div class="mt-6 flex size-14 items-center justify-center rounded-full bg-gold-light font-display text-body-l font-semibold text-gold-deep">
              {{ seal }}
            </div>
            <span class="my-6 h-px w-10 bg-gold" />
            <!-- 賓客稱呼（永遠帶入賓客名） -->
            <p class="font-display text-h3 font-semibold text-ink">
              親愛的 {{ card?.guestName }}
            </p>
            <p
              v-if="card?.content"
              class="mt-4 max-w-sm whitespace-pre-line text-body-l leading-relaxed text-ink-700"
            >
              {{ card.content }}
            </p>
            <p v-else class="mt-4 max-w-sm text-body-l leading-relaxed text-ink-500">
              謝謝您與我們一同見證這份幸福，您的祝福我們銘記在心。
            </p>
            <p class="mt-8 text-balance font-display text-h2 font-semibold leading-tight text-ink">
              {{ card?.signature }}
            </p>
            <p class="mt-2 text-caption tracking-widest text-ink-500">
              {{ card?.signatureDate }}
            </p>
          </div>
        </article>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 開封過渡：信封淡出縮小、謝卡淡入上滑 */
.envelope-enter-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.envelope-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.envelope-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.96);
}
.envelope-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
