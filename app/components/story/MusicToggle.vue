<!-- app/components/story/MusicToggle.vue — 進場自動播放背景音樂；點擊金唱片可暫停/恢復
     瀏覽器多半擋非使用者手勢觸發的有聲自動播放，故 mounted 先嘗試播放，
     失敗則退化為「等使用者第一次點擊頁面任一處」再播放（唱片本身的點擊只作為明確的開關，不重複觸發退化邏輯）。 -->
<script setup lang="ts">
const props = defineProps<{
  src: string
}>()

const audioRef = ref<HTMLAudioElement>()
const buttonRef = ref<HTMLButtonElement>()
const isPlaying = ref(false)

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
  <div class="fixed bottom-6 right-6 z-50">
    <audio ref="audioRef" :src="props.src" loop preload="auto" />
    <button
      ref="buttonRef"
      type="button"
      class="relative block size-14 rounded-full shadow-lg transition-transform duration-150 ease-standard hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep active:scale-95 sm:size-16"
      :aria-label="isPlaying ? '暫停背景音樂' : '播放背景音樂'"
      :aria-pressed="isPlaying"
      @click="toggle"
    >
      <img
        src="/images/story/gold-disc.webp"
        alt=""
        class="size-full rounded-full"
        :class="{ 'gold-disc-spin': isPlaying }"
      >
      <span class="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full bg-ink text-paper shadow-sm sm:size-6">
        <UIcon :name="isPlaying ? 'i-heroicons-pause-solid' : 'i-heroicons-play-solid'" class="size-3 sm:size-3.5" />
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
</style>
