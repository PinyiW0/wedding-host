<!-- app/pages/projection/[weddingId].vue — 投影即時牆（全螢幕深色，輪播 approved 祝福 + 賓客名 + emoji + 花圖裝飾） -->
<script setup lang="ts">
import { getWedding, listBlessings, listFlowers, listGuests } from '~/api'

definePageMeta({ layout: false })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const { data: wedding } = await getWedding(weddingId)
const coupleName = computed(() => {
  const g = wedding.value?.groomName
  const b = wedding.value?.brideName
  return g && b ? `${g} & ${b}` : (wedding.value?.title ?? '')
})

const { data: blessings, refresh: refreshBlessings } = await listBlessings(weddingId, {
  default: () => [],
})
const { data: guests } = await listGuests(weddingId, { default: () => [] })
const { data: flowers } = await listFlowers(weddingId, { default: () => [] })
const flowerList = computed(() => flowers.value ?? [])

// 只播已通過審核
const approved = computed(() => (blessings.value ?? []).filter(b => b.status === 'approved'))

function guestName(guestId: string): string {
  return (guests.value ?? []).find(g => g.guestId === guestId)?.name ?? '一位賓客'
}

// 輪播
const currentIndex = ref(0)
const current = computed(() => approved.value[currentIndex.value % Math.max(approved.value.length, 1)] ?? null)
let rotateTimer: ReturnType<typeof setInterval> | null = null

function next() {
  if (approved.value.length > 0)
    currentIndex.value = (currentIndex.value + 1) % approved.value.length
}

// 即時推送（BroadcastChannel + 短輪詢 fallback）
const { subscribe } = useProjectionChannel(weddingId)

onMounted(() => {
  // 自動輪播
  rotateTimer = setInterval(next, 7000)
  // 審核頁 approve / project → 即時重新載入
  subscribe(() => refreshBlessings())
})
onBeforeUnmount(() => {
  if (rotateTimer)
    clearInterval(rotateTimer)
})
</script>

<template>
  <div
    data-testid="projection-page"
    class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-950 px-8 py-12 text-center text-white"
  >
    <!-- 花圖裝飾（淡） -->
    <FlowerField
      v-if="flowerList.length > 0"
      :flowers="flowerList"
      :max="8"
      class="pointer-events-none absolute inset-x-0 top-0 opacity-15"
    />

    <!-- 婚禮抬頭 -->
    <p class="absolute top-8 text-overline uppercase tracking-[0.3em] text-gold">
      {{ coupleName }}
    </p>

    <!-- 祝福輪播 -->
    <Transition name="blessing-fade" mode="out-in">
      <div v-if="current" :key="current.blessingId" class="max-w-4xl">
        <p
          data-testid="projection-message"
          class="font-display text-[clamp(2rem,6vw,5rem)] font-semibold leading-tight text-white"
        >
          {{ current.message }}
        </p>
        <p class="mt-8 text-[clamp(1rem,2vw,1.75rem)] tracking-widest text-gold">
          — {{ guestName(current.guestId) }}
        </p>
      </div>
      <div v-else key="empty" class="max-w-2xl">
        <p class="font-display text-4xl font-semibold text-white/80">
          祝福即將綻放
        </p>
        <p class="mt-4 text-lg text-white/40">
          審核通過的祝福會在這裡輪播
        </p>
      </div>
    </Transition>

    <!-- 進度指示 -->
    <div v-if="approved.length > 1" class="absolute bottom-10 flex gap-2">
      <span
        v-for="(b, i) in approved"
        :key="b.blessingId"
        class="size-2 rounded-full transition-colors"
        :class="i === currentIndex % approved.length ? 'bg-gold' : 'bg-white/20'"
      />
    </div>
  </div>
</template>

<style scoped>
.blessing-fade-enter-active,
.blessing-fade-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.blessing-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.blessing-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
