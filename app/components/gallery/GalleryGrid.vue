<!-- app/components/gallery/GalleryGrid.vue — 婚紗照格
     縮圖點擊開燈箱（GalleryLightbox）。 -->
<script setup lang="ts">
import type { GalleryPhoto } from '~/types/gallery'

defineProps<{
  photos: GalleryPhoto[]
}>()

const activeIndex = ref<number | null>(null)

function open(index: number) {
  activeIndex.value = index
}
</script>

<template>
  <div>
    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5">
      <li
        v-for="(photo, i) in photos"
        :key="photo.alt"
        class="gp-rise"
        :style="{ '--i': String(Math.min(i, 8)) }"
      >
        <button
          type="button"
          class="gp-tile"
          @click="open(i)"
        >
          <img
            v-if="photo.src"
            :src="photo.src"
            :alt="photo.alt"
            :loading="photo.eager ? 'eager' : 'lazy'"
            decoding="async"
            class="gp-img"
          >
          <span v-else class="gp-placeholder w-full text-caption text-ink-500">
            {{ photo.alt }}
          </span>
          <span class="sr-only">放大檢視</span>
        </button>
      </li>
    </ul>

    <GalleryLightbox v-model:index="activeIndex" :photos="photos" />
  </div>
</template>

<style scoped>
/* 進場：逐格上浮，step 60ms；第 9 格之後不再遞延，避免長列表尾端等太久 */
.gp-rise {
  animation: gp-in 400ms var(--ease-standard) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}

@keyframes gp-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

.gp-tile {
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--color-cream);
  cursor: pointer;
}

.gp-tile:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 3px;
}

.gp-img {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  transition: transform 400ms var(--ease-emphasized);
}

.gp-tile:hover .gp-img,
.gp-tile:focus-visible .gp-img {
  transform: scale(1.04);
}

.gp-placeholder {
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 4;
  border: 1px dashed var(--color-line);
  border-radius: var(--radius);
}
</style>
