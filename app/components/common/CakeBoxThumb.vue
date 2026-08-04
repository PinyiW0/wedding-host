<!-- app/components/common/CakeBoxThumb.vue -->
<!-- 喜餅款式縮圖（issue #140）：組合款並排內含各單款的圖，一眼看出要拿幾盒 -->
<!-- 縮圖只有 32/48px，細節看不清 → hover 彈出放大預覽，逐款標名 -->
<!-- 內容由呼叫端以 cakeBoxThumbItems() 解析；本元件只負責畫，不碰業務邏輯 -->
<!-- 縮圖為裝飾（旁邊一定有款名文字），故 alt 留空，避免污染 checkbox / option 的可及名稱 -->
<script setup lang="ts">
import type { CakeBoxThumbItem } from '~/utils/cakeBoxDisplay'

const props = withDefaults(
  defineProps<{
    items: CakeBoxThumbItem[]
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const withImage = computed(() => props.items.filter(item => item.url))
// 最多並排兩張；超過就只留第一張，其餘收成「+N」，避免每格窄到看不出東西
const shown = computed(() => withImage.value.slice(0, withImage.value.length > 2 ? 1 : 2))
const overflowCount = computed(() => withImage.value.length - shown.value.length)

// 預覽開關自己管：一張圖都沒有時不開，捲動時關掉
const isPreviewOpen = ref(false)

function onPreviewToggle(open: boolean) {
  isPreviewOpen.value = open && withImage.value.length > 0
}

// 浮層 portal 在 body，捲動中會與縮圖脫節飄在半空 → 一捲就收起來。
// capture 階段才收得到內層捲動容器的 scroll（scroll 事件不冒泡）
function closePreview() {
  isPreviewOpen.value = false
}

watch(isPreviewOpen, (open) => {
  if (open)
    window.addEventListener('scroll', closePreview, { capture: true, passive: true })
  else
    window.removeEventListener('scroll', closePreview, { capture: true })
})

onBeforeUnmount(() => window.removeEventListener('scroll', closePreview, { capture: true }))
</script>

<template>
  <UPopover
    mode="hover"
    :open="isPreviewOpen"
    :open-delay="250"
    :close-delay="100"
    @update:open="onPreviewToggle"
  >
    <div
      class="shrink-0 overflow-hidden rounded-md border border-line bg-white dark:border-neutral-700 dark:bg-neutral-800"
      :class="size === 'sm' ? 'size-8' : 'size-12'"
    >
      <div v-if="shown.length" class="flex size-full divide-x divide-line dark:divide-neutral-700">
        <img
          v-for="item in shown"
          :key="item.name"
          :src="item.url!"
          alt=""
          loading="lazy"
          class="h-full min-w-0 flex-1 object-cover"
        >
        <span
          v-if="overflowCount"
          class="flex flex-1 items-center justify-center bg-cream text-caption text-ink-500 dark:bg-neutral-800 dark:text-neutral-400"
        >
          +{{ overflowCount }}
        </span>
      </div>
      <div v-else class="flex size-full items-center justify-center text-ink-300">
        <UIcon name="i-heroicons-gift" :class="size === 'sm' ? 'size-4' : 'size-5'" />
      </div>
    </div>

    <template #content>
      <div class="flex gap-3 p-3">
        <figure v-for="item in items" :key="item.name" class="w-28">
          <img
            v-if="item.url"
            :src="item.url"
            alt=""
            class="size-28 rounded-md border border-line object-cover dark:border-neutral-700"
          >
          <div
            v-else
            class="flex size-28 items-center justify-center rounded-md border border-line bg-cream text-ink-300 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <UIcon name="i-heroicons-gift" class="size-7" />
          </div>
          <figcaption class="mt-1.5 text-caption text-ink-500 dark:text-neutral-400">
            {{ item.name }}
          </figcaption>
        </figure>
      </div>
    </template>
  </UPopover>
</template>
