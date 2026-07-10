<!-- app/pages/weddings/[weddingId]/seating.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type { GuestDiet, GuestListItem, GuestSide } from '~/types/api/guests'
import type {
  CreateTableBody,
  EtiquetteSettings,
  EtiquetteSettingsBody,
  SeatGuestBody,
  SeatListItem,
  TableListItem,
  UpdateTableBody,
  VenueLayoutBody,
  VenueMarkerListItem,
} from '~/types/api/seating'

import { z } from 'zod'

import {
  configureVenueLayout,
  createTable,
  createVenueMarker,
  deleteTable,
  deleteVenueMarker,
  dismissEtiquetteWarning,
  getEtiquetteSettings,
  getTableSeats,
  getVenueLayout,
  listGuests,
  listTables,
  listVenueMarkers,
  seatGuest,
  unseatGuest,
  updateEtiquetteSettings,
  updateTable,
  updateVenueMarker,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
// SSR：loadSeats 於 setup 多個 await 後才迴圈呼叫 getTableSeats（內部用 useHttp→useRuntimeConfig），
// 需保留 Nuxt context 以免「composable 在 setup 外被呼叫」錯誤
const nuxtApp = useNuxtApp()
const weddingId = computed(() => String(route.params.weddingId))

// === 資料載入 ===
const { data: tables, refresh: refreshTables } = await listTables(weddingId, {
  default: () => [],
})
const { data: guests } = await listGuests(weddingId, { default: () => [] })
// 場地佈局與禮俗設定：由 GET 讀回，重整後 modal 仍能還原既有值
const { data: venueLayout, refresh: refreshVenue } = await getVenueLayout(weddingId, {
  default: () => null,
})
// 場地標記（門口、送客區、進場入口等；與桌次同畫布座標系）
const { data: venueMarkers, refresh: refreshMarkers } = await listVenueMarkers(weddingId, {
  default: () => [],
})
const { data: etiquetteSettings, refresh: refreshEtiquette } = await getEtiquetteSettings(weddingId)

const activeGuests = computed(() => (guests.value ?? []).filter(g => !g.deletedAt))

// 已被「忽略」的禮俗警告類型（本次階段隱藏；reset / 重整後重新計算）
const dismissedWarningTypes = ref<string[]>([])

// 每張桌的座位（key = tableId）
const seatsByTable = ref<Record<string, SeatListItem[]>>({})

async function loadSeats() {
  const list = tables.value ?? []
  // 平行抓取各桌座位（runWithContext 保留 SSR Nuxt context）
  const seatLists = await Promise.all(
    list.map(t => nuxtApp.runWithContext(() => getTableSeats(weddingId.value, t.tableId))),
  )
  const result: Record<string, SeatListItem[]> = {}
  list.forEach((t, i) => {
    result[t.tableId] = seatLists[i]!
  })
  seatsByTable.value = result
}

await loadSeats()

async function refreshAll() {
  await refreshTables()
  await loadSeats()
}

function guestName(guestId: string): string {
  return activeGuests.value.find(g => g.guestId === guestId)?.name ?? guestId
}

function guestSide(guestId: string): GuestSide | null {
  return activeGuests.value.find(g => g.guestId === guestId)?.side ?? null
}

function guestById(guestId: string): GuestListItem | undefined {
  return activeGuests.value.find(g => g.guestId === guestId)
}

function tableSeats(tableId: string): SeatListItem[] {
  return seatsByTable.value[tableId] ?? []
}

// === 圓桌平面：主桌單獨面對舞台，其餘雙數並列 ===
const sideLabel = (s: GuestSide) => (s === 'groom' ? '男方' : '女方')
const dietLabel = (d: GuestDiet) => (d === 'meat' ? '葷食' : '素食')

const mainTable = computed(() =>
  (tables.value ?? []).find(t => t.tableName.includes('主桌')) ?? (tables.value ?? [])[0] ?? null,
)
function isMainTable(table: TableListItem): boolean {
  return mainTable.value?.tableId === table.tableId
}

// === 自由移動桌位（拖曳圓桌調整 positionX/positionY，因應現場空間）===
// 拖曳中以 localPos 即時覆寫顯示，放開才送 PATCH 持久化
const localPos = ref<Record<string, { x: number, y: number }>>({})
const movingTableId = ref<string | null>(null)
let dragStart = { px: 0, py: 0, ox: 0, oy: 0 }

function tablePos(table: TableListItem): { x: number, y: number } {
  return localPos.value[table.tableId] ?? { x: table.positionX, y: table.positionY }
}

// 畫布尺寸：依最遠的桌位與標記推算，確保可容納並可捲動
const canvasSize = computed(() => {
  const BLOCK = 290
  const PAD = 48
  let maxX = 0
  let maxY = 0
  for (const t of tables.value ?? []) {
    const p = tablePos(t)
    maxX = Math.max(maxX, p.x + BLOCK)
    maxY = Math.max(maxY, p.y + BLOCK)
  }
  for (const m of venueMarkers.value ?? []) {
    const p = markerPos(m)
    maxX = Math.max(maxX, p.x + m.width)
    maxY = Math.max(maxY, p.y + m.height)
  }
  return { width: Math.max(640, maxX + PAD), height: Math.max(420, maxY + PAD) }
})

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
  const table = (tables.value ?? []).find(t => t.tableId === id)
  if (!pos || !table)
    return
  // 未實際位移則不送 PATCH
  if (pos.x === table.positionX && pos.y === table.positionY)
    return
  try {
    // 放開即送 PATCH 持久化新座標
    await updateTable(weddingId.value, id, { positionX: pos.x, positionY: pos.y })
    await refreshTables()
    // 儲存成功後清掉本地暫存覆寫，改由伺服器回傳值呈現（避免本地與後端不同步）
    delete localPos.value[id]
    // 拖曳頻繁，提示只要短暫一閃即可（縮短秒數、不帶描述），免得擾民
    toast.add({ title: '桌位已更新', color: 'success', duration: 1200 })
  }
  catch (error: any) {
    // 失敗則還原本地覆寫
    delete localPos.value[id]
    const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
    toast.add({ title: '移動失敗', description: message, color: 'error' })
  }
}

// === 場地標記：拖曳移動（比照桌位 pointer-drag 模式）與加入/編輯 modal ===
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
  const marker = (venueMarkers.value ?? []).find(m => m.markerId === id)
  if (!pos || !marker)
    return
  if (pos.x === marker.positionX && pos.y === marker.positionY)
    return
  try {
    await updateVenueMarker(weddingId.value, id, { positionX: pos.x, positionY: pos.y })
    await refreshMarkers()
    delete localMarkerPos.value[id]
    toast.add({ title: '標記已更新', color: 'success', duration: 1200 })
  }
  catch (error: any) {
    delete localMarkerPos.value[id]
    const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
    toast.add({ title: '移動失敗', description: message, color: 'error' })
  }
}

// 加入 / 編輯標記 modal（尺寸與座標用數字欄調整，比照舞台設定的欄位模式）
const isMarkerFormOpen = ref(false)
const isMarkerSubmitting = ref(false)
const markerFormError = ref('')
const editingMarkerId = ref<string | null>(null)
const markerDraft = reactive({ label: '', width: 140, height: 48, positionX: 24, positionY: 24 })

function openCreateMarker() {
  editingMarkerId.value = null
  markerFormError.value = ''
  markerDraft.label = ''
  markerDraft.width = 140
  markerDraft.height = 48
  markerDraft.positionX = 24
  markerDraft.positionY = 24
  isMarkerFormOpen.value = true
}

function openEditMarker(marker: VenueMarkerListItem) {
  editingMarkerId.value = marker.markerId
  markerFormError.value = ''
  markerDraft.label = marker.label
  markerDraft.width = marker.width
  markerDraft.height = marker.height
  const p = markerPos(marker)
  markerDraft.positionX = p.x
  markerDraft.positionY = p.y
  isMarkerFormOpen.value = true
}

async function submitMarker() {
  if (isMarkerSubmitting.value)
    return
  const label = markerDraft.label.trim()
  if (!label) {
    markerFormError.value = '請輸入標記文字'
    return
  }
  isMarkerSubmitting.value = true
  markerFormError.value = ''
  try {
    if (editingMarkerId.value) {
      await updateVenueMarker(weddingId.value, editingMarkerId.value, {
        label,
        width: Number(markerDraft.width) || 140,
        height: Number(markerDraft.height) || 48,
        positionX: Number(markerDraft.positionX) || 0,
        positionY: Number(markerDraft.positionY) || 0,
      })
      toast.add({ title: '標記已更新', color: 'success' })
    }
    else {
      await createVenueMarker(weddingId.value, {
        label,
        width: Number(markerDraft.width) || 140,
        height: Number(markerDraft.height) || 48,
      })
      toast.add({ title: '標記已加入', color: 'success' })
    }
    isMarkerFormOpen.value = false
    await refreshMarkers()
  }
  catch (error: any) {
    markerFormError.value = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isMarkerSubmitting.value = false
  }
}

async function removeMarker() {
  if (!editingMarkerId.value || isMarkerSubmitting.value)
    return
  isMarkerSubmitting.value = true
  try {
    await deleteVenueMarker(weddingId.value, editingMarkerId.value)
    toast.add({ title: '標記已刪除', color: 'success' })
    isMarkerFormOpen.value = false
    await refreshMarkers()
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '刪除失敗，請稍後再試'
    toast.add({ title: '刪除失敗', description: message, color: 'error' })
  }
  finally {
    isMarkerSubmitting.value = false
  }
}

// 卸載時清掉殘留的 window 拖曳監聽（避免拖曳中途切頁洩漏）
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onTablePointerMove)
  window.removeEventListener('pointerup', onTablePointerUp)
  window.removeEventListener('pointermove', onMarkerPointerMove)
  window.removeEventListener('pointerup', onMarkerPointerUp)
})

// 環繞圓桌的座位座標（百分比，從正上方順時針排列）。
// offsetRad：整體旋轉角；主桌傳 -π/count 旋半格，使兩個座位對稱跨在正上方（新人並排 C 位）。
function seatPositions(count: number, offsetRad = 0) {
  const positions: { left: string, top: string }[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2 + offsetRad
    positions.push({
      left: `${(50 + 50 * Math.cos(angle)).toFixed(2)}%`,
      top: `${(50 + 50 * Math.sin(angle)).toFixed(2)}%`,
    })
  }
  return positions
}

// 由席位資料建出顯示用入座者；label 依類型展開為「名字N」/「名字-兒童N」
function buildOccupant(seat: SeatListItem) {
  const name = guestName(seat.guestId)
  return {
    guestId: seat.guestId,
    name,
    label: seat.seatType === 'childChair' ? `${name}-兒童${seat.partyIndex}` : `${name}${seat.partyIndex}`,
    side: guestSide(seat.guestId),
    seatType: seat.seatType,
    seatNumber: seat.seatNumber,
  }
}

// 某桌某座位號的入座席位（無人則 null）；供拖放交換／移動時反查
function occupantAt(tableId: string, seatNumber: number) {
  const seat = tableSeats(tableId).find(s => s.seatNumber === seatNumber)
  return seat ? buildOccupant(seat) : null
}

// 圓桌要畫幾個座位：至少 capacity，若有展開座位（座號 > capacity）則一併畫出
function slotCount(table: TableListItem): number {
  const maxSeat = tableSeats(table.tableId).reduce((m, s) => Math.max(m, s.seatNumber), 0)
  return Math.max(table.capacity, maxSeat)
}

// 該桌已用正常席人頭（兒童椅不計）
function tableNormalHeads(tableId: string): number {
  return tableSeats(tableId).filter(s => s.seatType === 'normal').length
}
// 此賓客組的正常席人頭 = partySize − 兒童椅嬰兒數（至少 1）
function guestNormalHeads(guestId: string): number {
  const g = guestById(guestId)
  return Math.max(1, (g?.partySize ?? 1) - (g?.childChairCount ?? 0))
}
// 此桌容得下此賓客組嗎（正常席人頭不超過 capacity；兒童椅額外不計）
function canSeatGuest(table: TableListItem, guestId: string): boolean {
  return tableNormalHeads(table.tableId) + guestNormalHeads(guestId) <= table.capacity
}

// 下一個建議起始座號（後端實際會接續該桌現有最大座號 append）
function nextFreeSeat(table: TableListItem): number {
  const maxSeat = tableSeats(table.tableId).reduce((m, s) => Math.max(m, s.seatNumber), 0)
  return maxSeat + 1
}

// 該賓客可入座則回起始座號；正常席不足回 null。
function nextSeatFor(table: TableListItem, guestId: string): number | null {
  return canSeatGuest(table, guestId) ? nextFreeSeat(table) : null
}

// 主桌入座者的角色排序：新人(0) → 雙親(1) → 其他家屬(2)
function mainSeatRoleRank(guestId: string): number {
  const category = guestById(guestId)?.category
  if (category === '新人')
    return 0
  if (category === '雙親')
    return 1
  return 2
}

// 某桌「視覺位置 → 入座者」排列。
// 主桌特別處理：新郎在最靠舞台頂端、新娘並排於其左側；新郎側家屬順時針向右外擴、新娘側家屬逆時針向左外擴。
// 其餘桌維持依座號環繞。回傳含座標、入座者與供拖放用的座位號。
function seatSlots(table: TableListItem) {
  const n = slotCount(table)
  const isMain = isMainTable(table)
  // 主桌旋半格，使兩個座位對稱跨在正上方（新人並排於最靠舞台的 C 位）
  const positions = seatPositions(n, isMain ? -Math.PI / n : 0)
  const seats = [...tableSeats(table.tableId)].sort((a, b) => a.seatNumber - b.seatNumber)
  const occupants = Array.from<ReturnType<typeof buildOccupant> | null>({ length: n }).fill(null)

  if (isMain) {
    const sideRoleSort = (a: SeatListItem, b: SeatListItem) =>
      mainSeatRoleRank(a.guestId) - mainSeatRoleRank(b.guestId) || a.seatNumber - b.seatNumber
    const groom = seats.filter(s => guestSide(s.guestId) === 'groom').sort(sideRoleSort)
    const bride = seats.filter(s => guestSide(s.guestId) === 'bride').sort(sideRoleSort)
    const rest = seats.filter(s => guestSide(s.guestId) == null)
    // 全場統一男左女右：新郎(男方)填左半 → 頂端左座(0) 再往左下(n-1, n-2…)；
    // 新娘(女方)填右半 → 頂端右座(1) 再往右下(2, 3…)。新郎新娘並排於正上方中央。
    const groomOrder = [0, ...Array.from({ length: n - 1 }, (_, k) => n - 1 - k)]
    const brideOrder = Array.from({ length: n - 1 }, (_, k) => k + 1)
    const fillSide = (list: SeatListItem[], order: number[]) => {
      let p = 0
      for (const s of list) {
        while (p < order.length && occupants[order[p]!] != null)
          p++
        if (p < order.length)
          occupants[order[p++]!] = buildOccupant(s)
      }
    }
    fillSide(groom, groomOrder)
    fillSide(bride, brideOrder)
    for (const s of rest) {
      const slot = occupants.findIndex(x => x == null)
      if (slot >= 0)
        occupants[slot] = buildOccupant(s)
    }
  }
  else {
    for (const s of seats) {
      if (s.seatNumber >= 1 && s.seatNumber <= n)
        occupants[s.seatNumber - 1] = buildOccupant(s)
    }
  }

  return positions.map((pos, idx) => ({
    idx,
    pos,
    occupant: occupants[idx],
    // 已入座用實際座號（供交換／取消反查）；空位用接續座號（後端會 append，避免撞到主桌重排後的他席座號）
    seatNumber: occupants[idx]?.seatNumber ?? nextFreeSeat(table),
  }))
}

// 已入座者 hover 提示：哪一方 · 關係 · 葷素（姓名已顯示在座位上，不重複以免撞 getByText）
function occupantMeta(guestId: string): string {
  const g = guestById(guestId)
  if (!g)
    return ''
  return `${sideLabel(g.side)} · ${g.category} · ${dietLabel(g.diet)}`
}

// === 備餐統計與分類（供桌次圖標示與下載地圖）===
// 大人 = 正常席（吃大人餐，依賓客葷素分流）；小孩 = 兒童椅嬰兒（不佔正常席、不吃大人餐）
interface TableMeal { veg: number, meat: number, child: number, adults: number }
function tableMeal(tableId: string): TableMeal {
  let veg = 0
  let meat = 0
  let child = 0
  for (const s of tableSeats(tableId)) {
    if (s.seatType === 'childChair') {
      child++
      continue
    }
    if (guestById(s.guestId)?.diet === 'vegetarian')
      veg++
    else
      meat++
  }
  return { veg, meat, child, adults: veg + meat }
}
// 桌次圖 canvas 配色：對齊 main.css 設計 token，使下載圖與畫面語意色（cls）一致
const CHART = {
  paper: '#ffffff', // 列印白底
  ink: '#111111', // 主標 / 桌名（ink）
  inkSoft: '#6B655C', // 副標（ink-500）
  inkFaint: '#A8A096', // 舞台 / 次要（ink-300）
  line: '#DCD4C7', // 舞台框（line）
  empty: { fill: '#FAF7F1', stroke: '#DCD4C7', text: '#A8A096' }, // paper / line / ink-300
  veg: { fill: '#E0E8E1', stroke: '#3D4E41', text: '#323F35' }, // success 100 / 600 / 700
  meat: { fill: '#DCE3EC', stroke: '#344358', text: '#2B3748' }, // info 100 / 600 / 700
  mixed: { fill: '#F4EAD3', stroke: '#B8965A', text: '#9A7B43' }, // primary 100 / 500(gold) / 600(gold-deep)
} as const

// 餐點分類：尚無入座 / 全素食桌 / 全葷食桌 / 葷食桌（含 N 位素食）。cls 供畫面、fill/stroke/text 供 canvas（對齊 CHART token）
type MealCatKey = 'empty' | 'veg' | 'meat' | 'mixed'
interface MealCategory { key: MealCatKey, label: string, cls: string, fill: string, stroke: string, text: string }
function mealCategory(tableId: string): MealCategory {
  const m = tableMeal(tableId)
  if (m.adults === 0)
    return { key: 'empty', label: '尚無入座', cls: 'border-line text-ink-300', ...CHART.empty }
  if (m.meat === 0)
    return { key: 'veg', label: '全素食桌', cls: 'border-success-600 text-success-700', ...CHART.veg }
  if (m.veg === 0)
    return { key: 'meat', label: '全葷食桌', cls: 'border-info-600 text-info-700', ...CHART.meat }
  return { key: 'mixed', label: `葷食桌（含素 ${m.veg}）`, cls: 'border-gold text-gold-deep', ...CHART.mixed }
}
// 全場備餐總計（地圖抬頭）
const totalMeal = computed(() => {
  let veg = 0
  let meat = 0
  let child = 0
  for (const t of tables.value ?? []) {
    const m = tableMeal(t.tableId)
    veg += m.veg
    meat += m.meat
    child += m.child
  }
  return { veg, meat, child }
})
// 地圖桌序：主桌排前
const chartTables = computed(() => {
  const main = mainTable.value
  const rest = (tables.value ?? []).filter(t => t.tableId !== main?.tableId)
  return main ? [main, ...rest] : rest
})

// === 下載桌次圖：以 canvas 依桌位 positionX/Y 畫圓桌地圖（標餐點分類、不含賓客姓名），匯出 JPEG / PDF ===
// 餐廳人員據此知道哪桌在哪、各桌素葷與兒童需求
// A4 直式畫布尺寸（pt；下載時整頁縮放讓所有桌次塞進一頁）
const A4_W = 595
const A4_H = 842
function buildChartCanvas(): HTMLCanvasElement {
  const list = chartTables.value
  const M = 24
  const TITLE_H = 70
  const dpr = 4 // 高解析，列印清晰
  const canvas = document.createElement('canvas')
  canvas.width = A4_W * dpr
  canvas.height = A4_H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.fillStyle = CHART.paper
  ctx.fillRect(0, 0, A4_W, A4_H)
  const FONT = 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif'

  // 抬頭、總計、圖例（固定於頁首）
  ctx.fillStyle = CHART.ink
  ctx.font = `600 16px ${FONT}`
  ctx.fillText('桌次圖 · 備餐需求', M, 24)
  ctx.font = `9px ${FONT}`
  ctx.fillStyle = CHART.inkSoft
  ctx.fillText(`素食 ${totalMeal.value.veg} 份 · 葷食 ${totalMeal.value.meat} 份 · 兒童椅 ${totalMeal.value.child}`, M, 40)
  let lx = M
  for (const item of [{ c: CHART.veg.stroke, t: '全素食桌' }, { c: CHART.mixed.stroke, t: '葷食含素' }, { c: CHART.meat.stroke, t: '全葷食桌' }]) {
    ctx.fillStyle = item.c
    ctx.beginPath()
    ctx.arc(lx + 4, 53, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = CHART.inkSoft
    ctx.fillText(item.t, lx + 12, 56)
    lx += 12 + ctx.measureText(item.t).width + 14
  }

  if (list.length === 0)
    return canvas

  // 緊湊重排（桌間距固定縮小、不沿用畫面上的鬆散座標）：
  // 主桌置頂置中，其餘依「男左女右」分兩欄、各欄依原 Y 序由上而下密排。
  const centerXOf = (t: TableListItem) => t.positionX + (isMainTable(t) ? 100 : 84)
  const main = list.find(t => isMainTable(t)) ?? null
  const others = list.filter(t => !isMainTable(t))
  const xs = others.map(centerXOf)
  const axis = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0
  const leftCol = others.filter(t => centerXOf(t) <= axis).sort((a, b) => a.positionY - b.positionY)
  const rightCol = others.filter(t => centerXOf(t) > axis).sort((a, b) => a.positionY - b.positionY)

  const R = 54
  const RM = 70
  const colStep = 2 * R + 36 // 欄距 = 圓桌直徑 + 緊密間隙
  const rowStep = 2 * R + 28 // 列距 = 圓桌直徑 + 緊密間隙
  const leftCx = R
  const rightCx = R + colStep
  const STAGE_H = 26
  interface ChartItem { t: TableListItem, cx: number, cy: number, r: number, isMain: boolean }
  const items: ChartItem[] = []
  if (main)
    items.push({ t: main, cx: (leftCx + rightCx) / 2, cy: STAGE_H + RM, r: RM, isMain: true })
  const startY = STAGE_H + (main ? 2 * RM + 26 : 0) + R
  const rowCount = Math.max(leftCol.length, rightCol.length)
  for (let i = 0; i < rowCount; i++) {
    const cy = startY + i * rowStep
    if (leftCol[i])
      items.push({ t: leftCol[i]!, cx: leftCx, cy, r: R, isMain: false })
    if (rightCol[i])
      items.push({ t: rightCol[i]!, cx: rightCx, cy, r: R, isMain: false })
  }

  // 內容範圍 → 等比縮放置中塞進可用區
  let minX = Infinity
  const minY = 0
  let maxX = -Infinity
  let maxY = -Infinity
  for (const it of items) {
    minX = Math.min(minX, it.cx - it.r)
    maxX = Math.max(maxX, it.cx + it.r)
    maxY = Math.max(maxY, it.cy + it.r)
  }
  const contentW = Math.max(1, maxX - minX)
  const contentH = Math.max(1, maxY - minY)
  const availW = A4_W - M * 2
  const availH = A4_H - TITLE_H - M
  const scale = Math.min(availW / contentW, availH / contentH)
  const baseX = M + (availW - contentW * scale) / 2 - minX * scale
  const baseY = TITLE_H + (availH - contentH * scale) / 2 - minY * scale

  // 舞台（內容頂端置中）
  const stageCx = baseX + ((minX + maxX) / 2) * scale
  ctx.strokeStyle = CHART.line
  ctx.setLineDash([4, 3])
  ctx.strokeRect(stageCx - 30, baseY + 2, 60, 16)
  ctx.setLineDash([])
  ctx.textAlign = 'center'
  ctx.fillStyle = CHART.inkFaint
  ctx.font = `9px ${FONT}`
  ctx.fillText('舞台', stageCx, baseY + 13)

  // 桌次圓（位置、半徑、字級皆隨整體縮放）
  for (const it of items) {
    const cx = baseX + it.cx * scale
    const cy = baseY + it.cy * scale
    const r = it.r * scale
    const cat = mealCategory(it.t.tableId)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = cat.fill
    ctx.fill()
    ctx.lineWidth = Math.max(0.8, (it.isMain ? 3 : 2) * scale)
    ctx.strokeStyle = cat.stroke
    ctx.stroke()
    const child = tableMeal(it.t.tableId).child
    const nameFont = Math.max(8, (it.isMain ? 17 : 14) * scale)
    const subFont = Math.max(7, 11 * scale)
    ctx.fillStyle = CHART.ink
    ctx.font = `600 ${nameFont}px ${FONT}`
    ctx.fillText(it.t.tableName, cx, cy - (child > 0 ? subFont + 2 : subFont * 0.4), r * 1.7)
    ctx.font = `${subFont}px ${FONT}`
    ctx.fillStyle = cat.text
    ctx.fillText(cat.label, cx, cy + (child > 0 ? subFont * 0.2 : subFont), r * 1.85)
    if (child > 0) {
      ctx.fillStyle = CHART.veg.stroke
      ctx.fillText(`兒童椅 ${child}`, cx, cy + subFont * 1.6, r * 1.85)
    }
  }

  // 場地標記：下載圖是緊湊重排、無法 1:1 對位 → 以「螢幕座標正規化 0..1 → chart 內容框映射」
  // 保留相對方位（右側送客區仍在右側），以虛線矩形＋label 呈現（比照舞台樣式）
  const markers = venueMarkers.value ?? []
  if (markers.length > 0) {
    const SCREEN_BLOCK = 290
    let sMinX = Infinity
    let sMinY = Infinity
    let sMaxX = -Infinity
    let sMaxY = -Infinity
    for (const t of list) {
      const p = tablePos(t)
      sMinX = Math.min(sMinX, p.x)
      sMinY = Math.min(sMinY, p.y)
      sMaxX = Math.max(sMaxX, p.x + SCREEN_BLOCK)
      sMaxY = Math.max(sMaxY, p.y + SCREEN_BLOCK)
    }
    const sW = Math.max(1, sMaxX - sMinX)
    const sH = Math.max(1, sMaxY - sMinY)
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = CHART.line
    ctx.font = `9px ${FONT}`
    for (const m of markers) {
      const p = markerPos(m)
      const nx = Math.min(1, Math.max(0, (p.x + m.width / 2 - sMinX) / sW))
      const ny = Math.min(1, Math.max(0, (p.y + m.height / 2 - sMinY) / sH))
      const mcx = baseX + (minX + nx * contentW) * scale
      const mcy = baseY + (minY + ny * contentH) * scale
      const mw = Math.min(80, Math.max(32, m.width * 0.4))
      const mh = Math.min(28, Math.max(14, m.height * 0.4))
      ctx.strokeRect(mcx - mw / 2, mcy - mh / 2, mw, mh)
      ctx.fillStyle = CHART.inkFaint
      ctx.fillText(m.label, mcx, mcy + 3, mw - 4)
    }
    ctx.setLineDash([])
  }

  ctx.textAlign = 'start'
  return canvas
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadChartJpeg() {
  buildChartCanvas().toBlob(
    (blob) => {
      if (blob)
        triggerDownload(blob, `桌次圖-${weddingId.value}.jpg`)
      else
        toast.add({ title: '產生圖片失敗，請稍後再試', color: 'error' })
    },
    'image/jpeg',
    0.92,
  )
}

// 自製單張影像 PDF：內嵌 canvas 匯出的 JPEG（DCTDecode），免裝套件
function downloadChartPdf() {
  const canvas = buildChartCanvas()
  const bin = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1] ?? '')
  const jpeg = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++)
    jpeg[i] = bin.charCodeAt(i)

  const enc = (s: string) => new TextEncoder().encode(s)
  const parts: Uint8Array[] = []
  let offset = 0
  const push = (u8: Uint8Array) => {
    parts.push(u8)
    offset += u8.length
  }
  const xref: number[] = []
  const obj = (num: number, head: string, stream?: Uint8Array) => {
    xref[num] = offset
    push(enc(`${num} 0 obj\n${head}`))
    if (stream) {
      push(enc('\nstream\n'))
      push(stream)
      push(enc('\nendstream'))
    }
    push(enc('\nendobj\n'))
  }
  // 頁面用 A4 點數，影像填滿整頁（canvas 本身即 A4 比例，故不變形）
  const content = `q\n${A4_W} 0 0 ${A4_H} 0 0 cm\n/Im0 Do\nQ\n`

  push(enc('%PDF-1.3\n'))
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`)
  obj(4, `<< /Length ${content.length} >>`, enc(content))
  obj(5, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg)
  const xrefStart = offset
  let xs = 'xref\n0 6\n0000000000 65535 f \n'
  for (let i = 1; i <= 5; i++)
    xs += `${String(xref[i]).padStart(10, '0')} 00000 n \n`
  push(enc(xs))
  push(enc(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`))

  triggerDownload(new Blob(parts as BlobPart[], { type: 'application/pdf' }), `桌次圖-${weddingId.value}.pdf`)
}

// 下載桌次圖下拉選單：JPEG / PDF
const downloadItems = [[
  { label: '下載 JPEG', icon: 'i-heroicons-photo', onSelect: () => downloadChartJpeg() },
  { label: '下載 PDF', icon: 'i-heroicons-document-text', onSelect: () => downloadChartPdf() },
]]

// 座位顏色：兒童椅席綠色，否則依男方／女方區分（非性別、是家屬方）
function occupantColorClass(o: { side: GuestSide | null, seatType: 'normal' | 'childChair' }): string {
  if (o.seatType === 'childChair')
    return 'border-success-600 bg-success-100 text-success-700 dark:bg-success-900/40'
  if (o.side === 'bride')
    return 'border-gold bg-gold-light/50 text-gold-deep'
  return 'border-info-600 bg-info-100 text-info-700 dark:bg-info-900/40'
}

// 名單姓名顏色：有兒童椅嬰兒者標綠，否則女方金 / 男方藍
function nameColorClass(g: GuestListItem): string {
  if (g.childChairCount > 0)
    return 'text-success-700'
  return g.side === 'bride' ? 'text-gold-deep' : 'text-info-700'
}

// === 賓客名單側欄：待排席 ===
// 主桌專屬賓客：新郎新娘（新人）與雙方父母（雙親），推薦排序時優先帶入主桌
function isMainTableGuest(g: GuestListItem): boolean {
  return g.category === '新人' || g.category === '雙親'
}
// 縱向尊卑分層（數字小＝越靠主桌/舞台）：新人 → 家屬長輩 → 主管摯友 → 一般同學同事
const FAMILY_CATEGORY_RE = /雙親|父母|家人|家屬|長輩|親戚/
const VIP_CATEGORY_RE = /主管|貴賓|vip|摯友|朋友/i
function seniorityTier(category: string): number {
  if (category === '新人')
    return 0
  if (FAMILY_CATEGORY_RE.test(category))
    return 1
  if (VIP_CATEGORY_RE.test(category))
    return 2
  return 3
}
// 視角：以舞台為上方、面向賓客（由上往下看）。桌位中心 X 供左右分流：中軸線左＝男方、右＝女方
function tableCenterX(table: TableListItem): number {
  return table.positionX + (isMainTable(table) ? 100 : 84)
}

const SIDE_ORDER: Record<GuestSide, number> = { groom: 0, bride: 1 }
// 素食優先（盡量排同一桌）：素食 0、葷食 1
const DIET_ORDER: Record<GuestDiet, number> = { vegetarian: 0, meat: 1 }
// 排序：男方/女方 → 尊卑分層（長輩近主桌）→ 素食優先 → 分類 → 姓名
// （先分男女方分桌；同方內長輩家屬在前、一般同事同學在後；素食集中同桌；同類別相鄰）
function bySeatingPriority(a: GuestListItem, b: GuestListItem) {
  return SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
    || seniorityTier(a.category) - seniorityTier(b.category)
    || DIET_ORDER[a.diet] - DIET_ORDER[b.diet]
    || a.category.localeCompare(b.category, 'zh-Hant')
    || a.name.localeCompare(b.name, 'zh-Hant')
}

const seatedGuestIds = computed(() => {
  const ids = new Set<string>()
  for (const seats of Object.values(seatsByTable.value)) {
    for (const s of seats)
      ids.add(s.guestId)
  }
  return ids
})
const unseatedGuests = computed(() =>
  activeGuests.value.filter(g => !seatedGuestIds.value.has(g.guestId)),
)
const seatedCount = computed(() => activeGuests.value.length - unseatedGuests.value.length)

// 側欄固定依男女方→分類分群顯示，方便辨識
const sidebarGuests = computed(() => [...unseatedGuests.value].sort(bySeatingPriority))

// === 推薦排序：依「主桌帶入新人雙親 × 男左女右 × 長輩近主桌」自動帶入座位 ===
// 規則：① 主桌先帶入新郎新娘與雙方父母（最靠舞台的 C 位）；② 男方親友排中軸線左側、女方排右側；
//      ③ 同側內長輩家屬靠前（近主桌）、一般同學同事靠後；④ 某側專屬桌不足時跨界外溢到後方桌。
const isAutoSeating = ref(false)

async function autoSeat() {
  if (isAutoSeating.value)
    return
  const pending = [...unseatedGuests.value]
  if (pending.length === 0) {
    toast.add({ title: '沒有待排席的賓客', color: 'info' })
    return
  }
  const allTables = tables.value ?? []
  const main = mainTable.value
  const fillTables = allTables.filter(t => !isMainTable(t))
  if (!main && fillTables.length === 0) {
    toast.add({ title: '沒有可安排的桌次', description: '請先新增桌次', color: 'warning' })
    return
  }

  isAutoSeating.value = true
  try {
    // 各桌目前已用正常席人頭（推薦排序在既有座位上接續安排，兒童椅額外不計）
    const usedNormal: Record<string, number> = {}
    for (const t of allTables)
      usedNormal[t.tableId] = tableSeats(t.tableId).filter(s => s.seatType === 'normal').length
    const canFit = (table: TableListItem, guestId: string): boolean =>
      usedNormal[table.tableId]! + guestNormalHeads(guestId) <= table.capacity
    const plan: { tableId: string, guestId: string }[] = []
    const assign = (table: TableListItem, guest: GuestListItem) => {
      usedNormal[table.tableId]! += guestNormalHeads(guest.guestId)
      plan.push({ tableId: table.tableId, guestId: guest.guestId })
    }

    // ① 主桌：先帶入新郎新娘（新人）與雙方父母（雙親）；新郎→新娘→父母依序送出，最靠舞台先排
    if (main) {
      const mainGuests = pending
        .filter(isMainTableGuest)
        .sort((a, b) =>
          seniorityTier(a.category) - seniorityTier(b.category)
          || SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
          || a.name.localeCompare(b.name, 'zh-Hant'))
      for (const g of mainGuests) {
        if (canFit(main, g.guestId))
          assign(main, g)
      }
    }

    // ② 其餘賓客：左右分流 + 縱向尊卑（已排進主桌者排除）
    // 「同分類同桌」開啟時才以分類聚桌；關閉則不強制同類別相鄰（讓開關真正影響排序）
    const clusterByCategory = etiquetteSettings.value?.sameCategoryTogether ?? false
    const restSort = (a: GuestListItem, b: GuestListItem) =>
      SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
      || seniorityTier(a.category) - seniorityTier(b.category)
      || DIET_ORDER[a.diet] - DIET_ORDER[b.diet]
      || (clusterByCategory ? a.category.localeCompare(b.category, 'zh-Hant') : 0)
      || a.name.localeCompare(b.name, 'zh-Hant')
    const planned = new Set(plan.map(p => p.guestId))
    const rest = pending.filter(g => !planned.has(g.guestId)).sort(restSort)

    // 中軸線：以可填入桌的中心 X 取中點，左側＝男方區、右側＝女方區
    const centers = fillTables.map(tableCenterX)
    const axisX = centers.length ? (Math.min(...centers) + Math.max(...centers)) / 2 : 0
    const byFront = (a: TableListItem, b: TableListItem) => a.positionY - b.positionY // Y 小＝靠主桌/舞台＝前排
    const leftTables = fillTables.filter(t => tableCenterX(t) <= axisX).sort(byFront)
    const rightTables = fillTables.filter(t => tableCenterX(t) > axisX).sort(byFront)
    const backmost = [...fillTables].sort((a, b) => b.positionY - a.positionY) // 跨界外溢優先靠後方

    const pickTable = (guest: GuestListItem): TableListItem | null => {
      // 同側專屬區由前往後找第一張坐得下的（長輩已排前面、自然落在靠主桌的前排桌）
      const zone = guest.side === 'groom' ? leftTables : rightTables
      const inZone = zone.find(t => canFit(t, guest.guestId))
      if (inZone)
        return inZone
      // 該側桌不足 → 跨界外溢到後方任一坐得下的桌
      return backmost.find(t => canFit(t, guest.guestId)) ?? null
    }

    for (const g of rest) {
      const table = pickTable(g)
      if (table)
        assign(table, g)
    }

    // 逐筆送出（座號交由後端接續展開，避免同桌併發超賣）
    for (const a of plan)
      await seatGuest(weddingId.value, a.tableId, { guestId: a.guestId, seatNumber: 1 })
    await refreshAll()

    const remain = pending.length - plan.length
    const mainCount = plan.filter(p => p.tableId === main?.tableId).length
    const mainNote = mainCount > 0 ? `主桌帶入 ${mainCount} 位主角／雙親，` : ''
    toast.add({
      title: `已自動帶入 ${plan.length} 位`,
      description: remain > 0
        ? `${mainNote}尚有 ${remain} 位待排席（桌次不足）`
        : `${mainNote}其餘依男左女右、長輩近主桌分流`,
      color: 'success',
    })
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '自動帶入失敗', description: message, color: 'error' })
    await refreshAll()
  }
  finally {
    isAutoSeating.value = false
  }
}

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

// === 拖曳排位 ===
// 拖曳來源：側欄賓客無 from* 欄位；座位上的賓客帶 fromTableId / fromSeatNumber（供移動 / 互換）
interface DragSource { guestId: string, fromTableId?: string, fromSeatNumber?: number }
const dragSource = ref<DragSource | null>(null)
const draggingGuestId = ref<string | null>(null)
const dragOverTableId = ref<string | null>(null)

function endDrag() {
  dragSource.value = null
  draggingGuestId.value = null
  dragOverTableId.value = null
}

async function assignSeat(tableId: string, guestId: string, seatNumber: number) {
  try {
    const body: SeatGuestBody = { guestId, seatNumber }
    await seatGuest(weddingId.value, tableId, body)
    toast.add({ title: `已安排 ${guestName(guestId)} 入座`, color: 'success' })
    await refreshAll()
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '安排失敗，請稍後再試'
    toast.add({ title: '安排失敗', description: message, color: 'error' })
  }
}

// 移動：先取消原座位，再入座新座位
async function moveSeat(guestId: string, fromTableId: string, toTableId: string, toSeat: number) {
  try {
    await unseatGuest(weddingId.value, fromTableId, guestId)
    await seatGuest(weddingId.value, toTableId, { guestId, seatNumber: toSeat })
    toast.add({ title: `已移動 ${guestName(guestId)} 座位`, color: 'success' })
    await refreshAll()
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
    toast.add({ title: '移動失敗', description: message, color: 'error' })
    await refreshAll()
  }
}

// 互換：兩位皆先取消座位，再交叉入座
async function swapSeats(
  a: { guestId: string, tableId: string, seatNumber: number },
  b: { guestId: string, tableId: string, seatNumber: number },
) {
  try {
    await unseatGuest(weddingId.value, a.tableId, a.guestId)
    await unseatGuest(weddingId.value, b.tableId, b.guestId)
    await seatGuest(weddingId.value, b.tableId, { guestId: a.guestId, seatNumber: b.seatNumber })
    await seatGuest(weddingId.value, a.tableId, { guestId: b.guestId, seatNumber: a.seatNumber })
    toast.add({ title: `已互換 ${guestName(a.guestId)} 與 ${guestName(b.guestId)} 座位`, color: 'success' })
    await refreshAll()
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '互換失敗，請稍後再試'
    toast.add({ title: '互換失敗', description: message, color: 'error' })
    await refreshAll()
  }
}

// 側欄賓客拖曳
function onGuestDragStart(event: DragEvent, guestId: string) {
  dragSource.value = { guestId }
  draggingGuestId.value = guestId
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', guestId)
    event.dataTransfer.effectAllowed = 'move'
  }
}
// 座位上的賓客拖曳（供互換 / 移動）
function onSeatDragStart(event: DragEvent, tableId: string, seatNumber: number, guestId: string) {
  dragSource.value = { guestId, fromTableId: tableId, fromSeatNumber: seatNumber }
  draggingGuestId.value = guestId
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', guestId)
    event.dataTransfer.effectAllowed = 'move'
  }
}
function onGuestDragEnd() {
  endDrag()
}
function onTableDragOver(event: DragEvent, tableId: string) {
  event.preventDefault()
  dragOverTableId.value = tableId
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
}
function onTableDragLeave(tableId: string) {
  if (dragOverTableId.value === tableId)
    dragOverTableId.value = null
}

// 拖到整桌：座位上的人→該桌下一個空位；側欄賓客→下一個空位（含兒童加位）
async function onDropToTable(event: DragEvent, table: TableListItem) {
  event.preventDefault()
  const src = dragSource.value
  endDrag()
  if (!src)
    return
  if (src.fromTableId === table.tableId)
    return
  const seat = nextSeatFor(table, src.guestId)
  if (seat == null) {
    toast.add({ title: '桌次已滿，無法再安排座位', color: 'error' })
    return
  }
  if (src.fromTableId && src.fromSeatNumber != null)
    await moveSeat(src.guestId, src.fromTableId, table.tableId, seat)
  else
    await assignSeat(table.tableId, src.guestId, seat)
}

// 拖到某座位：空位→入座 / 移動；已佔位→互換（來源為座位）或改放下一個空位（來源為側欄）
async function onDropToSeat(event: DragEvent, table: TableListItem, seatNumber: number) {
  event.preventDefault()
  event.stopPropagation()
  const src = dragSource.value
  endDrag()
  if (!src)
    return
  const occupant = occupantAt(table.tableId, seatNumber)
  if (occupant && occupant.guestId === src.guestId)
    return
  if (occupant) {
    if (src.fromTableId && src.fromSeatNumber != null) {
      await swapSeats(
        { guestId: src.guestId, tableId: src.fromTableId, seatNumber: src.fromSeatNumber },
        { guestId: occupant.guestId, tableId: table.tableId, seatNumber },
      )
    }
    else {
      // 側欄賓客拖到已佔位 → 改放該桌下一個空位（含兒童加位）
      const seat = nextSeatFor(table, src.guestId)
      if (seat == null) {
        toast.add({ title: '桌次已滿，無法再安排座位', color: 'error' })
        return
      }
      await assignSeat(table.tableId, src.guestId, seat)
    }
  }
  else if (src.fromTableId && src.fromSeatNumber != null) {
    await moveSeat(src.guestId, src.fromTableId, table.tableId, seatNumber)
  }
  else {
    await assignSeat(table.tableId, src.guestId, seatNumber)
  }
}

// === 新增 / 編輯桌次 ===
const tableSchema = z.object({
  tableName: z.string().trim().min(1, '請輸入桌次名稱'),
  capacity: z.number().int().min(1, '座位數至少 1'),
  positionX: z.number().int(),
  positionY: z.number().int(),
})
type TableSchema = z.output<typeof tableSchema>

const isTableFormOpen = ref(false)
const isTableSubmitting = ref(false)
const tableFormError = ref('')
const editingTableId = ref<string | null>(null)
const tableState = reactive<TableSchema>({
  tableName: '',
  capacity: 10,
  positionX: 0,
  positionY: 0,
})

function openCreateTable() {
  editingTableId.value = null
  tableFormError.value = ''
  tableState.tableName = ''
  tableState.capacity = 10
  tableState.positionX = 0
  tableState.positionY = 0
  isTableFormOpen.value = true
}

function openEditTable(table: TableListItem) {
  editingTableId.value = table.tableId
  tableFormError.value = ''
  tableState.tableName = table.tableName
  tableState.capacity = table.capacity
  tableState.positionX = table.positionX
  tableState.positionY = table.positionY
  isTableFormOpen.value = true
}

async function onTableSubmit(event: FormSubmitEvent<TableSchema>) {
  if (isTableSubmitting.value)
    return
  isTableSubmitting.value = true
  tableFormError.value = ''
  try {
    const data = event.data
    if (editingTableId.value) {
      const body: UpdateTableBody = {
        tableName: data.tableName,
        capacity: data.capacity,
        positionX: data.positionX,
        positionY: data.positionY,
      }
      await updateTable(weddingId.value, editingTableId.value, body)
      toast.add({ title: '桌次已更新', color: 'success' })
    }
    else {
      const body: CreateTableBody = {
        tableName: data.tableName,
        capacity: data.capacity,
        positionX: data.positionX,
        positionY: data.positionY,
      }
      await createTable(weddingId.value, body)
      toast.add({ title: '桌次新增成功', color: 'success' })
    }
    isTableFormOpen.value = false
    await refreshAll()
  }
  catch (error: any) {
    tableFormError.value
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isTableSubmitting.value = false
  }
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
  activeGuests.value.map(g => ({ label: g.name, value: g.guestId })),
)
const tableOptions = computed(() =>
  (tables.value ?? []).map(t => ({ label: t.tableName, value: t.tableId })),
)

const isSeatFormOpen = ref(false)
const isSeating = ref(false)
const seatFormError = ref('')
const seatState = reactive<{ guestId: string, tableId: string, seatNumber: number }>({
  guestId: '',
  tableId: '',
  seatNumber: 1,
})

function openSeatForm() {
  seatFormError.value = ''
  seatState.guestId = ''
  seatState.tableId = ''
  seatState.seatNumber = 1
  isSeatFormOpen.value = true
}

// 在 Modal 內改選桌次時，自動建議下一個座位號
function onSeatTableChange(tableId: string) {
  const table = (tables.value ?? []).find(t => t.tableId === tableId)
  seatState.seatNumber = table ? nextFreeSeat(table) : tableSeats(tableId).length + 1
}

async function confirmSeat() {
  if (isSeating.value)
    return
  if (!seatState.guestId || !seatState.tableId) {
    seatFormError.value = '請選擇賓客與桌次'
    return
  }
  isSeating.value = true
  seatFormError.value = ''
  try {
    const body: SeatGuestBody = {
      guestId: seatState.guestId,
      seatNumber: seatState.seatNumber,
    }
    await seatGuest(weddingId.value, seatState.tableId, body)
    toast.add({ title: '已安排座位', color: 'success' })
    isSeatFormOpen.value = false
    await refreshAll()
  }
  catch (error: any) {
    seatFormError.value
      = error?.data?.message || error?.statusMessage || '安排失敗，請稍後再試'
  }
  finally {
    isSeating.value = false
  }
}

// === 取消座位 ===
const isUnseatOpen = ref(false)
const isUnseating = ref(false)
const unseatTarget = ref<{ tableId: string, guestId: string, guestName: string } | null>(null)

function openUnseat(tableId: string, guestId: string) {
  unseatTarget.value = { tableId, guestId, guestName: guestName(guestId) }
  isUnseatOpen.value = true
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

// === 場地佈局 ===
const venueSchema = z.object({
  stageWidth: z.number().int().min(0),
  stageHeight: z.number().int().min(0),
  stagePositionX: z.number().int(),
  stagePositionY: z.number().int(),
})
type VenueSchema = z.output<typeof venueSchema>

const isVenueOpen = ref(false)
const isVenueSubmitting = ref(false)
const venueError = ref('')
const venueState = reactive<VenueSchema>({
  stageWidth: 300,
  stageHeight: 150,
  stagePositionX: 500,
  stagePositionY: 100,
})

function openVenue() {
  venueError.value = ''
  // 用 GET 讀回的既有佈局填入；尚未設定時維持預設值
  const layout = venueLayout.value
  if (layout) {
    venueState.stageWidth = layout.stageWidth
    venueState.stageHeight = layout.stageHeight
    venueState.stagePositionX = layout.stagePositionX
    venueState.stagePositionY = layout.stagePositionY
  }
  isVenueOpen.value = true
}

async function onVenueSubmit(event: FormSubmitEvent<VenueSchema>) {
  if (isVenueSubmitting.value)
    return
  isVenueSubmitting.value = true
  venueError.value = ''
  try {
    const body: VenueLayoutBody = { ...event.data }
    await configureVenueLayout(weddingId.value, body)
    // 以 GET 為呈現真實來源（重整也靠 GET）
    await refreshVenue()
    toast.add({ title: '場地佈局已設定', color: 'success' })
    isVenueOpen.value = false
  }
  catch (error: any) {
    venueError.value
      = error?.data?.message || error?.statusMessage || '設定失敗，請稍後再試'
  }
  finally {
    isVenueSubmitting.value = false
  }
}

// === 禮俗設定 ===
const isEtiquetteOpen = ref(false)
const isEtiquetteSubmitting = ref(false)
const etiquetteError = ref('')
const etiquetteState = reactive<EtiquetteSettings>({
  elderNearMain: true,
  mainTableFull: true,
  sameCategoryTogether: false,
})

function openEtiquette() {
  etiquetteError.value = ''
  // 用 GET 讀回的既有設定填入三開關
  const settings = etiquetteSettings.value
  if (settings) {
    etiquetteState.elderNearMain = settings.elderNearMain
    etiquetteState.mainTableFull = settings.mainTableFull
    etiquetteState.sameCategoryTogether = settings.sameCategoryTogether
  }
  isEtiquetteOpen.value = true
}

async function confirmEtiquette() {
  if (isEtiquetteSubmitting.value)
    return
  isEtiquetteSubmitting.value = true
  etiquetteError.value = ''
  try {
    const body: EtiquetteSettingsBody = { ...etiquetteState }
    await updateEtiquetteSettings(weddingId.value, body)
    // 以 GET 為呈現真實來源（重整也靠 GET）
    await refreshEtiquette()
    toast.add({ title: '禮俗設定已儲存', color: 'success' })
    isEtiquetteOpen.value = false
  }
  catch (error: any) {
    etiquetteError.value
      = error?.data?.message || error?.statusMessage || '儲存失敗，請稍後再試'
  }
  finally {
    isEtiquetteSubmitting.value = false
  }
}

// === 禮俗警告（依設定 + 當前座位即時計算，違反才跳；可忽略） ===
interface SeatingWarning {
  warningId: string
  warningType: string
  message: string
}

// 某桌入座賓客的輩份分層集合（去重賓客後取 seniorityTier）
function tableTierSet(tableId: string): number[] {
  const ids = new Set(tableSeats(tableId).map(s => s.guestId))
  return Array.from(ids, id => seniorityTier(guestById(id)?.category ?? ''))
}

const computedWarnings = computed<SeatingWarning[]>(() => {
  const settings = etiquetteSettings.value
  if (!settings)
    return []
  const list: SeatingWarning[] = []

  // 主桌坐滿：主桌正常席人頭 < capacity 時提醒（求圓滿）
  const main = mainTable.value
  if (settings.mainTableFull && main) {
    const seated = tableNormalHeads(main.tableId)
    if (seated < main.capacity) {
      list.push({
        warningId: 'warning-main-table-full',
        warningType: 'main-table-not-full',
        message: `主桌尚未坐滿（${seated}/${main.capacity} 席），建議坐滿以求圓滿`,
      })
    }
  }

  // 長輩靠近主桌：有長輩／家屬被排在比一般賓客更後方的客桌時提醒
  if (settings.elderNearMain) {
    const fill = (tables.value ?? []).filter(t => !isMainTable(t))
    const elderTables = fill.filter(t => tableTierSet(t.tableId).includes(1)) // tier 1 = 家人／雙親／長輩
    const casualTables = fill.filter(t => tableTierSet(t.tableId).some(tr => tr >= 2)) // tier ≥2 = 一般賓客
    if (elderTables.length && casualTables.length) {
      const maxElderY = Math.max(...elderTables.map(t => t.positionY))
      const minCasualY = Math.min(...casualTables.map(t => t.positionY))
      if (maxElderY > minCasualY) {
        list.push({
          warningId: 'warning-elder-near-main',
          warningType: 'elder-near-main',
          message: '長輩靠近主桌：偵測到長輩／家屬被排在一般賓客後方，建議移到較前排',
        })
      }
    }
  }

  return list
})

const activeWarnings = computed(() =>
  computedWarnings.value.filter(w => !dismissedWarningTypes.value.includes(w.warningType)),
)

const dismissingId = ref<string | null>(null)

async function dismissWarning(warning: SeatingWarning) {
  if (dismissingId.value)
    return
  dismissingId.value = warning.warningId
  try {
    // 仍呼叫 dismiss API（保留覆寫警告合約），並於前端即時隱藏該類型警告
    await dismissEtiquetteWarning(weddingId.value, warning.warningId, {
      warningType: warning.warningType,
    })
    if (!dismissedWarningTypes.value.includes(warning.warningType))
      dismissedWarningTypes.value.push(warning.warningType)
    toast.add({ title: '已忽略警告', color: 'success', duration: 1500 })
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
    toast.add({ title: '操作失敗', description: message, color: 'error' })
  }
  finally {
    dismissingId.value = null
  }
}

// 賓客側欄顯示用：哪一方 · 關係 · 葷素（接在姓名後同一排）
function guestMeta(g: GuestListItem): string {
  const parts = [sideLabel(g.side)]
  if (g.category)
    parts.push(g.category)
  parts.push(dietLabel(g.diet))
  return parts.join(' · ')
}
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
          <UButton
            data-testid="etiquette-settings"
            icon="i-heroicons-cog-6-tooth"
            color="neutral"
            variant="outline"
            @click="openEtiquette"
          >
            禮俗設定
          </UButton>
          <UButton
            data-testid="venue-layout"
            icon="i-heroicons-squares-2x2"
            color="neutral"
            variant="outline"
            @click="openVenue"
          >
            設定場地佈局
          </UButton>
          <!-- 命名避開凍結 strict regex（不可含「新增」「舞台」「佈局」「禮俗」） -->
          <UButton
            data-testid="venue-marker-create"
            icon="i-heroicons-map-pin"
            color="neutral"
            variant="outline"
            @click="openCreateMarker"
          >
            加入標記
          </UButton>
          <!-- 下載桌次圖：餐廳備餐用地圖（含餐點分類）；點開下拉選 JPEG / PDF -->
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

    <!-- 禮俗警告區（精簡：小字、低高度，不擋操作視覺） -->
    <section v-if="activeWarnings.length > 0" data-testid="warning-list" class="mb-3 shrink-0 space-y-1.5">
      <div
        v-for="warning in activeWarnings"
        :key="warning.warningId"
        role="alert"
        :data-testid="`warning-row-${warning.warningId}`"
        :aria-label="warning.message"
        class="flex items-center justify-between gap-3 rounded-md border border-l-[3px] border-line border-l-warning-500 bg-warning-50/60 px-3 py-1.5 dark:border-neutral-800 dark:border-l-warning-500 dark:bg-warning-900/10"
      >
        <div class="flex min-w-0 items-center gap-2">
          <UIcon name="i-heroicons-exclamation-triangle" class="size-4 shrink-0 text-warning-600" />
          <p class="truncate text-caption text-ink-600 dark:text-neutral-300">
            {{ warning.message }}
          </p>
        </div>
        <UButton
          data-testid="warning-dismiss"
          color="warning"
          variant="ghost"
          size="xs"
          :loading="dismissingId === warning.warningId"
          :aria-label="`忽略 ${warning.message}`"
          @click="dismissWarning(warning)"
        >
          忽略
        </UButton>
      </div>
    </section>

    <!-- 兩欄：左 圓桌平面（寬） / 右 賓客名單（窄） -->
    <div class="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      <!-- 左欄：圓桌現場平面圖（min-w-0 讓寬畫布於內部捲動，不把右側名單推出邊界） -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
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
          <!-- 自由佈局畫布：圓桌可拖曳調整位置以因應現場空間 -->
          <div
            data-testid="table-list"
            class="relative mx-auto select-none"
            :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
          >
            <!-- 舞台標示（畫布頂端置中） -->
            <span class="absolute left-1/2 top-0 z-0 -translate-x-1/2 rounded border border-dashed border-line px-10 py-2 text-overline tracking-wider text-ink-300">
              舞台
            </span>

            <!-- 場地標記：可拖曳長方形（純 div、無 landmark role，避開 findEntity 掃描） -->
            <div
              v-for="marker in venueMarkers"
              :key="marker.markerId"
              :data-testid="`venue-marker-${marker.markerId}`"
              class="group absolute flex cursor-move touch-none select-none items-center justify-center rounded border border-dashed border-ink-300 bg-paper/90 px-2 text-center text-caption text-ink-500 shadow-sm dark:border-neutral-600 dark:bg-neutral-900/90 dark:text-neutral-300"
              :class="movingMarkerId === marker.markerId ? 'z-40 ring-2 ring-gold' : 'z-20'"
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
              class="absolute hover:z-50"
              :class="[
                isMainTable(table) ? 'w-[200px]' : 'w-[168px]',
                movingTableId === table.tableId ? 'z-40' : (dragOverTableId === table.tableId ? 'z-30' : 'z-10'),
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
                    @click="openUnseat(table.tableId, slot.occupant.guestId)"
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
                  <!-- 空位：拖曳賓客至此可入座 -->
                  <div
                    v-else
                    :data-testid="`${table.tableId}-empty-${slot.idx + 1}`"
                    class="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed text-ink-300 transition-colors"
                    :class="dragOverTableId === table.tableId
                      ? 'border-gold bg-gold-light/30 text-gold-deep'
                      : 'border-line/70 bg-paper/60 dark:border-neutral-700 dark:bg-neutral-900/40'"
                    :style="{ left: slot.pos.left, top: slot.pos.top }"
                    @dragover="onTableDragOver($event, table.tableId)"
                    @drop="onDropToSeat($event, table, slot.seatNumber)"
                  >
                    <UIcon name="i-heroicons-plus" class="size-4" />
                  </div>
                </template>
              </div>

              <!-- 編輯 / 移除（置於圓桌下方，不遮住座位） -->
              <div class="mt-6 flex justify-center gap-1" @pointerdown.stop>
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
      <aside class="flex min-h-0 flex-col lg:w-[320px] lg:shrink-0">
        <div class="mb-3 flex shrink-0 items-end justify-between gap-3">
          <div>
            <h2 class="font-display text-body-l font-semibold leading-none text-ink dark:text-paper">
              賓客名單
            </h2>
            <p class="mt-1.5 text-caption text-ink-500 dark:text-neutral-400">
              待排席 {{ unseatedGuests.length }} 位 · 已排席 {{ seatedCount }} 位
            </p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-2">
            <!-- 安排座位（表單入口）：置於推薦排序上方 -->
            <UButton
              data-testid="seat-guest"
              icon="i-heroicons-user-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="openSeatForm"
            >
              安排座位
            </UButton>
            <div class="flex items-center gap-2">
              <UButton
                data-testid="vibe-seating-clear"
                icon="i-heroicons-arrow-uturn-left"
                color="neutral"
                variant="outline"
                size="sm"
                :disabled="isClearing || seatedCount === 0"
                @click="openClearAll"
              >
                一鍵取消
              </UButton>
              <UButton
                data-testid="vibe-seating-recommend"
                icon="i-heroicons-sparkles"
                color="primary"
                variant="solid"
                size="sm"
                :loading="isAutoSeating"
                @click="autoSeat"
              >
                推薦排序
              </UButton>
            </div>
          </div>
        </div>

        <p class="mb-3 shrink-0 text-caption text-ink-300">
          點「推薦排序」依「主桌帶入新人與雙親、男左女右、長輩近主桌」自動帶位，或直接拖曳賓客到圓桌座位；座位上的賓客可互相拖曳交換位置
        </p>

        <!-- 待排席賓客（純 div，避免 list/article role 與桌次實體定位衝突） -->
        <div data-testid="vibe-seating-guest-list" class="flex min-h-0 flex-1 flex-col space-y-2 overflow-auto pr-1">
          <EmptyState
            v-if="sidebarGuests.length === 0"
            bordered
            class="flex-1"
            :title="seatedCount > 0 ? '賓客皆已排席' : '目前沒有賓客'"
            :description="seatedCount > 0 ? '' : '請先於賓客管理新增賓客'"
          />
          <div
            v-for="guest in sidebarGuests"
            :key="guest.guestId"
            draggable="true"
            :data-testid="`vibe-seating-guest-${guest.guestId}`"
            class="group flex cursor-grab items-center gap-2 rounded-md border border-line bg-white px-3 py-2 transition-shadow hover:shadow active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-900"
            @dragstart="onGuestDragStart($event, guest.guestId)"
            @dragend="onGuestDragEnd"
          >
            <!-- 姓名（顏色標示男方／女方／兒童）+ 哪一方·關係·葷素 同一排 -->
            <span class="shrink-0 text-body font-medium" :class="nameColorClass(guest)">{{ guest.name }}</span>
            <span class="min-w-0 flex-1 truncate text-caption text-ink-500 dark:text-neutral-400">{{ guestMeta(guest) }}</span>
            <UIcon
              v-if="guest.childChairCount > 0"
              name="i-heroicons-sparkles"
              class="size-4 shrink-0 text-gold-deep"
              title="需兒童椅"
            />
            <UIcon
              name="i-heroicons-bars-3"
              class="size-4 shrink-0 text-ink-300 transition-colors group-hover:text-gold-deep"
            />
          </div>

          <!-- 名單空狀態：小字、不放 icon -->
          <div v-if="sidebarGuests.length === 0" class="px-1 py-6 text-center">
            <p class="text-caption font-medium text-ink-500 dark:text-neutral-400">
              {{ activeGuests.length === 0 ? '目前沒有賓客' : '所有賓客都已排席' }}
            </p>
            <p class="mt-1 text-caption text-ink-300">
              {{ activeGuests.length === 0 ? '請先於賓客管理新增賓客' : '可點選圓桌上的賓客取消座位' }}
            </p>
          </div>
        </div>
      </aside>
    </div>

    <!-- 新增 / 編輯桌次 Modal -->
    <UModal v-model:open="isTableFormOpen">
      <template #content>
        <div data-testid="table-form-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            桌次
          </p>
          <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink">
            {{ editingTableId ? '編輯桌次' : '新增桌次' }}
          </h3>

          <UAlert
            v-if="tableFormError"
            data-testid="table-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="tableFormError"
            class="mb-4"
          />

          <UForm
            :schema="tableSchema"
            :state="tableState"
            class="space-y-4"
            @submit="onTableSubmit"
          >
            <UFormField
              label="桌次名稱"
              name="tableName"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="tableState.tableName"
                data-testid="table-name"
                placeholder="如：主桌、男方家屬桌"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="座位數"
              name="capacity"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model.number="tableState.capacity"
                data-testid="table-capacity"
                type="number"
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="位置 X" name="positionX">
                <UInput
                  v-model.number="tableState.positionX"
                  data-testid="table-position-x"
                  type="number"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="位置 Y" name="positionY">
                <UInput
                  v-model.number="tableState.positionY"
                  data-testid="table-position-y"
                  type="number"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isTableSubmitting"
                @click="isTableFormOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="table-submit"
                color="primary"
                :loading="isTableSubmitting"
              >
                {{ editingTableId ? '儲存' : '新增' }}
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 安排座位 Modal -->
    <UModal v-model:open="isSeatFormOpen">
      <template #content>
        <div data-testid="seat-form-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            座位
          </p>
          <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink">
            安排座位
          </h3>

          <UAlert
            v-if="seatFormError"
            data-testid="seat-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="seatFormError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="賓客" name="guestId">
              <USelectMenu
                v-model="seatState.guestId"
                data-testid="seat-guest-select"
                :items="guestOptions"
                value-key="value"
                placeholder="選擇賓客"
                class="w-full"
              />
            </UFormField>

            <UFormField label="桌次" name="tableId">
              <USelectMenu
                v-model="seatState.tableId"
                data-testid="seat-table-select"
                :items="tableOptions"
                value-key="value"
                placeholder="選擇桌次"
                class="w-full"
                @update:model-value="onSeatTableChange"
              />
            </UFormField>

            <UFormField label="座位號" name="seatNumber">
              <UInput
                v-model.number="seatState.seatNumber"
                data-testid="seat-number"
                type="number"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSeating"
                @click="isSeatFormOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="seat-submit"
                color="primary"
                :loading="isSeating"
                @click="confirmSeat"
              >
                安排
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 場地佈局 Modal -->
    <UModal v-model:open="isVenueOpen">
      <template #content>
        <div data-testid="venue-form-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            場地
          </p>
          <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink">
            設定場地佈局
          </h3>

          <UAlert
            v-if="venueError"
            data-testid="venue-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="venueError"
            class="mb-4"
          />

          <UForm
            :schema="venueSchema"
            :state="venueState"
            class="space-y-4"
            @submit="onVenueSubmit"
          >
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="舞台寬度" name="stageWidth">
                <UInput
                  v-model.number="venueState.stageWidth"
                  data-testid="stage-width"
                  type="number"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="舞台高度" name="stageHeight">
                <UInput
                  v-model.number="venueState.stageHeight"
                  data-testid="stage-height"
                  type="number"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="舞台位置 X" name="stagePositionX">
                <UInput
                  v-model.number="venueState.stagePositionX"
                  data-testid="stage-position-x"
                  type="number"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="舞台位置 Y" name="stagePositionY">
                <UInput
                  v-model.number="venueState.stagePositionY"
                  data-testid="stage-position-y"
                  type="number"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isVenueSubmitting"
                @click="isVenueOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="venue-submit"
                color="primary"
                :loading="isVenueSubmitting"
              >
                儲存
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 禮俗設定 Modal -->
    <UModal v-model:open="isEtiquetteOpen">
      <template #content>
        <div data-testid="etiquette-form-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            禮俗
          </p>
          <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink">
            禮俗建議設定
          </h3>

          <UAlert
            v-if="etiquetteError"
            data-testid="etiquette-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="etiquetteError"
            class="mb-4"
          />

          <div class="space-y-1">
            <p class="mb-2 text-caption text-ink-500 dark:text-neutral-400">
              開關啟用後，只有座位實際違反時才會在上方跳出提醒
            </p>
            <USwitch
              v-model="etiquetteState.elderNearMain"
              data-testid="etiquette-elder-near-main"
              label="長輩靠近主桌"
              description="長輩／家屬被排在一般賓客後方時提醒"
            />
            <USwitch
              v-model="etiquetteState.mainTableFull"
              data-testid="etiquette-main-table-full"
              label="主桌坐滿"
              description="主桌尚未坐滿時提醒（求圓滿）"
            />
            <USwitch
              v-model="etiquetteState.sameCategoryTogether"
              data-testid="etiquette-same-category-together"
              label="同分類同桌"
              description="推薦排序時盡量把同類別賓客排同桌"
            />

            <div class="flex justify-end gap-3 pt-4">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isEtiquetteSubmitting"
                @click="isEtiquetteOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="etiquette-submit"
                color="primary"
                :loading="isEtiquetteSubmitting"
                @click="confirmEtiquette"
              >
                儲存
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

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

    <!-- 取消座位確認 -->
    <ConfirmModal
      v-model:open="isUnseatOpen"
      title="確認取消座位"
      :description="`確定要取消「${unseatTarget?.guestName ?? ''}」的座位嗎？`"
      confirm-label="取消座位"
      confirm-color="error"
      :loading="isUnseating"
      @confirm="confirmUnseat"
    />

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

    <!-- 加入 / 編輯場地標記 Modal -->
    <UModal v-model:open="isMarkerFormOpen">
      <template #content>
        <div data-testid="venue-marker-modal" class="max-h-[85vh] overflow-y-auto p-6">
          <p class="text-overline uppercase text-gold-deep">
            Marker
          </p>
          <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
            {{ editingMarkerId ? '編輯標記' : '加入標記' }}
          </h3>
          <p class="mb-5 mt-1 text-caption text-ink-300">
            在平面圖上標示門口、送客區、進場入口等位置；加入後可直接拖曳調整
          </p>

          <UAlert
            v-if="markerFormError"
            data-testid="venue-marker-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="markerFormError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="標記文字" name="markerLabel">
              <UInput
                v-model="markerDraft.label"
                data-testid="venue-marker-label"
                placeholder="如：門口、送客區、進場入口"
                class="w-full"
                @keyup.enter="submitMarker"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-3">
              <UFormField label="寬（px）" name="markerWidth">
                <UInput
                  v-model.number="markerDraft.width"
                  type="number"
                  min="40"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="高（px）" name="markerHeight">
                <UInput
                  v-model.number="markerDraft.height"
                  type="number"
                  min="24"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div v-if="editingMarkerId" class="grid grid-cols-2 gap-3">
              <UFormField label="X 位置" name="markerX">
                <UInput
                  v-model.number="markerDraft.positionX"
                  type="number"
                  min="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Y 位置" name="markerY">
                <UInput
                  v-model.number="markerDraft.positionY"
                  type="number"
                  min="0"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <div class="mt-6 flex items-center justify-between gap-3">
            <UButton
              v-if="editingMarkerId"
              data-testid="venue-marker-delete"
              icon="i-heroicons-trash"
              color="error"
              variant="outline"
              :loading="isMarkerSubmitting"
              @click="removeMarker"
            >
              刪除標記
            </UButton>
            <span v-else />
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isMarkerSubmitting"
                @click="isMarkerFormOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="venue-marker-submit"
                color="neutral"
                variant="solid"
                :loading="isMarkerSubmitting"
                @click="submitMarker"
              >
                儲存標記
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
