<!-- app/components/story/PhotoWall.vue — 拖曳照片牆（issue #158）
     桌機（>=lg 且未開 prefers-reduced-motion）：可拖曳的散落畫布，便利貼混在照片之間。
     其餘情況（行動裝置／reduced-motion／無 JS）：一律呈現下方的靜態兩欄格線，
     確保「預隱藏元素在無 JS 時必須仍可見」。canvasEnabled 只在 mounted 後依裝置與動態偏好決定，
     避免 SSR 與 client 首次渲染不一致造成 hydration mismatch。 -->
<script setup lang="ts">
import type { StoryNote, StorySection } from '~/types/story'

defineProps<{
  sections: StorySection[]
  notes: StoryNote[]
}>()

const canvasEnabled = ref(false)

const dragOffsets = reactive<Record<string, { x: number, y: number }>>({})
const zIndexes = reactive<Record<string, number>>({})
let zCounter = 1

interface ActiveDrag {
  id: string
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}
const activeDrag = ref<ActiveDrag | null>(null)

function ensureOffset(id: string) {
  if (!dragOffsets[id])
    dragOffsets[id] = { x: 0, y: 0 }
  return dragOffsets[id]
}

// 依 id 雜湊出穩定的 -4~4 度旋轉，避免每次重繪抖動、也不用真的存旋轉狀態
function rotationFor(id: string): number {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 1000
  return (hash % 9) - 4
}

function itemStyle(id: string) {
  const offset = ensureOffset(id)
  const rotate = rotationFor(id)
  return {
    transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`,
    zIndex: zIndexes[id] ?? 1,
  }
}

function onPointerDown(event: PointerEvent, id: string) {
  const offset = ensureOffset(id)
  zCounter += 1
  zIndexes[id] = zCounter
  activeDrag.value = {
    id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: offset.x,
    originY: offset.y,
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  const drag = activeDrag.value
  if (!drag || drag.pointerId !== event.pointerId)
    return
  const offset = ensureOffset(drag.id)
  offset.x = drag.originX + (event.clientX - drag.startX)
  offset.y = drag.originY + (event.clientY - drag.startY)
}

function onPointerUp(event: PointerEvent) {
  if (activeDrag.value?.pointerId === event.pointerId)
    activeDrag.value = null
}

let desktopQuery: MediaQueryList | null = null
let motionQuery: MediaQueryList | null = null

function updateCanvasEnabled() {
  canvasEnabled.value = Boolean(desktopQuery?.matches) && !motionQuery?.matches
}

onMounted(() => {
  desktopQuery = window.matchMedia('(min-width: 1024px)')
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateCanvasEnabled()
  desktopQuery.addEventListener('change', updateCanvasEnabled)
  motionQuery.addEventListener('change', updateCanvasEnabled)
})

onBeforeUnmount(() => {
  desktopQuery?.removeEventListener('change', updateCanvasEnabled)
  motionQuery?.removeEventListener('change', updateCanvasEnabled)
})
</script>

<template>
  <div id="story-wall" class="bg-paper px-6 py-16 lg:py-24">
    <p class="text-center text-overline uppercase tracking-[0.28em] text-gold-deep">
      Our Story · 我們的回憶
    </p>

    <!-- 拖曳畫布：桌機 + 動態允許時才啟用 -->
    <div v-if="canvasEnabled" class="mx-auto mt-10 max-w-6xl">
      <p class="mb-6 text-center text-caption text-ink-300">
        拖曳照片，把回憶排成你喜歡的樣子
      </p>
      <div class="columns-3 gap-4 [column-fill:balance] xl:columns-4">
        <template v-for="section in sections" :key="section.key">
          <p class="mb-4 break-inside-avoid text-overline uppercase text-gold-deep">
            {{ section.label }}
          </p>
          <button
            v-for="photo in section.photos"
            :key="photo.src"
            type="button"
            :style="itemStyle(photo.src)"
            class="mb-4 block w-full cursor-grab touch-none select-none break-inside-avoid overflow-hidden rounded-sm border border-line bg-paper p-1 shadow-sm active:cursor-grabbing"
            @pointerdown="onPointerDown($event, photo.src)"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <img
              :src="photo.src"
              :alt="photo.caption"
              :loading="photo.eager ? 'eager' : 'lazy'"
              draggable="false"
              class="aspect-square w-full rounded-sm object-cover"
            >
          </button>
        </template>
        <div
          v-for="(note, i) in notes"
          :key="`note-${i}`"
          :style="itemStyle(`note-${i}`)"
          class="mb-4 block touch-none select-none break-inside-avoid rounded-sm border border-gold-light/60 bg-gold-light/20 p-4 font-display text-body-l text-ink-700"
          @pointerdown="onPointerDown($event, `note-${i}`)"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          {{ note.text }}
        </div>
      </div>
    </div>

    <!-- 靜態格線：行動裝置／reduced-motion／無 JS 皆走此版本 -->
    <div v-show="!canvasEnabled" class="mx-auto mt-10 flex max-w-3xl flex-col gap-10">
      <section
        v-for="section in sections"
        :key="section.key"
        :aria-labelledby="`story-section-${section.key}`"
      >
        <h3
          :id="`story-section-${section.key}`"
          class="text-overline uppercase text-gold-deep"
        >
          {{ section.label }}
        </h3>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <figure v-for="photo in section.photos" :key="photo.src">
            <img
              :src="photo.src"
              :alt="photo.caption"
              :loading="photo.eager ? 'eager' : 'lazy'"
              class="aspect-square w-full rounded-sm object-cover"
            >
            <figcaption class="mt-1 text-caption text-ink-500">
              {{ photo.caption }}
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-label="給彼此的話">
        <div class="flex flex-col gap-3">
          <p
            v-for="(note, i) in notes"
            :key="`static-note-${i}`"
            class="rounded-sm border border-gold-light/60 bg-gold-light/20 p-4 font-display text-body-l text-ink-700"
          >
            {{ note.text }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
