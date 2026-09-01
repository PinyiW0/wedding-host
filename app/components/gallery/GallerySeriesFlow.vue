<!-- app/components/gallery/GallerySeriesFlow.vue — 系列內頁的單欄照片流
     照片捲到視窗中段時放大（scale，不動 width，避免逐幀重排）；
     --gp 由 useScrollProgress 以「距視窗中心的遠近」寫入，預設 1＝全尺寸，
     所以沒有 JS 或 reduced-motion 時就是一般的單欄照片頁。 -->
<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { GalleryPhoto } from '~/types/gallery'

defineProps<{
  photos: GalleryPhoto[]
}>()

const activeIndex = ref<number | null>(null)
const items: HTMLElement[] = []

const { register } = useScrollProgress()

function setItemRef(el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement && !items.includes(el))
    items.push(el)
}

onMounted(() => {
  for (const el of items)
    register(el, { varName: '--gp', mode: 'center' })
})
</script>

<template>
  <div class="sf">
    <figure
      v-for="(photo, i) in photos"
      :ref="setItemRef"
      :key="photo.src"
      class="sf-item"
    >
      <button type="button" class="sf-btn" @click="activeIndex = i">
        <img
          :src="photo.src"
          :alt="photo.alt"
          :loading="photo.eager ? 'eager' : 'lazy'"
          decoding="async"
          class="sf-img"
        >
        <span class="sr-only">放大檢視</span>
      </button>
      <figcaption v-if="photo.caption" class="sf-caption">
        {{ photo.caption }}
      </figcaption>
    </figure>

    <GalleryLightbox v-model:index="activeIndex" :photos="photos" />
  </div>
</template>

<style scoped>
.sf {
  position: relative;
}

.sf-item {
  width: min(92vw, 1040px);
  margin-inline: auto;
  margin-block: clamp(48px, 9vh, 120px);
}

.sf-btn {
  display: block;
  width: 100%;
  cursor: zoom-in;
}

.sf-btn:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 6px;
}

.sf-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius);
  background: var(--color-cream);
  /* 離中心最遠 0.86、正中央 1；只動 transform */
  transform: scale(calc(0.86 + var(--gp, 1) * 0.14));
  will-change: transform;
}

.sf-caption {
  margin-top: 12px;
  text-align: center;
  font-size: var(--text-body);
  color: var(--color-ink-500);
}
</style>
