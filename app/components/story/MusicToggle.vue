<!-- app/components/story/MusicToggle.vue — 進場自動播放背景音樂；金唱片是開關。
     位置：桌機右下角；手機（lg 以下）移到右上、選單開關的左邊，兩個同一條水平中線——手機底部已經疊了頁次軸與跳過故事（09-15 減層）。
     手機左上不能放：故事頁的頁碼「01 ——」就在那裡，唱片會蓋掉頁碼。
     游標靠近（或鍵盤焦點落上去）時，唱片左邊拉出一條小托盤：♫ 曲名 ── 已播 mm:ss ── ❚❚，像唱片機的抽屜拉開一半；
     兩段細線合起來是進度條，時間標在中間。觸控裝置沒有 hover，維持一顆唱片、點了切換。
     瀏覽器多半擋非使用者手勢觸發的有聲自動播放，故 mounted 先嘗試播放，
     失敗則退化為「等使用者第一次點擊頁面任一處」再播放（唱片本身的點擊只作為明確的開關，不重複觸發退化邏輯）。 -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  src: string
  /** 托盤上的曲名 */
  title?: string
}>(), { title: 'Our Song' })

const audioRef = ref<HTMLAudioElement>()
const buttonRef = ref<HTMLButtonElement>()
const isPlaying = ref(false)

// 已播秒數與總長：托盤上的時間與兩段進度線
const elapsed = ref(0)
const duration = ref(0)

function onTime() {
  elapsed.value = audioRef.value?.currentTime ?? 0
}
function onMeta() {
  const total = audioRef.value?.duration ?? 0
  duration.value = Number.isFinite(total) ? total : 0
}

const clock = computed(() => {
  const whole = Math.floor(elapsed.value)
  const mm = String(Math.floor(whole / 60)).padStart(2, '0')
  const ss = String(whole % 60).padStart(2, '0')
  return `${mm}:${ss}`
})
// 進度切成左右兩段（時間標在中間）：0～0.5 填左段、0.5～1 填右段
const progress = computed(() => (duration.value ? Math.min(1, elapsed.value / duration.value) : 0))
const fillLeft = computed(() => Math.min(1, progress.value * 2))
const fillRight = computed(() => Math.max(0, progress.value * 2 - 1))

async function tryPlay() {
  const audio = audioRef.value
  if (!audio || isPlaying.value)
    return
  try {
    await audio.play()
    isPlaying.value = true
  }
  catch {
    isPlaying.value = false
  }
}

function pause() {
  audioRef.value?.pause()
  isPlaying.value = false
}

function toggle() {
  if (isPlaying.value)
    pause()
  else tryPlay()
}

function handleFirstInteraction(event: PointerEvent) {
  if (buttonRef.value?.contains(event.target as Node))
    return
  tryPlay()
}

onMounted(() => {
  tryPlay()
  document.addEventListener('pointerdown', handleFirstInteraction, { once: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleFirstInteraction)
})
</script>

<template>
  <div class="music fixed z-50">
    <!-- preload="none"：音檔 2.8MB，多數賓客不會按播放，按了（或第一次點頁面）才開始載；
         總長要等載了才知道，托盤的進度線在那之前是 0，loadedmetadata／durationchange 進來就補上 -->
    <audio
      ref="audioRef"
      :src="props.src"
      loop
      preload="none"
      @timeupdate="onTime"
      @loadedmetadata="onMeta"
      @durationchange="onMeta"
    />
    <button
      ref="buttonRef"
      type="button"
      class="player group relative block size-11 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep sm:size-12"
      :aria-label="isPlaying ? '暫停背景音樂' : '播放背景音樂'"
      :aria-pressed="isPlaying"
      @click="toggle"
    >
      <!-- 托盤：從唱片底下往左拉出，右端塞在唱片下面。整條都在按鈕裡，點托盤也是切換 -->
      <span class="tray absolute flex items-center gap-3 rounded-full bg-paper py-2 pl-4 shadow-lg ring-1 ring-line" aria-hidden="true">
        <UIcon name="i-heroicons-musical-note-solid" class="size-3.5 shrink-0 text-gold-deep" />
        <span class="whitespace-nowrap font-display text-body font-semibold tracking-wide text-ink-700">{{ props.title }}</span>
        <span class="rail relative h-px w-12 shrink-0 bg-line">
          <span class="absolute inset-0 origin-left bg-gold" :style="{ transform: `scaleX(${fillLeft})` }" />
        </span>
        <span class="clock font-sans text-caption text-ink-500">{{ clock }}</span>
        <span class="rail relative h-px w-12 shrink-0 bg-line">
          <span class="absolute inset-0 origin-left bg-gold" :style="{ transform: `scaleX(${fillRight})` }" />
        </span>
        <UIcon :name="isPlaying ? 'i-heroicons-pause-solid' : 'i-heroicons-play-solid'" class="size-4 shrink-0 text-ink" />
      </span>

      <span class="disc relative block size-full rounded-full shadow-lg transition-transform duration-150 ease-standard group-hover:scale-105 group-active:scale-95">
        <img
          src="/images/story/gold-disc.webp"
          alt=""
          class="size-full rounded-full"
          :class="{ 'gold-disc-spin': isPlaying }"
        >
        <!-- 唱片角落的小標：托盤收著時顯示；托盤拉出來後由托盤右端的 ❚❚ 接手 -->
        <span class="badge absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-full bg-ink text-paper shadow-sm sm:size-5">
          <UIcon :name="isPlaying ? 'i-heroicons-pause-solid' : 'i-heroicons-play-solid'" class="size-2.5 sm:size-3" />
        </span>
      </span>
    </button>
  </div>
</template>

<style scoped>
/* 金唱片轉動：只寫 to 會退回矩陣插值（0deg 與 360deg 矩陣相同、動畫變靜止），
   故 from/to 都明寫 rotate()，瀏覽器才逐格插值角度。 */
.gold-disc-spin {
  animation: gold-disc-spin 3.2s linear infinite;
}

@keyframes gold-disc-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 手機右上、選單開關左邊：數字照 PublicMenu 的 .pm-toggle 算——
   開關 top clamp(14px, 3vh, 30px)、right clamp(14px, 3vw, 34px)、寬 42px、高 33px（三條 1px 線＋兩個 5px 間距＋上下 10px 內距）。
   唱片 44px：往上退 5.5px 兩個的中心就在同一條線；右邊讓出開關的寬度再空 0.5rem */
.music {
  top: calc(clamp(14px, 3vh, 30px) - 5.5px);
  right: calc(clamp(14px, 3vw, 34px) + 42px + 0.5rem);
}
@media (min-width: 640px) {
  .music {
    /* sm 起唱片 48px，多退 2px 維持同一條中線 */
    top: calc(clamp(14px, 3vh, 30px) - 7.5px);
  }
}
@media (min-width: 64rem) {
  .music {
    top: auto;
    right: 1.5rem;
    bottom: 1.5rem;
  }
}

/* 托盤：右端貼在唱片中線、右內距留到唱片左緣之外，讓 ❚❚ 跟唱片之間有一口氣。
   收著＝往右縮一點、透明；拉出來只動 transform 與 opacity，像抽屜滑出來 */
.tray {
  right: 50%;
  top: 50%;
  padding-right: calc(50% + 1.75rem);
  translate: 0 -50%;
  transform: translateX(0.75rem) scaleX(0.9);
  transform-origin: right center;
  opacity: 0;
  pointer-events: none;
  transition:
    transform 250ms var(--ease-emphasized),
    opacity 250ms var(--ease-standard);
}
.clock {
  font-variant-numeric: tabular-nums;
}
.rail > span {
  transition: transform 400ms linear;
}
.badge {
  transition: opacity 150ms var(--ease-standard);
}

/* 只有真的有游標的裝置才用 hover 拉抽屜；鍵盤焦點落上去也拉開 */
@media (hover: hover) {
  .player:hover .tray {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
  .player:hover .badge {
    opacity: 0;
  }
}
.player:focus-visible .tray {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.player:focus-visible .badge {
  opacity: 0;
}
</style>
