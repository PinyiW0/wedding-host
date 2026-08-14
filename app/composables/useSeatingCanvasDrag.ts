// app/composables/useSeatingCanvasDrag.ts
// 畫布拖曳（issue #73 自 seating.vue 拆出，行為不變）：
// 桌位／場地標記／舞台 pointer-drag（拖曳中本地覆寫、放開送 API 持久化）與畫布尺寸推算
import type { MaybeRefOrGetter } from 'vue'
import type { TableListItem, VenueLayoutDetail, VenueMarkerListItem } from '~/types/api/seating'
import { configureVenueLayout, updateTable, updateVenueMarker } from '~/api'

interface CanvasDragDeps {
  weddingId: MaybeRefOrGetter<string>
  tables: MaybeRefOrGetter<TableListItem[] | null | undefined>
  venueMarkers: MaybeRefOrGetter<VenueMarkerListItem[] | null | undefined>
  venueLayout: MaybeRefOrGetter<VenueLayoutDetail | null | undefined>
  refreshTables: () => Promise<void>
  refreshMarkers: () => Promise<void>
  refreshVenue: () => Promise<void>
  // 參考圖渲染框（useVenueRefImage 提供），canvasSize 需納入其範圍
  refImageBox: MaybeRefOrGetter<{ x: number, y: number, width: number, height: number } | null>
}

export function useSeatingCanvasDrag(deps: CanvasDragDeps) {
  const toast = useToast()

  // === 自由移動桌位（拖曳圓桌調整 positionX/positionY，因應現場空間）===
  // 拖曳中以 localPos 即時覆寫顯示，放開才送 PATCH 持久化
  const localPos = ref<Record<string, { x: number, y: number }>>({})
  const movingTableId = ref<string | null>(null)
  let dragStart = { px: 0, py: 0, ox: 0, oy: 0 }

  function tablePos(table: TableListItem): { x: number, y: number } {
    return localPos.value[table.tableId] ?? { x: table.positionX, y: table.positionY }
  }

  // 拖曳期間把 pointermove / pointerup 綁在 window，而非小圓心元素上：
  // 即使游標移出圓心、或瀏覽器未接上 pointer capture，放開時仍能可靠送出 PATCH 持久化。
  function onTablePointerDown(event: PointerEvent, table: TableListItem) {
    if (event.button !== 0)
      return
    movingTableId.value = table.tableId
    const p = tablePos(table)
    dragStart = { px: event.clientX, py: event.clientY, ox: p.x, oy: p.y }
    window.addEventListener('pointermove', onTablePointerMove)
    window.addEventListener('pointerup', onTablePointerUp, { once: true })
    event.preventDefault()
  }
  function onTablePointerMove(event: PointerEvent) {
    const id = movingTableId.value
    if (!id)
      return
    localPos.value[id] = {
      x: Math.max(0, Math.round(dragStart.ox + (event.clientX - dragStart.px))),
      y: Math.max(0, Math.round(dragStart.oy + (event.clientY - dragStart.py))),
    }
  }
  async function onTablePointerUp() {
    window.removeEventListener('pointermove', onTablePointerMove)
    const id = movingTableId.value
    movingTableId.value = null
    if (!id)
      return
    const pos = localPos.value[id]
    const table = (toValue(deps.tables) ?? []).find(t => t.tableId === id)
    if (!pos || !table)
      return
    // 未實際位移則不送 PATCH
    if (pos.x === table.positionX && pos.y === table.positionY)
      return
    try {
      // 放開即送 PATCH 持久化新座標
      await updateTable(toValue(deps.weddingId), id, { positionX: pos.x, positionY: pos.y })
      await deps.refreshTables()
      // 儲存成功後清掉本地暫存覆寫，改由伺服器回傳值呈現（避免本地與後端不同步）
      // 拖曳頻繁，成功靜默（位置畫面直接可見），失敗才提示
      delete localPos.value[id]
    }
    catch (error: any) {
      // 失敗則還原本地覆寫
      delete localPos.value[id]
      const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
      toast.add({ title: '移動失敗', description: message, color: 'error' })
    }
  }

  // === 場地標記：拖曳移動（比照桌位 pointer-drag 模式）===
  const localMarkerPos = ref<Record<string, { x: number, y: number }>>({})
  const movingMarkerId = ref<string | null>(null)
  let markerDragStart = { px: 0, py: 0, ox: 0, oy: 0 }

  function markerPos(marker: VenueMarkerListItem): { x: number, y: number } {
    return localMarkerPos.value[marker.markerId] ?? { x: marker.positionX, y: marker.positionY }
  }

  function onMarkerPointerDown(event: PointerEvent, marker: VenueMarkerListItem) {
    if (event.button !== 0)
      return
    movingMarkerId.value = marker.markerId
    const p = markerPos(marker)
    markerDragStart = { px: event.clientX, py: event.clientY, ox: p.x, oy: p.y }
    window.addEventListener('pointermove', onMarkerPointerMove)
    window.addEventListener('pointerup', onMarkerPointerUp, { once: true })
    event.preventDefault()
  }
  function onMarkerPointerMove(event: PointerEvent) {
    const id = movingMarkerId.value
    if (!id)
      return
    localMarkerPos.value[id] = {
      x: Math.max(0, Math.round(markerDragStart.ox + (event.clientX - markerDragStart.px))),
      y: Math.max(0, Math.round(markerDragStart.oy + (event.clientY - markerDragStart.py))),
    }
  }
  async function onMarkerPointerUp() {
    window.removeEventListener('pointermove', onMarkerPointerMove)
    const id = movingMarkerId.value
    movingMarkerId.value = null
    if (!id)
      return
    const pos = localMarkerPos.value[id]
    const marker = (toValue(deps.venueMarkers) ?? []).find(m => m.markerId === id)
    if (!pos || !marker)
      return
    if (pos.x === marker.positionX && pos.y === marker.positionY)
      return
    try {
      await updateVenueMarker(toValue(deps.weddingId), id, { positionX: pos.x, positionY: pos.y })
      await deps.refreshMarkers()
      delete localMarkerPos.value[id]
    }
    catch (error: any) {
      delete localMarkerPos.value[id]
      const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
      toast.add({ title: '移動失敗', description: message, color: 'error' })
    }
  }

  // === 舞台呈現與拖曳（依 venueLayout 定位與尺寸；放開送 PUT venue-layout 持久化）===
  const localStagePos = ref<{ x: number, y: number } | null>(null)
  const isMovingStage = ref(false)
  let stageDragStart = { px: 0, py: 0, ox: 0, oy: 0 }
  const stageBox = computed(() => computeStageBox(toValue(deps.venueLayout), localStagePos.value))

  function onStagePointerDown(event: PointerEvent) {
    if (event.button !== 0 || !stageBox.value)
      return
    isMovingStage.value = true
    stageDragStart = { px: event.clientX, py: event.clientY, ox: stageBox.value.x, oy: stageBox.value.y }
    window.addEventListener('pointermove', onStagePointerMove)
    window.addEventListener('pointerup', onStagePointerUp, { once: true })
    event.preventDefault()
  }
  function onStagePointerMove(event: PointerEvent) {
    if (!isMovingStage.value)
      return
    localStagePos.value = {
      x: Math.max(0, Math.round(stageDragStart.ox + (event.clientX - stageDragStart.px))),
      y: Math.max(0, Math.round(stageDragStart.oy + (event.clientY - stageDragStart.py))),
    }
  }
  async function onStagePointerUp() {
    window.removeEventListener('pointermove', onStagePointerMove)
    if (!isMovingStage.value)
      return
    isMovingStage.value = false
    const layout = toValue(deps.venueLayout)
    const pos = localStagePos.value
    if (!layout || !pos)
      return
    if (pos.x === layout.stagePositionX && pos.y === layout.stagePositionY) {
      localStagePos.value = null
      return
    }
    try {
      await configureVenueLayout(toValue(deps.weddingId), {
        stageWidth: layout.stageWidth,
        stageHeight: layout.stageHeight,
        stagePositionX: pos.x,
        stagePositionY: pos.y,
      })
      await deps.refreshVenue()
      localStagePos.value = null
    }
    catch (error: any) {
      localStagePos.value = null
      const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
      toast.add({ title: '移動失敗', description: message, color: 'error' })
    }
  }

  // 畫布尺寸：依最遠的桌位、標記、舞台與參考圖推算，確保可容納並可捲動
  const canvasSize = computed(() => computeCanvasSize({
    tables: toValue(deps.tables) ?? [],
    markers: toValue(deps.venueMarkers) ?? [],
    tablePos,
    markerPos,
    stageBox: stageBox.value,
    refImageBox: toValue(deps.refImageBox),
  }))

  // 卸載時清掉殘留的 window 拖曳監聽（避免拖曳中途切頁洩漏）
  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onTablePointerMove)
    window.removeEventListener('pointerup', onTablePointerUp)
    window.removeEventListener('pointermove', onMarkerPointerMove)
    window.removeEventListener('pointerup', onMarkerPointerUp)
    window.removeEventListener('pointermove', onStagePointerMove)
    window.removeEventListener('pointerup', onStagePointerUp)
  })

  return {
    tablePos,
    movingTableId,
    onTablePointerDown,
    markerPos,
    movingMarkerId,
    onMarkerPointerDown,
    stageBox,
    isMovingStage,
    onStagePointerDown,
    canvasSize,
  }
}
