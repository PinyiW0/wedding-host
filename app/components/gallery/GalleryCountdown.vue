<!-- app/components/gallery/GalleryCountdown.vue — 倒數到婚禮當天
     排版是一列橫式，再整條 rotate(90deg) 轉成直式（貼在 hero 右緣）。
     倒數歸零後換成「We're married!」。
     時間只在 mounted 之後才算：SSR 與首次渲染都不輸出數字，避免 hydration 兩端對不上。 -->
<script setup lang="ts">
const props = defineProps<{
  /** ISO 8601 含時區 */
  target: string
  marriedLabel: string
}>()

const now = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

const targetMs = computed(() => new Date(props.target).getTime())
const remain = computed(() => (now.value === null ? null : Math.max(0, targetMs.value - now.value)))
const isMarried = computed(() => remain.value !== null && remain.value <= 0)

const parts = computed(() => {
  const seconds = Math.floor((remain.value ?? 0) / 1000)
  return [
    { key: 'day', label: 'DAY', value: Math.floor(seconds / 86400) },
    { key: 'hour', label: 'HR', value: Math.floor(seconds / 3600) % 24 },
    { key: 'min', label: 'MIN', value: Math.floor(seconds / 60) % 60 },
    { key: 'sec', label: 'SEC', value: seconds % 60 },
  ]
})

// 每秒跳動的數字若進了無障礙樹會被反覆讀出，故視覺列 aria-hidden，另給一句靜態說明
const srText = computed(() => {
  if (remain.value === null)
    return ''
  return isMarried.value ? props.marriedLabel : `距離婚禮還有 ${parts.value[0]!.value} 天`
})

onMounted(() => {
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="now !== null" class="gc">
    <span class="sr-only">{{ srText }}</span>
    <p class="gc-row" :class="{ 'gc-row-married': isMarried }" aria-hidden="true">
      <template v-if="isMarried">
        {{ marriedLabel }}
      </template>
      <template v-else>
        <span v-for="part in parts" :key="part.key" class="gc-unit">
          <span class="gc-num">{{ String(part.value).padStart(2, '0') }}</span>
          <span class="gc-label">{{ part.label }}</span>
        </span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.gc {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 先排成一列橫的，再整條轉 90 度立起來。
   置中不能靠 grid／flex：橫列比這條窄框寬得多，溢出時對齊會退回 start，整條會被推出畫面。
   改用絕對定位的置中慣用法——translate(-50%,-50%) 在旋轉之後才作用於外層座標，
   位移量取元素自身的寬高，剛好把旋轉後的中心對回窄框中心。 */
.gc-row {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  align-items: baseline;
  gap: clamp(10px, 1.6vw, 22px);
  white-space: nowrap;
  transform: translate(-50%, -50%) rotate(90deg);
  color: var(--color-paper);
  text-shadow: 0 1px 12px rgb(17 17 17 / 45%);
}

.gc-unit {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
}

.gc-num {
  font-family: var(--font-display);
  font-size: clamp(1rem, 1.5vw, 1.35rem);
  font-variant-numeric: lining-nums tabular-nums;
  letter-spacing: 0.02em;
}

.gc-label {
  font-size: var(--text-overline);
  letter-spacing: var(--text-overline--letter-spacing);
  opacity: 0.75;
}

.gc-row-married {
  font-family: var(--font-display);
  font-size: clamp(1.1rem, 1.8vw, 1.6rem);
  font-style: italic;
  letter-spacing: 0.04em;
}
</style>
