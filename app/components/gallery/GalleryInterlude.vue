<!-- app/components/gallery/GalleryInterlude.vue — hero 與系列區塊之間的一行名字
     三個字在同一條水平線上：靠左、正中央、靠右。中間那個用 1fr auto 1fr 的格線置中，
     左右兩個字長度不同也不會把它推歪（space-between 做不到這件事）。
     真正的作用是留白：hero 直接接上第一個系列區塊太擠，中間空一段捲起來才順。
     跟照片同一套語彙——比頁面慢一點往上帶、離視窗中心遠時淡下去。
     --gt 預設 0.5＝正對中心，所以沒有 JS 或關閉動效時就是一行靜止的字。
     本檔不在公開頁白名單，字級走 <style scoped>。 -->
<script setup lang="ts">
defineProps<{
  /** 依序落在最左／中間／最右 */
  words: string[]
}>()

const rootRef = ref<HTMLElement | null>(null)
const { register } = useScrollProgress()

onMounted(() => {
  register(rootRef.value, { varName: '--gt', mode: 'travel' })
})
</script>

<template>
  <p ref="rootRef" class="gi">
    <span v-for="(word, i) in words" :key="i" class="gi-word">{{ word }}</span>
  </p>
</template>

<style scoped>
.gi {
  /* 離中心多近：0＝最遠、1＝正中央。用 max() 代替 abs()——abs() 的瀏覽器支援還不夠 */
  --near: calc(1 - max(var(--gt, 0.5) * 2 - 1, 1 - var(--gt, 0.5) * 2));
  --rise: 10vh;

  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: baseline;
  padding-block: clamp(56px, 14vh, 160px);
  padding-inline: clamp(16px, 6vw, 96px);
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 4vw, 3.25rem);
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: var(--color-ink);
  transform: translate3d(0, calc((0.5 - var(--gt, 0.5)) * var(--rise)), 0);
  opacity: calc(0.42 + var(--near) * 0.58);
  will-change: transform;
}

.gi-word:first-child {
  justify-self: start;
}

.gi-word:nth-child(2) {
  justify-self: center;
}

.gi-word:last-child {
  justify-self: end;
}
</style>
