<!-- app/pages/weddings/[weddingId]/seating.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type { GuestDiet, GuestListItem, GuestSide } from '~/types/api/guests'
import type {
  CreateTableBody,
  EtiquetteSettings,
  EtiquetteSettingsBody,
  EtiquetteWarningListItem,
  SeatGuestBody,
  SeatListItem,
  TableListItem,
  UpdateTableBody,
  VenueLayoutBody,
} from '~/types/api/seating'

import { z } from 'zod'

import {
  configureVenueLayout,
  createTable,
  deleteTable,
  dismissEtiquetteWarning,
  getEtiquetteSettings,
  getTableSeats,
  getVenueLayout,
  listEtiquetteWarnings,
  listGuests,
  listTables,
  seatGuest,
  unseatGuest,
  updateEtiquetteSettings,
  updateTable,
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
const { data: warnings, refresh: refreshWarnings } = await listEtiquetteWarnings(weddingId, {
  default: () => [],
})
// 場地佈局與禮俗設定：由 GET 讀回，重整後 modal 仍能還原既有值
const { data: venueLayout, refresh: refreshVenue } = await getVenueLayout(weddingId, {
  default: () => null,
})
const { data: etiquetteSettings, refresh: refreshEtiquette } = await getEtiquetteSettings(weddingId)

const activeGuests = computed(() => (guests.value ?? []).filter(g => !g.deletedAt))
const activeWarnings = computed(() => (warnings.value ?? []).filter(w => !w.dismissed))

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

// 畫布尺寸：依最遠的桌位推算，確保可容納並可捲動
const canvasSize = computed(() => {
  const BLOCK = 290
  const PAD = 48
  let maxX = 0
  let maxY = 0
  for (const t of tables.value ?? []) {
    const p = tablePos(t)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { width: Math.max(640, maxX + BLOCK + PAD), height: Math.max(420, maxY + BLOCK + PAD) }
})

function onTablePointerDown(event: PointerEvent, table: TableListItem) {
  if (event.button !== 0)
    return
  movingTableId.value = table.tableId
  const p = tablePos(table)
  dragStart = { px: event.clientX, py: event.clientY, ox: p.x, oy: p.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
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
    await updateTable(weddingId.value, id, { positionX: pos.x, positionY: pos.y })
    await refreshTables()
  }
  catch (error: any) {
    // 失敗則還原本地覆寫
    delete localPos.value[id]
    const message = error?.data?.message || error?.statusMessage || '移動失敗，請稍後再試'
    toast.add({ title: '移動失敗', description: message, color: 'error' })
  }
}

// 環繞圓桌的座位座標（百分比，從正上方順時針排列）
function seatPositions(count: number) {
  const positions: { left: string, top: string }[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2
    positions.push({
      left: `${(50 + 50 * Math.cos(angle)).toFixed(2)}%`,
      top: `${(50 + 50 * Math.sin(angle)).toFixed(2)}%`,
    })
  }
  return positions
}

// 某桌某座位號的入座賓客（無人則 null）
function occupantAt(tableId: string, seatNumber: number) {
  const seat = tableSeats(tableId).find(s => s.seatNumber === seatNumber)
  if (!seat)
    return null
  return {
    guestId: seat.guestId,
    name: guestName(seat.guestId),
    side: guestSide(seat.guestId),
    needChildSeat: !!guestById(seat.guestId)?.needChildSeat,
  }
}

// 圓桌要畫幾個座位：至少 capacity，若有兒童加位（座號 > capacity）則一併畫出
function slotCount(table: TableListItem): number {
  const maxSeat = tableSeats(table.tableId).reduce((m, s) => Math.max(m, s.seatNumber), 0)
  return Math.max(table.capacity, maxSeat)
}

// 下一個可用座位號（拖曳到整桌時用；建議用）
function nextFreeSeat(table: TableListItem): number {
  const taken = new Set(tableSeats(table.tableId).map(s => s.seatNumber))
  for (let n = 1; n <= table.capacity; n++) {
    if (!taken.has(n))
      return n
  }
  return table.capacity + 1
}

// 該賓客可入座的座位號：大人僅限 1~capacity；需兒童椅者於坐滿後可用 capacity+1 加位。
// 回傳 null 表示此桌對該賓客已滿。
function nextSeatFor(table: TableListItem, guestId: string): number | null {
  const taken = new Set(tableSeats(table.tableId).map(s => s.seatNumber))
  for (let n = 1; n <= table.capacity; n++) {
    if (!taken.has(n))
      return n
  }
  const bonus = table.capacity + 1
  if (guestById(guestId)?.needChildSeat && !taken.has(bonus))
    return bonus
  return null
}

// 已入座者 hover 提示：哪一方 · 關係 · 葷素（姓名已顯示在座位上，不重複以免撞 getByText）
function occupantMeta(guestId: string): string {
  const g = guestById(guestId)
  if (!g)
    return ''
  return `${sideLabel(g.side)} · ${g.category} · ${dietLabel(g.diet)}`
}

// 座位顏色：兒童（需兒童椅）綠色，否則依男方／女方區分（非性別、是家屬方）
function occupantColorClass(o: { side: GuestSide | null, needChildSeat: boolean }): string {
  if (o.needChildSeat)
    return 'border-success-600 bg-success-100 text-success-700 dark:bg-success-900/40'
  if (o.side === 'bride')
    return 'border-gold bg-gold-light/50 text-gold-deep'
  return 'border-info-600 bg-info-100 text-info-700 dark:bg-info-900/40'
}

// 名單姓名顏色：同一套配色（兒童綠 / 女方金 / 男方藍）
function nameColorClass(g: GuestListItem): string {
  if (g.needChildSeat)
    return 'text-success-700'
  return g.side === 'bride' ? 'text-gold-deep' : 'text-info-700'
}

// === 賓客名單側欄：待排席 ===
const SIDE_ORDER: Record<GuestSide, number> = { groom: 0, bride: 1 }
// 素食優先（盡量排同一桌）：素食 0、葷食 1
const DIET_ORDER: Record<GuestDiet, number> = { vegetarian: 0, meat: 1 }
// 排序：男方/女方 → 素食優先 → 分類 → 姓名
// （先分男女方分桌；同方內素食集中同桌；再依同類別相鄰）
function bySeatingPriority(a: GuestListItem, b: GuestListItem) {
  return SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
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

// === 推薦排序：點擊即自動帶入座位 ===
// 規則：男方／女方分桌（不把男方排到女方桌），同方內同類別盡量同桌；主桌保留給 VIP 手動安排。
const isAutoSeating = ref(false)

async function autoSeat() {
  if (isAutoSeating.value)
    return
  // 先分男女方、素食優先、再依分類排序，讓素食集中、同類別相鄰
  const pending = [...unseatedGuests.value].sort(bySeatingPriority)
  if (pending.length === 0) {
    toast.add({ title: '沒有待排席的賓客', color: 'info' })
    return
  }
  // 可填入的桌（排除主桌，保留給 VIP 手動安排）
  const fillTables = (tables.value ?? []).filter(t => !isMainTable(t))
  if (fillTables.length === 0) {
    toast.add({ title: '沒有可安排的桌次', description: '請先新增主桌以外的桌次', color: 'warning' })
    return
  }
  isAutoSeating.value = true
  try {
    // 各桌：已用座號 + 已歸屬的「方」（已有人坐則沿用其方，否則待指定）
    const used: Record<string, Set<number>> = {}
    const tableSide: Record<string, GuestSide | null> = {}
    for (const t of fillTables) {
      const seats = tableSeats(t.tableId)
      used[t.tableId] = new Set(seats.map(s => s.seatNumber))
      tableSide[t.tableId] = seats.length ? guestSide(seats[0]!.guestId) : null
    }

    // 該桌對此賓客的下一個可坐座號（含兒童加位）；滿則回傳 null
    const localSeat = (table: TableListItem, guestId: string, taken: Set<number>): number | null => {
      for (let n = 1; n <= table.capacity; n++) {
        if (!taken.has(n))
          return n
      }
      if (guestById(guestId)?.needChildSeat && !taken.has(table.capacity + 1))
        return table.capacity + 1
      return null
    }
    // 為賓客挑桌：先找「同方且有空位」續坐聚桌，否則開一張尚未歸屬的空桌；都沒有則 null
    const pickTable = (guest: GuestListItem): TableListItem | null => {
      for (const t of fillTables) {
        if (tableSide[t.tableId] === guest.side && localSeat(t, guest.guestId, used[t.tableId]!) != null)
          return t
      }
      for (const t of fillTables) {
        if (tableSide[t.tableId] === null && localSeat(t, guest.guestId, used[t.tableId]!) != null)
          return t
      }
      return null
    }

    const plan: { tableId: string, guestId: string, seatNumber: number }[] = []
    for (const g of pending) {
      const table = pickTable(g)
      if (!table)
        continue
      const seatNumber = localSeat(table, g.guestId, used[table.tableId]!)!
      used[table.tableId]!.add(seatNumber)
      tableSide[table.tableId] = g.side
      plan.push({ tableId: table.tableId, guestId: g.guestId, seatNumber })
    }

    // 逐筆送出（同步座號，避免同桌併發超賣）
    for (const a of plan)
      await seatGuest(weddingId.value, a.tableId, { guestId: a.guestId, seatNumber: a.seatNumber })
    await refreshAll()

    const remain = pending.length - plan.length
    toast.add({
      title: `已自動帶入 ${plan.length} 位`,
      description: remain > 0 ? `尚有 ${remain} 位待排席（桌次不足）` : '男方／女方已分桌，素食與同類別盡量同桌',
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
    const all: { tableId: string, guestId: string }[] = []
    for (const [tableId, seats] of Object.entries(seatsByTable.value)) {
      for (const s of seats)
        all.push({ tableId, guestId: s.guestId })
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
  conflictWarning: true,
  genderSeparation: true,
  mainTableNearStage: true,
  sameCategoryTogether: false,
})

function openEtiquette() {
  etiquetteError.value = ''
  // 用 GET 讀回的既有設定填入五開關
  const settings = etiquetteSettings.value
  if (settings) {
    etiquetteState.elderNearMain = settings.elderNearMain
    etiquetteState.conflictWarning = settings.conflictWarning
    etiquetteState.genderSeparation = settings.genderSeparation
    etiquetteState.mainTableNearStage = settings.mainTableNearStage
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

// === 覆寫禮俗警告 ===
const dismissingId = ref<string | null>(null)

async function dismissWarning(warning: EtiquetteWarningListItem) {
  if (dismissingId.value)
    return
  dismissingId.value = warning.warningId
  try {
    await dismissEtiquetteWarning(weddingId.value, warning.warningId, {
      warningType: warning.warningType,
    })
    toast.add({ title: '已忽略警告', color: 'success' })
    await refreshWarnings()
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
          <UButton
            data-testid="seat-guest"
            icon="i-heroicons-user-plus"
            color="neutral"
            variant="outline"
            @click="openSeatForm"
          >
            安排座位
          </UButton>
          <UButton
            data-testid="table-create"
            icon="i-heroicons-plus"
            color="neutral"
            variant="solid"
            @click="openCreateTable"
          >
            新增桌
          </UButton>
        </div>
      </template>
    </PageHeader>

    <!-- 禮俗警告區（全寬） -->
    <section v-if="activeWarnings.length > 0" data-testid="warning-list" class="mb-6 shrink-0 space-y-3">
      <div
        v-for="warning in activeWarnings"
        :key="warning.warningId"
        role="alert"
        :data-testid="`warning-row-${warning.warningId}`"
        :aria-label="warning.message"
        class="flex items-start justify-between gap-4 rounded-lg border border-l-[3px] border-line border-l-warning-500 bg-paper p-4 dark:border-neutral-800 dark:border-l-warning-500 dark:bg-neutral-900"
      >
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 size-5 shrink-0 text-warning-600" />
          <p class="text-body text-ink-700 dark:text-neutral-200">
            {{ warning.message }}
          </p>
        </div>
        <UButton
          data-testid="warning-dismiss"
          color="warning"
          variant="ghost"
          size="sm"
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
      <!-- 左欄：圓桌現場平面圖 -->
      <div class="flex min-h-0 flex-1 flex-col">
        <div
          v-if="(tables ?? []).length === 0"
          data-testid="table-list-empty"
        >
          <EmptyState
            title="目前沒有桌次"
            description="點擊右上「新增桌」開始規劃座位"
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
                  @pointermove="onTablePointerMove"
                  @pointerup="onTablePointerUp"
                  @dragover="onTableDragOver($event, table.tableId)"
                  @drop="onDropToTable($event, table)"
                >
                  <span
                    class="line-clamp-2 font-display font-semibold leading-tight text-ink dark:text-paper"
                    :class="isMainTable(table) ? 'text-lg' : 'text-base'"
                  >{{ table.tableName }}</span>
                  <span class="mt-0.5 text-caption text-ink-300">{{ table.capacity }} 席</span>
                </div>

                <!-- 座位環（座位數含兒童加位） -->
                <template v-for="(pos, idx) in seatPositions(slotCount(table))" :key="idx">
                  <!-- 已入座：點擊取消座位、可拖曳互換 / 移動座位（兒童綠 / 女方金 / 男方藍） -->
                  <button
                    v-if="occupantAt(table.tableId, idx + 1)"
                    type="button"
                    draggable="true"
                    :data-testid="`${table.tableId}-seat-${idx + 1}`"
                    :aria-label="`取消座位 ${occupantAt(table.tableId, idx + 1)!.name}`"
                    class="group/seat absolute z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 text-center text-[10px] font-medium leading-none shadow-sm transition-transform hover:z-50 hover:scale-110 active:cursor-grabbing"
                    :class="occupantColorClass(occupantAt(table.tableId, idx + 1)!)"
                    :style="{ left: pos.left, top: pos.top }"
                    @click="openUnseat(table.tableId, occupantAt(table.tableId, idx + 1)!.guestId)"
                    @dragstart="onSeatDragStart($event, table.tableId, idx + 1, occupantAt(table.tableId, idx + 1)!.guestId)"
                    @dragend="onGuestDragEnd"
                    @dragover="onTableDragOver($event, table.tableId)"
                    @drop="onDropToSeat($event, table, idx + 1)"
                  >
                    <span class="line-clamp-2 px-0.5">{{ occupantAt(table.tableId, idx + 1)!.name }}</span>
                    <!-- hover 提示：哪一方 · 關係 · 葷素（即時可見，取代不穩定的原生 title） -->
                    <span
                      class="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-normal leading-none text-paper shadow-lg group-hover/seat:block dark:bg-neutral-700"
                    >
                      {{ occupantMeta(occupantAt(table.tableId, idx + 1)!.guestId) }}
                    </span>
                  </button>
                  <!-- 空位：拖曳賓客至此可入座 -->
                  <div
                    v-else
                    :data-testid="`${table.tableId}-empty-${idx + 1}`"
                    class="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed text-ink-300 transition-colors"
                    :class="dragOverTableId === table.tableId
                      ? 'border-gold bg-gold-light/30 text-gold-deep'
                      : 'border-line/70 bg-paper/60 dark:border-neutral-700 dark:bg-neutral-900/40'"
                    :style="{ left: pos.left, top: pos.top }"
                    @dragover="onTableDragOver($event, table.tableId)"
                    @drop="onDropToSeat($event, table, idx + 1)"
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
            <h2 class="font-display text-xl font-semibold leading-none text-ink dark:text-paper">
              賓客名單
            </h2>
            <p class="mt-1.5 text-caption text-ink-500 dark:text-neutral-400">
              待排席 {{ unseatedGuests.length }} 位 · 已排席 {{ seatedCount }} 位
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
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

        <p class="mb-3 shrink-0 text-caption text-ink-300">
          點「推薦排序」自動將同類別賓客帶入同桌，或直接拖曳賓客到圓桌座位；座位上的賓客可互相拖曳交換位置
        </p>

        <!-- 待排席賓客（純 div，避免 list/article role 與桌次實體定位衝突） -->
        <div data-testid="vibe-seating-guest-list" class="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
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
              v-if="guest.needChildSeat"
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
          <h3 class="mb-4 mt-1 font-display text-h2 text-ink">
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
          <h3 class="mb-4 mt-1 font-display text-h2 text-ink">
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
          <h3 class="mb-4 mt-1 font-display text-h2 text-ink">
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
          <h3 class="mb-4 mt-1 font-display text-h2 text-ink">
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

          <div class="space-y-3">
            <USwitch
              v-model="etiquetteState.elderNearMain"
              data-testid="etiquette-elder-near-main"
              label="長輩靠近主桌"
            />
            <USwitch
              v-model="etiquetteState.conflictWarning"
              data-testid="etiquette-conflict-warning"
              label="衝突警告"
            />
            <USwitch
              v-model="etiquetteState.mainTableNearStage"
              data-testid="etiquette-main-table-near-stage"
              label="主桌靠近舞台"
            />
            <USwitch
              v-model="etiquetteState.sameCategoryTogether"
              data-testid="etiquette-same-category-together"
              label="同分類同桌"
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
          <h3 class="font-display text-h2 text-ink">
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
  </div>
</template>
