<!-- app/components/gallery/GalleryLightbox.vue — 照片燈箱
     用 UModal 內建的 title（而非自繪 #content）：讓 dialog 取得 accessible name 與關閉鈕，
     Esc 與焦點鎖也交給元件。左右方向鍵切換。 -->
<script setup lang="ts">
import type { GalleryPhoto } from '~/types/gallery'

const props = defineProps<{
  photos: GalleryPhoto[]
}>()

/** null＝關閉；數字＝正在看第幾張 */
const index = defineModel<number | null>('index', { default: null })

const isOpen = computed({
  get: () => index.value !== null,
  set: (value: boolean) => {
    if (!value)
      index.value = null
  },
})

const activePhoto = computed<GalleryPhoto | null>(() =>
  index.value === null ? null : props.photos[index.value] ?? null,
)

function step(delta: number) {
  if (index.value === null)
    return
  const total = props.photos.length
  index.value = (index.value + delta + total) % total
}

function onKeydown(event: KeyboardEvent) {
  if (index.value === null)
    return
  if (event.key === 'ArrowRight')
    step(1)
  else if (event.key === 'ArrowLeft')
    step(-1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="activePhoto?.alt ?? '婚紗照'"
    description="可用左右方向鍵切換照片"
    :ui="{ content: 'sm:max-w-4xl bg-paper' }"
  >
    <template #body>
      <div v-if="activePhoto">
        <img
          v-if="activePhoto.src"
          :src="activePhoto.src"
          :alt="activePhoto.alt"
          class="mx-auto max-h-[70dvh] w-auto max-w-full"
        >
        <div v-else class="gl-placeholder mx-auto h-[70dvh]">
          <span class="text-caption text-ink-500">{{ activePhoto.alt }}</span>
        </div>

        <p v-if="activePhoto.caption" class="mt-4 text-center text-body text-ink-500">
          {{ activePhoto.caption }}
        </p>

        <div class="mt-4 flex items-center justify-between gap-3">
          <UButton color="neutral" variant="ghost" icon="i-heroicons-chevron-left" @click="step(-1)">
            上一張
          </UButton>
          <p class="text-caption text-ink-300">
            {{ (index ?? 0) + 1 }} / {{ photos.length }}
          </p>
          <UButton color="neutral" variant="ghost" trailing-icon="i-heroicons-chevron-right" @click="step(1)">
            下一張
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.gl-placeholder {
  display: grid;
  place-items: center;
  border: 1px dashed var(--color-line);
  border-radius: var(--radius);
}
</style>
