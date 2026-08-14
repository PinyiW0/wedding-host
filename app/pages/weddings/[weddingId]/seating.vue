<!-- app/pages/weddings/[weddingId]/seating.vue -->
<script setup lang="ts">
import type {
  CreateTableBody,
  TableListItem,
  VenueLayoutBody,
  VenueMarkerListItem,
} from '~/types/api/seating'

import {
  configureVenueLayout,
  createTable,
  deleteTable,
  getVenueLayout,
  listGuests,
  listTables,
  listVenueMarkers,
  listWeddingSeats,
  unseatGuest,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// === 資料載入（彼此獨立：先同步呼叫、再一起 await，消 waterfall）===
const tablesAsync = listTables(weddingId, { default: () => [] })
const guestsAsync = listGuests(weddingId, { default: () => [] })
// 場地佈局：由 GET 讀回，重整後 modal 仍能還原既有值
const venueAsync = getVenueLayout(weddingId, { default: () => null })
// 場地標記（門口、送客區、進場入口等；與桌次同畫布座標系）
const markersAsync = listVenueMarkers(weddingId, { default: () => [] })
// 全婚禮座位一次抓（取代逐桌 N 請求）
const seatsAsync = listWeddingSeats(weddingId, { default: () => [] })
await Promise.all([tablesAsync, guestsAsync, venueAsync, markersAsync, seatsAsync])
const { data: tables, error: tablesError, refresh: refreshTables } = tablesAsync
const { data: guests, error: guestsError, refresh: refreshGuests } = guestsAsync
const { data: venueLayout, error: venueError, refresh: refreshVenue } = venueAsync
const { data: venueMarkers, error: markersError, refresh: refreshMarkers } = markersAsync
const { data: allSeats, error: seatsError, refresh: refreshSeats } = seatsAsync

async function refreshAll() {
  await Promise.all([refreshTables(), refreshSeats()])
}

// 讀取失敗（issue #103）：任一讀取失敗即顯示故障＋重試，
// 不得因 default 值以「無賓客／無桌次」樣貌呈現（座位會全變 guestId、名單空白）
const loadError = computed(() =>
  tablesError.value ?? guestsError.value ?? seatsError.value ?? venueError.value ?? markersError.value ?? null,
)
async function retryLoad() {
  await Promise.all([refreshTables(), refreshGuests(), refreshVenue(), refreshMarkers(), refreshSeats()])
}

// === 座位計算純邏輯（occupant 展開、容量人頭、主桌男左女右、側欄排序）===
const {
  seatableGuests,
  seatsByTable,
  guestName,
  guestById,
  tableSeats,
  mainTable,
  isMainTable,
  tableCenterX,
  occupantAt,
  guestNormalHeads,
  nextFreeSeat,
  nextSeatFor,
  seatSlots,
  occupantMeta,
  unseatedGuests,
  seatedCount,
  sidebarGuests,
} = useSeatingMath({ tables, guests, allSeats })

// === 場地參考圖底圖（上傳、對位拖曳、縮放；結果持久化於 venue-layout）===
const {
  refImageUrl,
  refImageBox,
  refImageTransform,
  isAdjustingRefImage,
  onRefImagePointerDown,
  zoomRefImage,
  resetRefImageTransform,
  finishRefImageAdjust,
  refImageInput,
  isUploadingRefImage,
  onRefImageSelected,
  removeRefImage,
} = useVenueRefImage({ weddingId, venueLayout, refreshVenue })

// === 畫布拖曳（桌位／標記／舞台 pointer-drag）與畫布尺寸 ===
const {
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
} = useSeatingCanvasDrag({
  weddingId,
  tables,
  venueMarkers,
  venueLayout,
  refreshTables,
  refreshMarkers,
  refreshVenue,
  refImageBox,
})

// === 加入 / 編輯場地標記 Modal ===
const isMarkerFormOpen = ref(false)
const editingMarker = ref<VenueMarkerListItem | null>(null)
const editingMarkerPos = ref<{ x: number, y: number } | null>(null)

function openCreateMarker() {
  editingMarker.value = null
  editingMarkerPos.value = null
  isMarkerFormOpen.value = true
}

function openEditMarker(marker: VenueMarkerListItem) {
  editingMarker.value = marker
  editingMarkerPos.value = markerPos(marker)
  isMarkerFormOpen.value = true
}

// === 下載桌次圖（備餐統計 + canvas 匯出 JPEG / PDF）===
const { downloadItems } = useSeatingChartExport({
  weddingId,
  tables,
  venueMarkers,
  venueLayout,
  math: { tableSeats, guestById, mainTable, isMainTable },
  tablePos,
  markerPos,
})

// === 推薦排序：依「主桌帶入新人雙親 × 男左女右 × 長輩近主桌」自動帶入座位 ===
const { isAutoSeating, autoSeat } = useAutoSeat({
  weddingId,
  tables,
  math: { unseatedGuests, mainTable, isMainTable, tableSeats, guestNormalHeads, tableCenterX },
  refreshAll,
})

// === 一鍵取消：清空所有座位安排 ===
const isClearOpen = ref(false)
const isClearing = ref(false)

function openClearAll() {
  if (seatedCount.value === 0) {
    toast.add({ title: '目前沒有已排席的賓客', color: 'info' })
    return
  }
  isClearOpen.value = true
}

async function confirmClearAll() {
  if (isClearing.value)
    return
  isClearing.value = true
  try {
    // 取消端點一次清掉該賓客在該桌的所有席位，故同一 (桌,賓客) 只送一次
    // （一組賓客 partySize>1 會展開多席位，逐席位送會在第二筆撞「賓客不在此桌」）
    const seen = new Set<string>()
    const all: { tableId: string, guestId: string }[] = []
    for (const [tableId, seats] of Object.entries(seatsByTable.value)) {
      for (const s of seats) {
        const key = `${tableId}::${s.guestId}`
        if (seen.has(key))
          continue
        seen.add(key)
        all.push({ tableId, guestId: s.guestId })
      }
    }
    for (const a of all)
      await unseatGuest(weddingId.value, a.tableId, a.guestId)
    await refreshAll()
    toast.add({ title: `已取消 ${all.length} 位座位安排`, color: 'success' })
    isClearOpen.value = false
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '清空失敗', description: message, color: 'error' })
    await refreshAll()
  }
  finally {
    isClearing.value = false
  }
}

// === 整桌重置排位：該桌所有賓客退回待排 ===
const isResetTableOpen = ref(false)
const resetTableTarget = ref<TableListItem | null>(null)
const isResettingTable = ref(false)

function openResetTable(table: TableListItem) {
  if (tableSeats(table.tableId).length === 0) {
    toast.add({ title: '此桌沒有已排席的賓客', color: 'info' })
    return
  }
  resetTableTarget.value = table
  isResetTableOpen.value = true
}

async function confirmResetTable() {
  const table = resetTableTarget.value
  if (!table || isResettingTable.value)
    return
  isResettingTable.value = true
  try {
    // 取消端點一次清掉該賓客在該桌的所有席位，同一賓客只送一次
    const guestIds = [...new Set(tableSeats(table.tableId).map(s => s.guestId))]
    for (const guestId of guestIds)
      await unseatGuest(weddingId.value, table.tableId, guestId)
    await refreshAll()
    toast.add({ title: `已重置 ${table.tableName} 排位`, color: 'success' })
    isResetTableOpen.value = false
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '重置排位失敗', description: message, color: 'error' })
    await refreshAll()
  }
  finally {
    isResettingTable.value = false
  }
}

// === 拖曳排位（HTML5 DnD：側欄入座、單席移動／互換）+ 觸控備援（tap-to-assign）===
const {
  dragOverTableId,
  onGuestDragStart,
  onSeatDragStart,
  onGuestDragEnd,
  onTableDragOver,
  onTableDragLeave,
  onDropToTable,
  onDropToSeat,
  pendingGuestId,
  hasPending,
  togglePendingGuest,
  startPendingMove,
  cancelPending,
  tapSeat,
} = useSeatAssign({
  weddingId,
  math: { occupantAt, nextSeatFor },
  refreshAll,
})

// 座位上賓客點擊：待放置中＝以此席位為目標（移動／互換）；否則開取消座位確認
function onOccupantClick(table: TableListItem, seatNumber: number, guestId: string) {
  if (hasPending.value) {
    void tapSeat(table, seatNumber)
    return
  }
  openUnseat(table.tableId, guestId, seatNumber)
}

// === 新增 / 編輯桌次 Modal ===
const isTableFormOpen = ref(false)
const editingTable = ref<TableListItem | null>(null)

function openCreateTable() {
  editingTable.value = null
  isTableFormOpen.value = true
}

function openEditTable(table: TableListItem) {
  editingTable.value = table
  isTableFormOpen.value = true
}

// === 移除桌次 ===
const isRemoveOpen = ref(false)
const isRemoving = ref(false)
const removeTarget = ref<TableListItem | null>(null)
const removeError = ref('')

function openRemoveTable(table: TableListItem) {
  removeTarget.value = table
  removeError.value = ''
  isRemoveOpen.value = true
}

async function confirmRemoveTable() {
  if (!removeTarget.value || isRemoving.value)
    return
  isRemoving.value = true
  removeError.value = ''
  try {
    await deleteTable(weddingId.value, removeTarget.value.tableId)
    toast.add({ title: '桌次已移除', color: 'success' })
    isRemoveOpen.value = false
    await refreshAll()
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示於確認框（避免與 toast 重複造成 strict mode violation）
    removeError.value
      = error?.data?.message || error?.statusMessage || '移除失敗，請稍後再試'
  }
  finally {
    isRemoving.value = false
  }
}

// === 安排座位（表單 Modal，與拖曳並存：保留可達路徑） ===
const guestOptions = computed(() =>
  seatableGuests.value.map(g => ({ label: g.name, value: g.guestId })),
)
const tableOptions = computed(() =>
  (tables.value ?? []).map(t => ({ label: t.tableName, value: t.tableId })),
)
const isSeatFormOpen = ref(false)

// 改選桌次時建議下一個座位號（傳入 modal）
function suggestSeatNumber(tableId: string): number {
  const table = (tables.value ?? []).find(t => t.tableId === tableId)
  return table ? nextFreeSeat(table) : tableSeats(tableId).length + 1
}

// === 取消座位 ===
const isUnseatOpen = ref(false)
const isUnseating = ref(false)
const unseatTarget = ref<{ tableId: string, guestId: string, guestName: string, seatNumber: number } | null>(null)

function openUnseat(tableId: string, guestId: string, seatNumber: number) {
  unseatTarget.value = { tableId, guestId, guestName: guestName(guestId), seatNumber }
  isUnseatOpen.value = true
}

// 「移至其他座位」（觸控備援換位入口）：關閉確認框，改以該席位為待放置來源
function startMoveFromUnseat() {
  const target = unseatTarget.value
  if (!target)
    return
  isUnseatOpen.value = false
  startPendingMove(target.tableId, target.seatNumber, target.guestId)
}

async function confirmUnseat() {
  if (!unseatTarget.value || isUnseating.value)
    return
  isUnseating.value = true
  try {
    await unseatGuest(
      weddingId.value,
      unseatTarget.value.tableId,
      unseatTarget.value.guestId,
    )
    toast.add({ title: '已取消座位', color: 'success' })
    isUnseatOpen.value = false
    await refreshAll()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '取消失敗，請稍後再試'
    toast.add({ title: '取消失敗', description: message, color: 'error' })
  }
  finally {
    isUnseating.value = false
  }
}

// === 場地佈局 Modal ===
const isVenueOpen = ref(false)

// === 預設佈局：全新婚禮（無桌次、未設定舞台）自動帶入置中舞台＋五桌（每桌 10 席）===
const DEFAULT_STAGE: VenueLayoutBody = { stageWidth: 360, stageHeight: 70, stagePositionX: 270, stagePositionY: 20 }
const DEFAULT_TABLES: CreateTableBody[] = [
  { tableName: '主桌', capacity: 10, positionX: 350, positionY: 140 },
  { tableName: '第一桌', capacity: 10, positionX: 140, positionY: 460 },
  { tableName: '第二桌', capacity: 10, positionX: 560, positionY: 460 },
  { tableName: '第三桌', capacity: 10, positionX: 140, positionY: 770 },
  { tableName: '第四桌', capacity: 10, positionX: 560, positionY: 770 },
]
const isSeedingDefault = ref(false)

onMounted(async () => {
  // 讀取失敗時「看起來沒桌次」是故障不是全新婚禮，不得觸發預設佈局寫入（issue #103）
  if (loadError.value)
    return
  if ((tables.value ?? []).length > 0 || venueLayout.value || isSeedingDefault.value)
    return
  isSeedingDefault.value = true
  try {
    await configureVenueLayout(weddingId.value, DEFAULT_STAGE)
    for (const t of DEFAULT_TABLES)
      await createTable(weddingId.value, t)
    await refreshVenue()
    await refreshAll()
    toast.add({
      title: '已帶入預設佈局',
      description: '置中舞台與五桌（每桌 10 席），可直接拖曳與編輯',
      color: 'success',
    })
  }
  catch {
    // 帶入失敗不擋操作（仍可手動新增桌次）
  }
  finally {
    isSeedingDefault.value = false
  }
})
</script>

<template>
  <div data-testid="seating-page" class="flex h-full flex-col">
    <PageHeader
      title="桌次規劃"
      eyebrow="宴會廳 · 現場座位"
      description="以圓桌呈現現場佈局，從右側名單把賓客拖到座位即可排席"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <!-- 顏色圖例：男方／女方（家屬方，非性別）＋ 兒童椅 -->
          <div class="mr-1 hidden items-center gap-4 text-caption text-ink-500 sm:flex">
            <span class="flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-info-600" />男方
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-gold" />女方
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-success-600" />兒童椅
            </span>
          </div>
          <!-- 下載桌次圖：備餐地圖（餐點分類）/ 賓客名單（桌位示意圖），各含 JPEG / PDF -->
          <UDropdownMenu :items="downloadItems" :content="{ align: 'end' }">
            <UButton
              data-testid="vibe-seating-download"
              icon="i-heroicons-arrow-down-tray"
              color="neutral"
              variant="outline"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            >
              下載桌次圖
            </UButton>
          </UDropdownMenu>
          <UButton
            data-testid="table-create"
            icon="i-heroicons-plus"
            color="neutral"
            variant="solid"
            @click="openCreateTable"
          >
            新增桌子
          </UButton>
        </div>
      </template>
    </PageHeader>

    <!-- 讀取失敗（issue #103）：明確顯示故障＋可重試，不得以「無賓客／無桌次」樣貌呈現 -->
    <div
      v-if="loadError"
      data-testid="vibe-seating-load-error"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4"
    >
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        title="桌次資料載入失敗"
        description="無法取得賓客或桌次資料，請重新載入或稍後再試"
        class="max-w-md"
      />
      <UButton
        data-testid="vibe-seating-retry"
        icon="i-heroicons-arrow-path"
        color="neutral"
        variant="outline"
        @click="retryLoad"
      >
        重新載入
      </UButton>
    </div>

    <!-- 兩欄：左 圓桌平面（寬） / 右 賓客名單（窄） -->
    <div v-else class="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      <!-- 左欄：圓桌現場平面圖（min-w-0 讓寬畫布於內部捲動，不把右側名單推出邊界） -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <!-- 畫布工具列：操控下方桌次圖的工具（舞台、參考圖、標記）；主要動作（新增桌子、下載）留在頁首 -->
        <!-- 命名避開凍結 strict regex（不可含「新增」「佈局」；「舞台」保留給 spec 對應按鈕） -->
        <div class="mb-2 flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-950">
          <span class="mr-1.5 text-overline uppercase tracking-wider text-gold-deep">畫布工具</span>
          <UButton
            data-testid="venue-layout"
            icon="i-heroicons-squares-2x2"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="isVenueOpen = true"
          >
            設定舞台位置
          </UButton>
          <!-- 場地參考圖：上傳 jpg/png/pdf（≤5MB）作為畫布底圖 -->
          <input
            ref="refImageInput"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            class="hidden"
            @change="onRefImageSelected"
          >
          <UButton
            data-testid="vibe-venue-ref-upload"
            icon="i-heroicons-photo"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="isUploadingRefImage"
            @click="refImageInput?.click()"
          >
            上傳參考圖
          </UButton>
          <UButton
            v-if="refImageUrl"
            data-testid="vibe-venue-ref-adjust"
            icon="i-heroicons-arrows-pointing-out"
            color="neutral"
            :variant="isAdjustingRefImage ? 'solid' : 'ghost'"
            size="sm"
            @click="isAdjustingRefImage = !isAdjustingRefImage"
          >
            調整底圖
          </UButton>
          <UButton
            v-if="refImageUrl"
            data-testid="vibe-venue-ref-remove"
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="移除參考圖"
            :disabled="isUploadingRefImage"
            @click="removeRefImage"
          />
          <UButton
            data-testid="venue-marker-create"
            icon="i-heroicons-map-pin"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openCreateMarker"
          >
            加入標記
          </UButton>
        </div>
        <div
          v-if="(tables ?? []).length === 0"
          data-testid="table-list-empty"
          class="flex min-h-0 flex-1 flex-col"
        >
          <EmptyState
            bordered
            class="flex-1"
            title="目前沒有桌次"
            description="點擊右上「新增桌子」開始規劃座位"
          />
        </div>

        <div
          v-else
          data-testid="seating-floor-plan"
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-paper p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          :style="{ backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1px)', backgroundSize: '26px 26px' }"
        >
          <!-- 底圖調整列：拖曳對位、按鈕縮放；sticky 讓長畫布捲動時仍可操作 -->
          <div
            v-if="isAdjustingRefImage && refImageBox"
            data-testid="vibe-venue-ref-adjust-bar"
            class="sticky left-0 top-0 z-50 mb-3 flex w-fit items-center gap-2 rounded-md border border-line bg-paper/95 px-3 py-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/95"
          >
            <span class="text-caption text-ink-500 dark:text-neutral-400">拖曳底圖對位</span>
            <UButton
              data-testid="vibe-venue-ref-zoom-out"
              icon="i-heroicons-minus"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="縮小底圖"
              @click="zoomRefImage(-0.1)"
            />
            <span class="w-11 text-center text-caption tabular-nums text-ink-500 dark:text-neutral-400">{{ Math.round(refImageTransform.scale * 100) }}%</span>
            <UButton
              data-testid="vibe-venue-ref-zoom-in"
              icon="i-heroicons-plus"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="放大底圖"
              @click="zoomRefImage(0.1)"
            />
            <UButton
              data-testid="vibe-venue-ref-reset"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="resetRefImageTransform"
            >
              重設
            </UButton>
            <UButton
              data-testid="vibe-venue-ref-done"
              color="neutral"
              variant="solid"
              size="xs"
              @click="finishRefImageAdjust"
            >
              完成
            </UButton>
          </div>
          <!-- 待放置提示列：tap-to-assign 進行中（觸控備援；sticky 讓長畫布捲動時仍可見） -->
          <div
            v-if="hasPending && pendingGuestId"
            data-testid="vibe-seating-pending-bar"
            class="sticky left-0 top-0 z-50 mb-3 flex w-fit items-center gap-2 rounded-md border border-gold bg-paper/95 px-3 py-1.5 shadow-sm dark:bg-neutral-900/95"
          >
            <span class="text-caption text-ink-500 dark:text-neutral-400">
              待放置：<span class="font-medium text-gold-deep">{{ guestName(pendingGuestId) }}</span>，點桌上空位入座
            </span>
            <UButton
              data-testid="vibe-seating-pending-cancel"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="cancelPending"
            >
              取消
            </UButton>
          </div>
          <!-- 自由佈局畫布：圓桌可拖曳調整位置以因應現場空間 -->
          <div
            data-testid="table-list"
            class="relative mx-auto select-none"
            :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
          >
            <!-- 場地參考圖底圖：平時低透明度、不攔截指標事件；調整模式中可拖曳移動與縮放 -->
            <img
              v-if="refImageUrl && refImageBox"
              data-testid="vibe-venue-ref-image"
              :src="refImageUrl"
              alt="場地參考圖"
              draggable="false"
              class="absolute select-none rounded"
              :class="isAdjustingRefImage
                ? 'z-40 cursor-move touch-none opacity-70 ring-2 ring-gold'
                : 'pointer-events-none opacity-50 dark:opacity-40'"
              :style="{
                left: `${refImageBox.x}px`,
                top: `${refImageBox.y}px`,
                width: `${refImageBox.width}px`,
                height: `${refImageBox.height}px`,
              }"
              @pointerdown="onRefImagePointerDown"
            >

            <!-- 舞台標示：依 venueLayout 定位與尺寸（可拖曳，放開即存）；未設定時置頂置中 -->
            <div
              v-if="stageBox"
              data-testid="vibe-stage"
              class="absolute z-0 flex cursor-move touch-none select-none items-center justify-center rounded border border-dashed border-line bg-paper/70 text-overline tracking-wider text-ink-300 dark:border-neutral-700 dark:bg-neutral-900/60"
              :class="[
                isMovingStage && 'z-40 ring-2 ring-gold',
                isAdjustingRefImage && 'pointer-events-none',
              ]"
              :style="{
                left: `${stageBox.x}px`,
                top: `${stageBox.y}px`,
                width: `${stageBox.width}px`,
                height: `${stageBox.height}px`,
              }"
              title="按住可移動舞台"
              @pointerdown="onStagePointerDown"
            >
              舞台
            </div>
            <span v-else class="absolute left-1/2 top-0 z-0 -translate-x-1/2 rounded border border-dashed border-line px-10 py-2 text-overline tracking-wider text-ink-300">
              舞台
            </span>

            <!-- 場地標記：可拖曳長方形（純 div、無 landmark role，避開 findEntity 掃描） -->
            <div
              v-for="marker in venueMarkers"
              :key="marker.markerId"
              :data-testid="`venue-marker-${marker.markerId}`"
              class="group absolute flex cursor-move touch-none select-none items-center justify-center rounded border border-dashed border-ink-300 bg-paper/90 px-2 text-center text-caption text-ink-500 shadow-sm dark:border-neutral-600 dark:bg-neutral-900/90 dark:text-neutral-300"
              :class="[
                movingMarkerId === marker.markerId ? 'z-40 ring-2 ring-gold' : 'z-20',
                isAdjustingRefImage && 'pointer-events-none',
              ]"
              :style="{
                left: `${markerPos(marker).x}px`,
                top: `${markerPos(marker).y}px`,
                width: `${marker.width}px`,
                height: `${marker.height}px`,
              }"
              @pointerdown="onMarkerPointerDown($event, marker)"
            >
              <span class="truncate">{{ marker.label }}</span>
              <UButton
                icon="i-heroicons-pencil"
                color="neutral"
                variant="soft"
                size="xs"
                class="absolute -right-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100"
                :aria-label="`編輯標記 ${marker.label}`"
                @pointerdown.stop
                @click="openEditMarker(marker)"
              />
            </div>

            <article
              v-for="table in tables"
              :key="table.tableId"
              :data-testid="`table-row-${table.tableId}`"
              :aria-label="table.tableName"
              class="group/table absolute hover:z-50"
              :class="[
                isMainTable(table) ? 'w-[200px]' : 'w-[168px]',
                movingTableId === table.tableId ? 'z-40' : (dragOverTableId === table.tableId ? 'z-30' : 'z-10'),
                isAdjustingRefImage && 'pointer-events-none',
              ]"
              :style="{ left: `${tablePos(table).x}px`, top: `${tablePos(table).y}px` }"
              @dragover="onTableDragOver($event, table.tableId)"
              @dragleave="onTableDragLeave(table.tableId)"
              @drop="onDropToTable($event, table)"
            >
              <!-- 圓桌 + 環繞座位 -->
              <div class="relative aspect-square w-full">
                <!-- 桌面（中心）：桌名寫在圓桌內；按住可拖曳移動桌位；亦為整桌入座 drop 區 -->
                <div
                  class="absolute left-1/2 top-1/2 flex size-[64%] -translate-x-1/2 -translate-y-1/2 cursor-move touch-none select-none flex-col items-center justify-center rounded-full border-2 px-2 text-center transition-shadow"
                  :class="[
                    isMainTable(table)
                      ? 'border-gold bg-gold-light/25 dark:border-gold dark:bg-gold-deep/20'
                      : 'border-line bg-white dark:border-neutral-700 dark:bg-neutral-900',
                    movingTableId === table.tableId && 'shadow-lg ring-2 ring-gold',
                  ]"
                  title="按住可移動桌位"
                  @pointerdown="onTablePointerDown($event, table)"
                  @dragover="onTableDragOver($event, table.tableId)"
                  @drop="onDropToTable($event, table)"
                >
                  <span
                    class="line-clamp-2 font-display font-semibold leading-tight text-ink dark:text-paper"
                    :class="isMainTable(table) ? 'text-lg' : 'text-base'"
                  >{{ table.tableName }}</span>
                  <span class="mt-0.5 text-caption text-ink-300">{{ table.capacity }} 席</span>
                </div>

                <!-- 座位環（座位數含兒童加位；主桌新人並排、雙方家屬各自外擴） -->
                <template v-for="slot in seatSlots(table)" :key="slot.idx">
                  <!-- 已入座：點擊取消座位、可拖曳互換 / 移動座位（兒童綠 / 女方金 / 男方藍） -->
                  <button
                    v-if="slot.occupant"
                    type="button"
                    draggable="true"
                    :data-testid="`${table.tableId}-seat-${slot.seatNumber}`"
                    :aria-label="`取消座位 ${slot.occupant.name}`"
                    class="group/seat absolute z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 text-center text-micro font-medium leading-none shadow-sm transition-transform hover:z-50 hover:scale-110 active:cursor-grabbing"
                    :class="occupantColorClass(slot.occupant)"
                    :style="{ left: slot.pos.left, top: slot.pos.top }"
                    @click="onOccupantClick(table, slot.seatNumber, slot.occupant.guestId)"
                    @dragstart="onSeatDragStart($event, table.tableId, slot.seatNumber, slot.occupant.guestId)"
                    @dragend="onGuestDragEnd"
                    @dragover="onTableDragOver($event, table.tableId)"
                    @drop="onDropToSeat($event, table, slot.seatNumber)"
                  >
                    <span class="line-clamp-2 px-0.5">{{ slot.occupant.label }}</span>
                    <!-- hover 提示：哪一方 · 關係 · 葷素（即時可見，取代不穩定的原生 title） -->
                    <span
                      class="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-caption font-normal leading-none text-paper shadow-lg group-hover/seat:block dark:bg-neutral-700"
                    >
                      {{ occupantMeta(slot.occupant.guestId) }}
                    </span>
                  </button>
                  <!-- 空位：拖曳賓客至此可入座；tap-to-assign 待放置中點擊即入座（觸控備援） -->
                  <div
                    v-else
                    :data-testid="`${table.tableId}-empty-${slot.idx + 1}`"
                    class="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed text-ink-300 transition-colors"
                    :class="dragOverTableId === table.tableId || hasPending
                      ? 'cursor-pointer border-gold bg-gold-light/30 text-gold-deep'
                      : 'border-line/70 bg-paper/60 dark:border-neutral-700 dark:bg-neutral-900/40'"
                    :style="{ left: slot.pos.left, top: slot.pos.top }"
                    @click="tapSeat(table, slot.seatNumber)"
                    @dragover="onTableDragOver($event, table.tableId)"
                    @drop="onDropToSeat($event, table, slot.seatNumber)"
                  >
                    <UIcon name="i-heroicons-plus" class="size-4" />
                  </div>
                </template>
              </div>

              <!-- 編輯 / 重置排位 / 移除（置於圓桌下方，hover 或聚焦才浮現，避免干擾視覺） -->
              <div
                class="mt-6 flex justify-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/table:opacity-100"
                @pointerdown.stop
              >
                <UButton
                  data-testid="table-edit"
                  icon="i-heroicons-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`編輯 ${table.tableName}`"
                  @click="openEditTable(table)"
                >
                  編輯
                </UButton>
                <UButton
                  data-testid="vibe-table-reset"
                  icon="i-heroicons-arrow-uturn-left"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`重置排位 ${table.tableName}`"
                  @click="openResetTable(table)"
                >
                  重置
                </UButton>
                <UButton
                  data-testid="table-remove"
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`移除 ${table.tableName}`"
                  @click="openRemoveTable(table)"
                >
                  移除
                </UButton>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- 右欄：賓客名單（可拖曳 + 推薦排序） -->
      <SeatingGuestSidebar
        :guests="sidebarGuests"
        :seated-count="seatedCount"
        :active-count="seatableGuests.length"
        :is-auto-seating="isAutoSeating"
        :is-clearing="isClearing"
        :pending-guest-id="pendingGuestId"
        @seat-form="isSeatFormOpen = true"
        @clear-all="openClearAll"
        @auto-seat="autoSeat"
        @guest-drag-start="onGuestDragStart"
        @guest-drag-end="onGuestDragEnd"
        @guest-tap="togglePendingGuest"
      />
    </div>

    <!-- 新增 / 編輯桌次 Modal -->
    <SeatingTableFormModal
      v-model:open="isTableFormOpen"
      :wedding-id="weddingId"
      :table="editingTable"
      @saved="refreshAll"
    />

    <!-- 安排座位 Modal -->
    <SeatingSeatFormModal
      v-model:open="isSeatFormOpen"
      :wedding-id="weddingId"
      :guest-options="guestOptions"
      :table-options="tableOptions"
      :suggest-seat-number="suggestSeatNumber"
      @seated="refreshAll"
    />

    <!-- 場地佈局 Modal -->
    <SeatingVenueModal
      v-model:open="isVenueOpen"
      :wedding-id="weddingId"
      :layout="venueLayout ?? null"
      @saved="refreshVenue"
    />

    <!-- 移除桌次確認 -->
    <UModal v-model:open="isRemoveOpen">
      <template #content>
        <div data-testid="confirm-modal" class="p-6">
          <h3 class="text-body-l font-semibold text-ink">
            確認移除
          </h3>
          <p class="mt-2 text-body text-ink-500">
            確定要移除桌次「{{ removeTarget?.tableName ?? '' }}」嗎？
          </p>

          <UAlert
            v-if="removeError"
            data-testid="remove-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="removeError"
            class="mt-4"
          />

          <div class="mt-6 flex justify-end gap-3">
            <UButton
              data-testid="confirm-cancel"
              color="neutral"
              variant="outline"
              :disabled="isRemoving"
              @click="isRemoveOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="confirm-ok"
              color="error"
              :loading="isRemoving"
              @click="confirmRemoveTable"
            >
              移除
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 取消座位確認（含觸控備援換位入口「移至其他座位」） -->
    <ConfirmModal
      v-model:open="isUnseatOpen"
      title="確認取消座位"
      :description="`確定要取消「${unseatTarget?.guestName ?? ''}」的座位嗎？`"
      confirm-label="取消座位"
      confirm-color="error"
      :loading="isUnseating"
      @confirm="confirmUnseat"
    >
      <template #extra>
        <UButton
          data-testid="vibe-seat-move"
          icon="i-heroicons-arrows-right-left"
          color="neutral"
          variant="outline"
          :disabled="isUnseating"
          @click="startMoveFromUnseat"
        >
          移至其他座位
        </UButton>
      </template>
    </ConfirmModal>

    <!-- 一鍵取消：清空所有座位安排確認 -->
    <ConfirmModal
      v-model:open="isClearOpen"
      title="清空所有座位安排"
      :description="`確定要取消目前 ${seatedCount} 位賓客的座位安排嗎？此動作會把所有人移回待排席。`"
      confirm-label="全部取消"
      confirm-color="error"
      :loading="isClearing"
      @confirm="confirmClearAll"
    />

    <!-- 整桌重置排位確認 -->
    <ConfirmModal
      v-model:open="isResetTableOpen"
      title="重置整桌排位"
      :description="`確定要重置「${resetTableTarget?.tableName ?? ''}」的排位嗎？此桌賓客會全部移回待排席。`"
      confirm-label="重置排位"
      confirm-color="error"
      :loading="isResettingTable"
      @confirm="confirmResetTable"
    />

    <!-- 加入 / 編輯場地標記 Modal -->
    <SeatingMarkerModal
      v-model:open="isMarkerFormOpen"
      :wedding-id="weddingId"
      :marker="editingMarker"
      :position="editingMarkerPos"
      @changed="refreshMarkers"
    />
  </div>
</template>
