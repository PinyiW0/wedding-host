<!-- app/pages/projection/[weddingId].vue — 投影即時牆：上方最多三列祝福跑馬燈 + 中央新人照片/影片 + 花朵裝飾動畫 -->
<script setup lang="ts">
import { getProjectionSettings, getWedding, listBlessings, listFlowers, listGuests } from '~/api'
import { toYouTubeEmbed } from '~/utils/videoEmbed'

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

// 投影設定：中央媒體（照片/影片）與新人自訂花朵
const { data: settings, refresh: refreshSettings } = await getProjectionSettings(weddingId, {
  default: () => null,
})
const embedUrl = computed(() =>
  settings.value?.videoUrl ? toYouTubeEmbed(settings.value.videoUrl) : null,
)

// 只播已通過審核
const approved = computed(() => (blessings.value ?? []).filter(b => b.status === 'approved'))

function guestName(guestId: string): string {
  return (guests.value ?? []).find(g => g.guestId === guestId)?.name ?? '一位賓客'
}

// === 跑馬燈列分配 ===
// 列數依訊息量 1~3 列；greedy 依訊息長度降冪放進「累計字元最小」的列（視覺密度平衡、結果確定）
interface MarqueeItem {
  blessingId: string
  message: string
  name: string
}

const marqueeRows = computed<MarqueeItem[][]>(() => {
  const items = approved.value.map(b => ({
    blessingId: b.blessingId,
    message: b.message,
    name: guestName(b.guestId),
  }))
  const n = items.length
  if (n === 0)
    return []
  const rowCount = n <= 2 ? 1 : n <= 5 ? 2 : 3
  // 不用 Array.fill([])：會讓所有列共用同一個陣列參照
  const rows: MarqueeItem[][] = []
  const chars: number[] = []
  for (let i = 0; i < rowCount; i++) {
    rows.push([])
    chars.push(0)
  }
  for (const item of [...items].sort((a, b) => b.message.length - a.message.length)) {
    const idx = chars.indexOf(Math.min(...chars))
    rows[idx]!.push(item)
    chars[idx] = chars[idx]! + item.message.length + item.name.length
  }
  return rows
})

// chunk 內容不足時重複補齊，確保 chunk 寬 ≥ 視窗（-50% 位移無縫不露白）
function rowChunk(row: MarqueeItem[]): MarqueeItem[] {
  const repeat = Math.max(1, Math.ceil(6 / Math.max(1, row.length)))
  const out: MarqueeItem[] = []
  for (let i = 0; i < repeat; i++)
    out.push(...row)
  return out
}

// 近似恆定線速度＋列間差異；奇偶列反向
function rowDuration(row: MarqueeItem[], rowIndex: number): string {
  const chars = rowChunk(row).reduce((sum, item) => sum + item.message.length + item.name.length, 0)
  return `${Math.max(28, Math.round(chars * 1.1 + rowIndex * 8))}s`
}

// 列字級遞減（第一列最大）
const ROW_TEXT = [
  'text-[clamp(1.6rem,3.6vw,3rem)]',
  'text-[clamp(1.35rem,3vw,2.5rem)]',
  'text-[clamp(1.15rem,2.5vw,2rem)]',
]
const ROW_NAME_TEXT = [
  'text-[clamp(0.9rem,1.5vw,1.2rem)]',
  'text-[clamp(0.8rem,1.3vw,1.05rem)]',
  'text-[clamp(0.75rem,1.1vw,0.95rem)]',
]

// 即時推送（BroadcastChannel + 短輪詢 fallback）：審核/推上牆/更新設定 → 重新載入
const { subscribe } = useProjectionChannel(weddingId)

onMounted(() => {
  subscribe(() => {
    refreshBlessings()
    refreshSettings()
  })
})
</script>

<template>
  <div
    data-testid="projection-page"
    class="relative flex min-h-screen flex-col overflow-hidden bg-neutral-950 text-white"
  >
    <!-- 花朵裝飾層（賓客手繪 + 新人自訂；周邊環帶漂浮/慢轉） -->
    <ProjectionFlowers
      class="z-0"
      :flowers="flowerList"
      :custom="settings?.customFlowers ?? []"
    />

    <!-- 婚禮抬頭 -->
    <header class="relative z-10 shrink-0 py-6 text-center">
      <p class="text-overline uppercase tracking-[0.3em] text-gold">
        {{ coupleName }}
      </p>
    </header>

    <!-- 祝福跑馬燈（≤3 列）：testid 掛唯一容器（凍結 strict locator），內部訊息與複製份不掛 -->
    <div
      v-if="approved.length > 0"
      data-testid="projection-message"
      class="relative z-10 shrink-0 space-y-4 py-3"
    >
      <div
        v-for="(row, r) in marqueeRows"
        :key="r"
        class="overflow-hidden whitespace-nowrap"
      >
        <div
          class="marquee-track"
          :style="{ animationDuration: rowDuration(row, r), animationDirection: r % 2 ? 'reverse' : 'normal' }"
        >
          <!-- 兩份相同 chunk 做無縫循環；間隙包在 item 的 mx 內（放 track gap 會斷拍） -->
          <div class="marquee-chunk">
            <span
              v-for="(item, i) in rowChunk(row)"
              :key="`${item.blessingId}-${i}`"
              class="mx-10 inline-flex items-baseline gap-3"
            >
              <span class="font-display font-semibold leading-tight" :class="ROW_TEXT[r]">{{ item.message }}</span>
              <span class="tracking-widest text-gold" :class="ROW_NAME_TEXT[r]">— {{ item.name }}</span>
            </span>
          </div>
          <div class="marquee-chunk" aria-hidden="true">
            <span
              v-for="(item, i) in rowChunk(row)"
              :key="`dup-${item.blessingId}-${i}`"
              class="mx-10 inline-flex items-baseline gap-3"
            >
              <span class="font-display font-semibold leading-tight" :class="ROW_TEXT[r]">{{ item.message }}</span>
              <span class="tracking-widest text-gold" :class="ROW_NAME_TEXT[r]">— {{ item.name }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 中央媒體區：新人照片 / 影片（YouTube → iframe，其他 → video）；未設定時 serif 空狀態 -->
    <main class="relative z-10 flex min-h-0 flex-1 items-center justify-center p-8">
      <img
        v-if="settings?.mediaType === 'photo' && settings.photoDataUrl"
        :src="settings.photoDataUrl"
        alt=""
        class="max-h-full max-w-full rounded-lg shadow-2xl ring-1 ring-gold/30"
      >
      <template v-else-if="settings?.mediaType === 'video' && settings.videoUrl">
        <iframe
          v-if="embedUrl"
          :src="embedUrl"
          title="婚禮影片"
          class="aspect-video max-h-full w-auto min-w-[60vw] rounded-lg shadow-2xl ring-1 ring-gold/30"
          allow="autoplay; encrypted-media"
          allowfullscreen
        />
        <video
          v-else
          :src="settings.videoUrl"
          autoplay
          muted
          loop
          playsinline
          class="max-h-full max-w-full rounded-lg shadow-2xl ring-1 ring-gold/30"
        />
      </template>
      <div v-else class="text-center">
        <p class="font-display text-[clamp(2rem,5vw,4rem)] font-semibold text-white/85">
          {{ approved.length > 0 ? coupleName : '祝福即將綻放' }}
        </p>
        <p class="mt-4 text-body-l tracking-widest text-white/40">
          {{ approved.length > 0 ? 'With Love & Gratitude' : '審核通過的祝福會在上方跑馬燈呈現' }}
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 無縫跑馬燈：track 內兩份相同 chunk，位移 -50% 剛好接回起點 */
.marquee-track {
  display: inline-flex;
  width: max-content;
  animation-name: marquee;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.marquee-chunk {
  display: inline-flex;
}
@keyframes marquee {
  to {
    transform: translateX(-50%);
  }
}
</style>
