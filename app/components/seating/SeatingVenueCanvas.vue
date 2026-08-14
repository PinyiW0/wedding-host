<script setup lang="ts">
// 唯讀場地畫布（issue #151）：以後台桌次規劃的實際座標呈現桌位、舞台、場地標記與參考圖底圖，
// 整場等比縮放塞進容器寬度。桌位卡片內容由 #table slot 提供，元件只負責幾何與定位——
// 後台是 1:1 可拖曳畫布，這裡是同座標系的縮小鏡射，兩邊擺位才對得起來。
import type { TableListItem, VenueLayoutDetail, VenueMarkerListItem } from '~/types/api/seating'
// template 也要用 tableBoxWidth，明確 import 才會進 setup binding
import { computeContentBounds, computeRefImageBox, computeStageBox, tableBoxWidth, useVenueRefImageDims } from '~/composables/useVenueCanvasGeometry'

const props = withDefaults(defineProps<{
  tables: TableListItem[]
  markers: VenueMarkerListItem[]
  layout: VenueLayoutDetail | null
  isMainTable: (table: TableListItem) => boolean
  // 縮放上限：右欄縮圖與放大檢視共用元件，放大檢視允許放到 1:1
  maxScale?: number
  // 高度上限（佔視窗高度的比例）：場地縱向拉長時只依寬度縮放會變成要捲好幾屏的長條，
  // 右欄給比例讓整場一屏看完；放大檢視不給，維持依寬度等比、超出可捲
  maxHeightRatio?: number
  // 縮放下限：極端瘦長的場地硬要塞進一屏會把桌名縮到看不見，
  // 低於此倍率就放棄一屏、改成可捲——寧可捲也不要縮到不可讀
  minScale?: number
}>(), { maxScale: 1, minScale: 0 })

const CONTENT_PAD = 24

const refImageUrl = computed(() => props.layout?.referenceImageUrl ?? null)
const refImageDims = useVenueRefImageDims(refImageUrl)
const refImageBox = computed(() => computeRefImageBox(refImageDims.value, {
  x: props.layout?.refImageX ?? 0,
  y: props.layout?.refImageY ?? 0,
  scale: props.layout?.refImageScale ?? 1,
}))
const stageBox = computed(() => computeStageBox(props.layout))

// 內容邊界：桌位、標記、舞台、底圖的最小包圍框，四周留白後即縮放基準
const bounds = computed(() => computeContentBounds({
  tables: props.tables,
  markers: props.markers,
  tablePos: t => ({ x: t.positionX, y: t.positionY }),
  markerPos: m => ({ x: m.positionX, y: m.positionY }),
  isMainTable: props.isMainTable,
  stageBox: stageBox.value,
  refImageBox: refImageBox.value,
}, CONTENT_PAD))

// 容器寬度：CSS calc 無法由長度相除得出縮放倍率，故以 ResizeObserver 量測
const wrapper = ref<HTMLElement | null>(null)
const wrapperWidth = ref(0)
const viewportHeight = ref(0)
let observer: ResizeObserver | null = null
function syncViewportHeight() {
  viewportHeight.value = window.innerHeight
}
onMounted(() => {
  syncViewportHeight()
  window.addEventListener('resize', syncViewportHeight)
  if (!wrapper.value)
    return
  wrapperWidth.value = wrapper.value.clientWidth
  observer = new ResizeObserver((entries) => {
    wrapperWidth.value = entries[0]?.contentRect.width ?? 0
  })
  observer.observe(wrapper.value)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewportHeight)
  observer?.disconnect()
})

const scale = computed(() => {
  const box = bounds.value
  if (!box || wrapperWidth.value <= 0)
    return props.maxScale
  const byWidth = wrapperWidth.value / box.width
  const byHeight = props.maxHeightRatio && viewportHeight.value > 0
    ? (viewportHeight.value * props.maxHeightRatio) / box.height
    : Number.POSITIVE_INFINITY
  // 寬度是硬限制（超過就左右被裁）；高度限制可被可讀下限推翻，代價是改成上下捲動
  return Math.min(byWidth, Math.max(props.minScale, Math.min(props.maxScale, byHeight)))
})

// 外框尺寸：量到寬度前先用 aspect-ratio 佔位（SSR 高度才不會塌），量到後改精確的縮放尺寸
const frameStyle = computed(() => {
  const box = bounds.value
  if (!box)
    return {}
  if (wrapperWidth.value <= 0)
    return { width: '100%', aspectRatio: `${box.width} / ${box.height}` }
  return { width: `${box.width * scale.value}px`, height: `${box.height * scale.value}px` }
})

// 畫布座標 → 容器座標（扣掉內容邊界左上角的位移）
function at(x: number, y: number) {
  const box = bounds.value
  return { left: `${x - (box?.x ?? 0)}px`, top: `${y - (box?.y ?? 0)}px` }
}
</script>

<template>
  <div ref="wrapper" class="w-full overflow-hidden">
    <!-- 外框佔住縮放後的版面（限高時會比欄寬窄，置中擺放）；內層維持畫布原始座標 -->
    <div
      v-if="bounds"
      class="relative mx-auto"
      :style="frameStyle"
    >
      <div
        class="absolute left-0 top-0 origin-top-left"
        :style="{ width: `${bounds.width}px`, height: `${bounds.height}px`, transform: `scale(${scale})` }"
      >
        <!-- 場地參考圖底圖：淡化為背景，不搶桌位焦點 -->
        <img
          v-if="refImageUrl && refImageBox"
          :src="refImageUrl"
          alt=""
          class="pointer-events-none absolute select-none opacity-40"
          :style="{ ...at(refImageBox.x, refImageBox.y), width: `${refImageBox.width}px`, height: `${refImageBox.height}px` }"
        >

        <!-- 舞台：依 venueLayout 定位與尺寸；尚未設定佈局時置頂置中 -->
        <div
          v-if="stageBox"
          class="absolute z-0 flex items-center justify-center rounded border border-dashed border-line bg-paper/70 text-overline tracking-wider text-ink-300 dark:border-neutral-700 dark:bg-neutral-900/60"
          :style="{ ...at(stageBox.x, stageBox.y), width: `${stageBox.width}px`, height: `${stageBox.height}px` }"
        >
          舞台
        </div>
        <span
          v-else
          class="absolute left-1/2 top-0 z-0 -translate-x-1/2 rounded border border-dashed border-line px-10 py-2 text-overline tracking-wider text-ink-300"
        >
          舞台
        </span>

        <!-- 場地標記（門口、送客區等）：唯讀虛線框 -->
        <div
          v-for="marker in markers"
          :key="marker.markerId"
          class="absolute z-0 flex items-center justify-center rounded border border-dashed border-ink-300 bg-paper/90 px-2 text-center text-caption text-ink-500 dark:border-neutral-600 dark:bg-neutral-900/90 dark:text-neutral-300"
          :style="{ ...at(marker.positionX, marker.positionY), width: `${marker.width}px`, height: `${marker.height}px` }"
        >
          {{ marker.label }}
        </div>

        <!-- 桌位：格寬與後台一致（主桌 200 / 其餘 168），卡片內容交給呼叫端 -->
        <div
          v-for="table in tables"
          :key="table.tableId"
          class="absolute z-10"
          :style="{
            ...at(table.positionX, table.positionY),
            width: `${tableBoxWidth(isMainTable(table))}px`,
            height: `${tableBoxWidth(isMainTable(table))}px`,
          }"
        >
          <slot name="table" :table="table" :is-main="isMainTable(table)" />
        </div>
      </div>
    </div>
  </div>
</template>
