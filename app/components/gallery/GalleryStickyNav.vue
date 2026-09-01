<!-- app/components/gallery/GalleryStickyNav.vue — 底部中央的系列快速導覽膠囊
     純錨點連結，沒有 JS 也能用。 -->
<script setup lang="ts">
defineProps<{
  items: { label: string, href: string }[]
}>()
</script>

<template>
  <nav class="sn" aria-label="系列快速導覽">
    <ul class="sn-list">
      <li v-for="item in items" :key="item.href">
        <a :href="item.href" class="sn-item">{{ item.label }}</a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* 手機：靠左展開並在右側留出音樂鈕的位置，避免兩者疊在一起 */
.sn {
  position: fixed;
  left: 12px;
  right: 88px;
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 40;
}

@media (min-width: 640px) {
  .sn {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
  }
}

.sn-list {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-full);
  background: rgb(250 247 241 / 88%);
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.sn-item {
  display: block;
  padding: 8px 12px;
  border-radius: var(--radius-full);
  font-size: var(--text-body);
  color: var(--color-ink-500);
  white-space: nowrap;
  transition:
    background-color 250ms var(--ease-standard),
    color 250ms var(--ease-standard);
}

.sn-item:hover,
.sn-item:focus-visible {
  background: var(--color-ink);
  color: var(--color-paper);
}

.sn-item:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
}
</style>
