<!-- app/pages/reception/index.vue -->
<script setup lang="ts">
import type { CreateGuestBody, GuestListItem } from '~/types/api/guests'
import type {
  DistributeCakeBoxBody,
  ReceptionStatusItem,
  RecordGiftMoneyBody,
  UpdateGiftMoneyBody,
} from '~/types/api/reception'
import type {
  CreateTableBody,
  SeatGuestBody,
  SeatListItem,
  TableListItem,
} from '~/types/api/seating'
import {
  checkInGuest,
  createGuest,
  createTable,
  distributeCakeBox,
  getReceptionStatus,
  listCakeBoxAssignments,
  listCakeBoxTypes,
  listGuests,
  listTables,
  listWeddingSeats,
  recordGiftMoney,
  seatGuest,
  updateGiftMoney,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
// 禮金彙總屬對帳視角：僅管理者／新人可見，現場共用接待帳號不顯示入口
const authStore = useAuthStore()

// 頂列身分膠囊：顯示實際登入身分（原為寫死「接待 · 共用帳號」，管理者／新人登入時會誤導）
const identityLabel = computed(() => {
  if (authStore.isCouple)
    return '新人 · 婚禮主'
  if (authStore.isAdmin)
    return '主辦 · 管理員'
  return '接待 · 共用帳號'
})
// weddingId 由查詢字串帶入（沿用既有模式），預設 wedding-001
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

// === 資料載入（彼此獨立：先同步呼叫、再一起 await，消 waterfall）===
// 賓客清單（現場新增臨時賓客後 refresh，左欄報到名單即時更新）
const guestsAsync = listGuests(weddingId, { default: () => [] })
// 喜餅款式（供發放選擇）
const cakeTypesAsync = listCakeBoxTypes(weddingId, { default: () => [] })
// 後台逐位指定的喜餅款式（接待端據此顯示「指定款式」並可打勾發放）
const cakeAssignAsync = listCakeBoxAssignments(weddingId, { default: () => [] })
// 報到／禮金／喜餅狀態（GuestListItem 不含這些欄位，見下方 status 區）
const statusAsync = getReceptionStatus(weddingId, { default: () => [] })
// 現場桌次圖：桌次 + 全婚禮座位（一次抓，取代逐桌 N 請求）
const tablesAsync = listTables(weddingId, { default: () => [] })
const seatsAsync = listWeddingSeats(weddingId, { default: () => [] })
await Promise.all([guestsAsync, cakeTypesAsync, cakeAssignAsync, statusAsync, tablesAsync, seatsAsync])
const { data: guests, refresh: refreshGuests } = guestsAsync
const { data: cakeBoxTypes } = cakeTypesAsync
const { data: cakeAssignments, refresh: refreshCakeAssignments } = cakeAssignAsync
const { data: receptionStatus, refresh: refreshStatus } = statusAsync
const { data: tables, refresh: refreshTables } = tablesAsync
const { data: allSeats, refresh: refreshSeats } = seatsAsync

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

const cakeTypeOptions = computed(() =>
  (cakeBoxTypes.value ?? []).map(t => ({ label: t.name, value: t.cakeBoxTypeId })),
)

// guestId → 指定款式（同一賓客取第一筆指派）
const assignedCakeByGuest = computed(() => {
  const map = new Map<string, { typeId: string, typeName: string }>()
  for (const a of cakeAssignments.value ?? []) {
    if (!map.has(a.guestId))
      map.set(a.guestId, { typeId: a.cakeBoxTypeId, typeName: a.cakeBoxTypeName })
  }
  return map
})

function assignedCake(guestId: string) {
  return assignedCakeByGuest.value.get(guestId) ?? null
}

function cakeTypeName(typeId: string | null): string {
  if (!typeId)
    return ''
  return (cakeBoxTypes.value ?? []).find(t => t.cakeBoxTypeId === typeId)?.name ?? ''
}

// 顯示文字
const sideLabel = (s: GuestListItem['side']) => (s === 'groom' ? '男方' : '女方')
const dietLabel = (d: GuestListItem['diet']) => (d === 'meat' ? '葷食' : '素食')
function guestDetail(g: GuestListItem) {
  const parts = [sideLabel(g.side), dietLabel(g.diet)]
  if (g.category)
    parts.push(g.category)
  return parts.join(' · ')
}

// === 報到搜尋（畫面1）===
const searchTerm = ref('')

// 禮金快速金額（接待確認用）
const quickAmounts = [1200, 3600, 6000, 12000]

// 接待狀態：報到 / 禮金 / 喜餅
// GuestListItem 不含接待狀態欄位，改由 reception-status 端點取得，操作後就地更新
type ReceptionStatus = Omit<ReceptionStatusItem, 'guestId'>
const status = reactive<Record<string, ReceptionStatus>>({})

watchEffect(() => {
  for (const item of receptionStatus.value ?? []) {
    status[item.guestId] = {
      checkedIn: item.checkedIn,
      giftAmount: item.giftAmount,
      cakeBoxTypeId: item.cakeBoxTypeId,
    }
  }
})

function ensureStatus(guestId: string): ReceptionStatus {
  if (!status[guestId])
    status[guestId] = { checkedIn: false, giftAmount: null, cakeBoxTypeId: null }
  return status[guestId]!
}

// 搜尋比對不分大小寫；「只看未報到」供現場尖峰把已報到者濾掉（依 status 判斷，故置於其後）
const showOnlyUnchecked = ref(false)
const filteredGuests = computed(() => {
  const t = searchTerm.value.trim().toLowerCase()
  const list = showOnlyUnchecked.value
    ? activeGuests.value.filter(g => !status[g.guestId]?.checkedIn)
    : activeGuests.value
  if (!t)
    return list
  return list.filter(g => g.name.toLowerCase().includes(t))
})

// 已報到人數 + 總報到率（供頂部計數）
const checkedInCount = computed(
  () => activeGuests.value.filter(g => status[g.guestId]?.checkedIn).length,
)
const checkInRate = computed(() => {
  const total = activeGuests.value.length
  return total ? Math.round((checkedInCount.value / total) * 100) : 0
})

// === 報到 ===
// 報到成功後的大字桌次回饋（issue #25）：賓客報到完第一句話是「我坐哪桌」，
// 單筆與批量共用；下一次報到覆蓋，不用計時器（避免時序敏感測試）
const lastCheckIns = ref<{ name: string, table: string }[]>([])

const checkingInId = ref<string | null>(null)
async function checkIn(guest: GuestListItem) {
  if (checkingInId.value)
    return
  checkingInId.value = guest.guestId
  try {
    await checkInGuest(weddingId.value, guest.guestId)
    ensureStatus(guest.guestId).checkedIn = true
    lastCheckIns.value = [{ name: guest.name, table: guestTable(guest) }]
    toast.add({ title: `${guest.name} 報到成功`, color: 'success' })
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '報到失敗，請稍後再試'
    toast.add({ title: '報到失敗', description: message, color: 'error' })
  }
  finally {
    checkingInId.value = null
  }
}

// === 批量報到（多選模式，issue #25）===
// 尖峰時段同行多組一次完成；沿用單筆 check-in 端點逐筆呼叫，不動凍結合約
const batchMode = ref(false)
const selectedIds = ref(new Set<string>())
const isBatchChecking = ref(false)

// 可勾選對象：目前篩選結果中尚未報到者
const selectableGuests = computed(() =>
  filteredGuests.value.filter(g => !status[g.guestId]?.checkedIn),
)

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  selectedIds.value = new Set()
}

function toggleSelect(guestId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(guestId))
    next.delete(guestId)
  else
    next.add(guestId)
  selectedIds.value = next
}

function selectAllFiltered() {
  selectedIds.value = new Set(selectableGuests.value.map(g => g.guestId))
}

async function batchCheckIn() {
  if (isBatchChecking.value || selectedIds.value.size === 0)
    return
  isBatchChecking.value = true
  const targets = selectableGuests.value.filter(g => selectedIds.value.has(g.guestId))
  try {
    const results = await Promise.allSettled(
      targets.map(g => checkInGuest(weddingId.value, g.guestId)),
    )
    const succeeded: GuestListItem[] = []
    const failedNames: string[] = []
    results.forEach((r, i) => {
      const guest = targets[i]!
      if (r.status === 'fulfilled') {
        ensureStatus(guest.guestId).checkedIn = true
        succeeded.push(guest)
      }
      else {
        failedNames.push(guest.name)
      }
    })
    if (succeeded.length) {
      lastCheckIns.value = succeeded.map(g => ({ name: g.name, table: guestTable(g) }))
      toast.add({ title: `已報到 ${succeeded.length} 組`, color: 'success' })
    }
    if (failedNames.length) {
      toast.add({ title: `報到失敗 ${failedNames.length} 組`, description: failedNames.join('、'), color: 'error' })
    }
    batchMode.value = false
    selectedIds.value = new Set()
  }
  finally {
    isBatchChecking.value = false
  }
}

// === 禮金彙總（issue #25）===
// 宴後對帳視圖：由賓客清單 × 接待狀態衍生，零新端點
const isGiftSummaryOpen = ref(false)

const giftRecords = computed(() =>
  activeGuests.value
    .map(g => ({ guest: g, amount: status[g.guestId]?.giftAmount ?? null }))
    .filter((r): r is { guest: GuestListItem, amount: number } => r.amount != null),
)
const giftTotal = computed(() => giftRecords.value.reduce((sum, r) => sum + r.amount, 0))
const giftBySide = computed(() => {
  const summary = {
    groom: { amount: 0, count: 0 },
    bride: { amount: 0, count: 0 },
  }
  for (const r of giftRecords.value) {
    summary[r.guest.side].amount += r.amount
    summary[r.guest.side].count++
  }
  return summary
})

// === 禮金登記 / 更正 ===
const isGiftOpen = ref(false)
const isGiftSubmitting = ref(false)
const giftError = ref('')
const giftTarget = ref<GuestListItem | null>(null)
const giftIsUpdate = ref(false)
const giftAmount = ref<number | null>(null)

function openGift(guest: GuestListItem) {
  giftTarget.value = guest
  giftError.value = ''
  const current = ensureStatus(guest.guestId).giftAmount
  giftIsUpdate.value = current !== null
  giftAmount.value = current
  isGiftOpen.value = true
}

async function submitGift() {
  if (!giftTarget.value || isGiftSubmitting.value)
    return
  const amount = Number(giftAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) {
    giftError.value = '請輸入禮金金額'
    return
  }
  isGiftSubmitting.value = true
  giftError.value = ''
  const guestId = giftTarget.value.guestId
  try {
    if (giftIsUpdate.value) {
      const body: UpdateGiftMoneyBody = { amount }
      await updateGiftMoney(weddingId.value, guestId, body)
      toast.add({ title: '禮金已更正', color: 'success' })
    }
    else {
      const body: RecordGiftMoneyBody = { amount }
      await recordGiftMoney(weddingId.value, guestId, body)
      toast.add({ title: '禮金登記成功', color: 'success' })
    }
    ensureStatus(guestId).giftAmount = amount
    isGiftOpen.value = false
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複觸發 strict mode）
    giftError.value
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isGiftSubmitting.value = false
  }
}

// === 喜餅發放 ===
const isCakeOpen = ref(false)
const isCakeSubmitting = ref(false)
const cakeError = ref('')
const cakeTarget = ref<GuestListItem | null>(null)
const cakeTypeId = ref('')

function openCake(guest: GuestListItem) {
  cakeTarget.value = guest
  cakeError.value = ''
  // 預選後台指定的款式（沒有指定則留空待手動選）
  cakeTypeId.value = assignedCake(guest.guestId)?.typeId ?? ''
  isCakeOpen.value = true
}

// 卡片打勾即發放：直接發放後台指定的款式（無指定則不動作，改用「發放喜餅」選款）
const quickDistributingId = ref<string | null>(null)
async function quickDistribute(guest: GuestListItem) {
  const assigned = assignedCake(guest.guestId)
  if (!assigned || quickDistributingId.value)
    return
  quickDistributingId.value = guest.guestId
  try {
    const body: DistributeCakeBoxBody = { cakeBoxTypeId: assigned.typeId }
    await distributeCakeBox(weddingId.value, guest.guestId, body)
    ensureStatus(guest.guestId).cakeBoxTypeId = assigned.typeId
    toast.add({ title: `${guest.name} 喜餅發放成功`, color: 'success' })
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '發放失敗，請稍後再試'
    toast.add({ title: '發放失敗', description: message, color: 'error' })
  }
  finally {
    quickDistributingId.value = null
  }
}

// ===========================================================================
// 現場桌次圖：桌次與座位於頂部一次載入，供接待人員比照，並可現場新增桌次 / 安排座位
// ===========================================================================
// 每張桌的座位（key = tableId；每桌保證有 key，無座位為空陣列）
const seatsByTable = computed<Record<string, SeatListItem[]>>(() => {
  const map: Record<string, SeatListItem[]> = {}
  for (const t of tables.value ?? [])
    map[t.tableId] = []
  for (const s of allSeats.value ?? [])
    (map[s.tableId] ??= []).push(s)
  return map
})

async function refreshSeating() {
  await Promise.all([refreshTables(), refreshSeats()])
}

// 現場即時性：自助報到、其他接待機的操作、後台排座位的變動，
// 都不會推播到本頁——以短輪詢靜默同步（背景分頁暫停；本地操作進行中跳過，避免舊資料蓋掉剛寫入的狀態）。
// mock 階段無推播機制；正式 M0 改 SSE/WebSocket。
const POLL_MS = 5000
let pollTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  pollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible')
      return
    if (checkingInId.value || isBatchChecking.value || isGiftSubmitting.value || isCakeSubmitting.value || quickDistributingId.value)
      return
    Promise.all([
      refreshGuests(),
      refreshStatus(),
      refreshCakeAssignments(),
      refreshSeating(),
    ]).catch(() => {})
  }, POLL_MS)
})
onUnmounted(() => {
  if (pollTimer)
    clearInterval(pollTimer)
})

function tableSeats(tableId: string): SeatListItem[] {
  return seatsByTable.value[tableId] ?? []
}

// 主桌（單一桌、面對舞台）與其餘桌（雙數並列）；主桌由名稱判定，退回第一桌
const mainTable = computed(() =>
  (tables.value ?? []).find(t => t.tableName.includes('主桌')) ?? (tables.value ?? [])[0] ?? null,
)
const orderedTables = computed(() => {
  const main = mainTable.value
  const rest = (tables.value ?? []).filter(t => t.tableId !== main?.tableId)
  return main ? [main, ...rest] : rest
})
function isMainTable(table: TableListItem): boolean {
  return mainTable.value?.tableId === table.tableId
}

// guestId → 實際入座桌名（接待卡片優先顯示實際入座，未入座則退回預排桌次）
const seatedTableByGuest = computed(() => {
  const nameById = new Map((tables.value ?? []).map(t => [t.tableId, t.tableName]))
  const map = new Map<string, string>()
  for (const [tableId, seats] of Object.entries(seatsByTable.value)) {
    const name = nameById.get(tableId)
    if (!name)
      continue
    for (const seat of seats)
      map.set(seat.guestId, name)
  }
  return map
})

function guestTable(guest: GuestListItem): string {
  return seatedTableByGuest.value.get(guest.guestId) ?? guest.tableName ?? '未排桌'
}

// === 現場新增桌次 ===
const isTableOpen = ref(false)
const isTableSubmitting = ref(false)
const tableError = ref('')
const tableForm = reactive<{ tableName: string, capacity: number }>({
  tableName: '',
  capacity: 10,
})

function openTable() {
  tableError.value = ''
  tableForm.tableName = ''
  tableForm.capacity = 10
  isTableOpen.value = true
}

async function submitTable() {
  if (isTableSubmitting.value)
    return
  if (!tableForm.tableName.trim()) {
    tableError.value = '請輸入桌次名稱'
    return
  }
  isTableSubmitting.value = true
  tableError.value = ''
  try {
    // 位置交由桌次規劃頁細調，現場新增預設置於畫布原點
    const body: CreateTableBody = {
      tableName: tableForm.tableName.trim(),
      capacity: Number(tableForm.capacity) || 1,
      positionX: 0,
      positionY: 0,
    }
    await createTable(weddingId.value, body)
    toast.add({ title: '桌次新增成功', color: 'success' })
    isTableOpen.value = false
    await refreshSeating()
  }
  catch (error: any) {
    tableError.value
      = error?.data?.message || error?.statusMessage || '新增失敗，請稍後再試'
  }
  finally {
    isTableSubmitting.value = false
  }
}

// === 現場新增賓客（可一併指定桌次入座）===
// 接待現場臨時來客先建檔（建完即出現在報到名單，可報到 / 禮金 / 喜餅）；可選擇桌次當場入座
const isGuestOpen = ref(false)
const isGuestSubmitting = ref(false)
const guestError = ref('')
// 「先不排桌」哨兵值（不可用空字串：USelectMenu/Combobox 禁止空字串 value，否則下拉打不開）
const NO_TABLE = '__none__'
const newGuestForm = reactive<{
  name: string
  side: GuestListItem['side']
  diet: GuestListItem['diet']
  category: string
  contact: string
  plusOneCount: number // 同行人數（攜伴大人＋會自己坐吃大人菜的小孩；皆佔正常席）
  childChairCount: number // 兒童椅嬰兒數（不佔正常席、額外加位）
  tableId: string // 哨兵 NO_TABLE = 先不排桌
}>({
  name: '',
  side: 'groom',
  diet: 'meat',
  category: '',
  contact: '',
  plusOneCount: 0,
  childChairCount: 0,
  tableId: NO_TABLE,
})
const sideOptions = [
  { label: '男方', value: 'groom' },
  { label: '女方', value: 'bride' },
]
const dietOptions = [
  { label: '葷食', value: 'meat' },
  { label: '素食', value: 'vegetarian' },
]
// 一桌正常席已用人頭（兒童椅不計）
function normalSeatCount(tableId: string): number {
  return tableSeats(tableId).filter(s => s.seatType === 'normal').length
}
// 一桌兒童椅嬰兒數
function childChairCount(tableId: string): number {
  return tableSeats(tableId).filter(s => s.seatType === 'childChair').length
}
// 席位標籤：正常席「名字N」、兒童椅「名字-兒童N」
function seatLabel(seat: SeatListItem): string {
  const name = (guests.value ?? []).find(g => g.guestId === seat.guestId)?.name ?? '賓客'
  return seat.seatType === 'childChair' ? `${name}-兒童${seat.partyIndex}` : `${name}${seat.partyIndex}`
}
// 此席位的賓客是否已報到（整組共用同一報到狀態）
function isSeatCheckedIn(seat: SeatListItem): boolean {
  return status[seat.guestId]?.checkedIn ?? false
}
// 桌次圖席位顏色：依報到狀態區分——已報到實心綠、未報到虛線淡，接待一眼看出誰到了
function seatChipClass(seat: SeatListItem): string {
  return isSeatCheckedIn(seat)
    ? 'border border-success-600 bg-success-500 text-white'
    : 'border border-dashed border-ink-200 bg-paper text-ink-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500'
}
// 此組正常席人頭 = 本人 + 同行
const newGuestNormalHeads = computed(() => 1 + (Number(newGuestForm.plusOneCount) || 0))
// 桌次選項：首項為「先不排桌」，其餘標示正常席入座 / 座位數，現場一眼看出哪桌還有空位
const tableOptions = computed(() => [
  { label: '先不排桌', value: NO_TABLE },
  ...(tables.value ?? []).map(t => ({
    label: `${t.tableName}（${normalSeatCount(t.tableId)}/${t.capacity}）`,
    value: t.tableId,
  })),
])

// 選定桌次的剩餘正常席提示（隨同行 / 兒童椅即時更新；兒童椅額外不佔 capacity）
const seatHint = computed(() => {
  const t = (tables.value ?? []).find(x => x.tableId === newGuestForm.tableId)
  if (!t)
    return ''
  const occupied = normalSeatCount(t.tableId)
  const remaining = t.capacity - occupied
  const need = newGuestNormalHeads.value
  const childNote = Number(newGuestForm.childChairCount) > 0
    ? `，另含 ${newGuestForm.childChairCount} 張兒童椅（額外加位）`
    : ''
  return remaining >= need
    ? `${t.tableName} 正常席尚可坐 ${remaining} 位，此組需 ${need} 位${childNote}（目前 ${occupied}/${t.capacity}）`
    : `${t.tableName} 正常席不足：尚可坐 ${remaining} 位、此組需 ${need} 位${childNote}`
})

function openGuest() {
  guestError.value = ''
  newGuestForm.name = ''
  newGuestForm.side = 'groom'
  newGuestForm.diet = 'meat'
  newGuestForm.category = ''
  newGuestForm.contact = ''
  newGuestForm.plusOneCount = 0
  newGuestForm.childChairCount = 0
  newGuestForm.tableId = NO_TABLE
  isGuestOpen.value = true
}

async function submitGuest() {
  if (isGuestSubmitting.value)
    return
  if (!newGuestForm.name.trim()) {
    guestError.value = '請輸入賓客姓名'
    return
  }
  // 若選了桌次：先以同一容量規則前端預檢，滿了就擋（不建檔，避免產生未入座的半成品賓客）
  const targetTable = newGuestForm.tableId !== NO_TABLE
    ? (tables.value ?? []).find(t => t.tableId === newGuestForm.tableId)
    : null
  if (newGuestForm.tableId !== NO_TABLE && !targetTable) {
    guestError.value = '桌次不存在'
    return
  }
  if (targetTable) {
    // 正常席人頭預檢（兒童椅額外、不佔 capacity）；滿了就擋、不建檔
    const occupied = normalSeatCount(targetTable.tableId)
    if (occupied + newGuestNormalHeads.value > targetTable.capacity) {
      guestError.value = '桌次已滿，無法再安排座位'
      return
    }
  }
  isGuestSubmitting.value = true
  guestError.value = ''
  try {
    const body: CreateGuestBody = {
      name: newGuestForm.name.trim(),
      side: newGuestForm.side,
      diet: newGuestForm.diet,
      category: newGuestForm.category.trim(),
      contact: newGuestForm.contact.trim(),
      partySize: 1 + (Number(newGuestForm.plusOneCount) || 0) + (Number(newGuestForm.childChairCount) || 0),
      childChairCount: Number(newGuestForm.childChairCount) || 0,
    }
    const created = await createGuest(weddingId.value, body)
    // 選了桌次：建檔後當場入座（後端依 partySize / childChairCount 展開多席並再次把關容量）
    if (targetTable) {
      const seatBody: SeatGuestBody = {
        guestId: created.guestId,
        seatNumber: tableSeats(targetTable.tableId).length + 1,
      }
      await seatGuest(weddingId.value, targetTable.tableId, seatBody)
    }
    await refreshGuests()
    if (targetTable)
      await refreshSeating()
    toast.add({
      title: targetTable ? `${body.name} 已新增並入座 ${targetTable.tableName}` : `${body.name} 新增成功`,
      color: 'success',
    })
    isGuestOpen.value = false
  }
  catch (error: any) {
    guestError.value
      = error?.data?.message || error?.statusMessage || '新增失敗，請稍後再試'
  }
  finally {
    isGuestSubmitting.value = false
  }
}

async function submitCake() {
  if (!cakeTarget.value || isCakeSubmitting.value)
    return
  if (!cakeTypeId.value) {
    cakeError.value = '請選擇喜餅款式'
    return
  }
  isCakeSubmitting.value = true
  cakeError.value = ''
  const guestId = cakeTarget.value.guestId
  try {
    const body: DistributeCakeBoxBody = { cakeBoxTypeId: cakeTypeId.value }
    await distributeCakeBox(weddingId.value, guestId, body)
    ensureStatus(guestId).cakeBoxTypeId = cakeTypeId.value
    toast.add({ title: '喜餅發放成功', color: 'success' })
    isCakeOpen.value = false
  }
  catch (error: any) {
    cakeError.value
      = error?.data?.message || error?.statusMessage || '發放失敗，請稍後再試'
  }
  finally {
    isCakeSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="reception-page" class="flex h-full flex-col">
    <!-- 頂列：標題 · 已報到大數字 · 接待共用帳號膠囊（編輯式 top bar） -->
    <div class="mb-8 flex shrink-0 flex-wrap items-end justify-between gap-4 border-b border-line pb-6 dark:border-neutral-800">
      <div>
        <p class="text-overline uppercase text-gold-deep">
          Reception · 接待報到端
        </p>
        <h2 class="mt-2 font-display text-h2 font-semibold leading-none text-ink dark:text-paper">
          接待台
        </h2>
      </div>
      <div class="flex items-center gap-6">
        <div class="text-right">
          <div class="flex items-baseline justify-end gap-2 text-body text-ink-500 dark:text-neutral-400">
            已報到
            <span class="font-display text-h1 font-semibold leading-none text-ink dark:text-paper">{{ checkedInCount }}</span>
            / {{ activeGuests.length }}
          </div>
          <!-- 總報到率 -->
          <div class="mt-2 flex items-center justify-end gap-2">
            <div class="h-1.5 w-32 overflow-hidden rounded-full bg-line dark:bg-neutral-700">
              <!-- 進度以 scaleX 呈現（只動 transform，creative-direction §4） -->
              <div class="h-full w-full origin-left bg-gold transition-transform duration-400 ease-standard" :style="{ transform: `scaleX(${checkInRate / 100})` }" />
            </div>
            <span class="text-caption font-medium text-gold-deep">報到率 {{ checkInRate }}%</span>
          </div>
        </div>
        <span class="whitespace-nowrap rounded-full border border-line px-4 py-2 text-caption uppercase tracking-wider text-gold-deep dark:border-neutral-700">
          {{ identityLabel }}
        </span>
      </div>
    </div>

    <!-- 兩欄：左 報到（窄） / 右 現場桌次圖（寬）
         手機（<lg）：上下堆疊、頁面自然增高跟著 main 捲動（鎖高會把兩欄壓扁互疊）；
         lg 以上：鎖滿版高、兩欄各自內部捲動 -->
    <div class="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row">
      <!-- 左欄：報到搜尋 + 結果（較寬） -->
      <div class="flex flex-col lg:min-h-0 lg:flex-1">
        <!-- 報到搜尋標題 -->
        <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h2 class="font-display text-xl font-semibold leading-none text-ink dark:text-paper">
            請輸入賓客姓名
          </h2>
          <!-- 手機滿寬均分、44px 觸控目標；lg 恢復原尺寸 -->
          <div class="flex w-full items-center gap-2 lg:w-auto">
            <UButton
              v-if="authStore.isAdmin || authStore.isCouple"
              data-testid="vibe-gift-summary-open"
              icon="i-heroicons-banknotes"
              color="neutral"
              variant="outline"
              size="sm"
              class="h-11 flex-1 justify-center lg:h-auto lg:flex-none"
              @click="isGiftSummaryOpen = true"
            >
              禮金彙總
            </UButton>
            <UButton
              data-testid="vibe-batch-toggle"
              :icon="batchMode ? 'i-heroicons-x-mark' : 'i-heroicons-check-circle'"
              :color="batchMode ? 'neutral' : 'primary'"
              :variant="batchMode ? 'outline' : 'solid'"
              size="sm"
              class="h-11 flex-1 justify-center lg:h-auto lg:flex-none"
              @click="toggleBatchMode"
            >
              {{ batchMode ? '取消多選' : '多選報到' }}
            </UButton>
          </div>
        </div>

        <!-- 搜尋框：白底、墨黑粗框、金色游標感 -->
        <div class="mb-4 shrink-0">
          <div class="flex items-center gap-3 rounded border-2 border-ink bg-white px-5 py-3.5 shadow dark:border-paper dark:bg-neutral-900">
            <UIcon name="i-heroicons-magnifying-glass" class="size-6 shrink-0 text-gold" />
            <input
              v-model="searchTerm"
              data-testid="vibe-reception-search"
              placeholder="王怡君"
              aria-label="輸入賓客姓名搜尋"
              class="min-w-0 flex-1 rounded bg-transparent font-display text-2xl font-medium text-ink caret-gold outline-none focus-visible:ring-2 focus-visible:ring-gold/40 placeholder:text-ink-300 dark:text-paper"
            >
          </div>
          <div class="mt-2 flex items-center justify-between pl-1">
            <p class="text-caption text-ink-500 dark:text-neutral-400">
              {{ filteredGuests.length }} 位相符
            </p>
            <USwitch
              v-model="showOnlyUnchecked"
              data-testid="vibe-reception-unchecked-toggle"
              label="只看未報到"
              size="sm"
            />
          </div>
        </div>

        <!-- 批量報到工具列（多選模式限定） -->
        <div
          v-if="batchMode"
          data-testid="vibe-batch-toolbar"
          class="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <span class="text-body text-ink-500 dark:text-neutral-400">
            已選 <span class="font-semibold text-ink dark:text-paper">{{ selectedIds.size }}</span> 組
          </span>
          <!-- 手機滿寬均分、44px 觸控目標；lg 恢復原尺寸 -->
          <div class="flex w-full items-center gap-2 lg:w-auto">
            <UButton
              data-testid="vibe-batch-select-all"
              color="neutral"
              variant="outline"
              size="sm"
              class="h-11 flex-1 justify-center lg:h-auto lg:flex-none"
              :disabled="selectableGuests.length === 0"
              @click="selectAllFiltered"
            >
              全選未報到
            </UButton>
            <UButton
              data-testid="vibe-batch-checkin"
              color="primary"
              size="sm"
              class="h-11 flex-1 justify-center lg:h-auto lg:flex-none"
              :disabled="selectedIds.size === 0"
              :loading="isBatchChecking"
              @click="batchCheckIn"
            >
              報到 {{ selectedIds.size }} 組
            </UButton>
          </div>
        </div>

        <!-- 報到完成大字桌次回饋：賓客一問「我坐哪桌」即答；下一次報到覆蓋 -->
        <div
          v-if="lastCheckIns.length"
          data-testid="vibe-checkin-table-banner"
          class="mb-4 shrink-0 rounded-lg border border-gold bg-gold-light/20 px-5 py-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-overline uppercase text-gold-deep">
                報到完成 · 桌次
              </p>
              <p
                v-for="entry in lastCheckIns"
                :key="entry.name"
                class="mt-1 truncate font-display text-2xl font-semibold text-ink dark:text-paper"
              >
                {{ entry.name }}<span class="mx-2 font-normal text-ink-300">—</span>{{ entry.table }}
              </p>
            </div>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="關閉桌次提示"
              @click="lastCheckIns = []"
            />
          </div>
        </div>

        <!-- 結果卡片列表；lg 鎖高內捲、flex-1 讓空狀態撐滿 -->
        <div data-testid="reception-list" class="flex flex-col space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-auto">
          <div
            v-for="guest in filteredGuests"
            :key="guest.guestId"
            role="article"
            :aria-label="guest.name"
            :data-testid="`reception-row-${guest.guestId}`"
            class="rounded-lg border border-line bg-white p-5 transition-colors dark:border-neutral-800 dark:bg-neutral-900"
            :class="status[guest.guestId]?.checkedIn && 'opacity-70'"
          >
            <!-- 身分 + 報到狀態 -->
            <div class="flex items-start gap-4">
              <!-- 多選模式：未報到者顯示勾選框 -->
              <UCheckbox
                v-if="batchMode && !status[guest.guestId]?.checkedIn"
                :model-value="selectedIds.has(guest.guestId)"
                :data-testid="`vibe-batch-tick-${guest.guestId}`"
                :aria-label="`選取 ${guest.name}`"
                size="lg"
                class="mt-3"
                @update:model-value="toggleSelect(guest.guestId)"
              />
              <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-light/40 font-display text-xl font-semibold text-gold-deep">
                {{ guest.name.charAt(0) }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-3">
                  <p class="font-display text-2xl font-medium leading-tight text-ink dark:text-paper">
                    {{ guest.name }}
                  </p>
                  <StatusBadge v-if="status[guest.guestId]?.checkedIn" color="success" size="md">
                    已報到
                  </StatusBadge>
                  <StatusBadge v-else color="warning" size="md">
                    未報到
                  </StatusBadge>
                </div>
                <p class="mt-0.5 text-body text-ink-500 dark:text-neutral-400">
                  {{ guestDetail(guest) }}
                </p>
              </div>
            </div>

            <!-- 報到資訊：桌次 · 總人數 · 兒童椅（報到時一眼看到） -->
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-body text-ink dark:border-neutral-700 dark:text-paper">
                <UIcon name="i-heroicons-table-cells" class="size-4 text-gold-deep" />
                {{ guestTable(guest) }}
              </span>
              <span class="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-body text-ink dark:border-neutral-700 dark:text-paper">
                <UIcon name="i-heroicons-user-group" class="size-4 text-gold-deep" />
                共 {{ guest.partySize }} 人
              </span>
              <span
                v-if="guest.childChairCount > 0"
                class="inline-flex items-center gap-1.5 rounded border border-gold bg-gold-light/20 px-3 py-1.5 text-body font-medium text-gold-deep"
              >
                <UIcon name="i-heroicons-sparkles" class="size-4" />
                兒童椅 ×{{ guest.childChairCount }}
              </span>
            </div>

            <!-- 禮金 · 喜餅 · 報到（報到鈕置於最後、無箭頭） -->
            <div class="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line pt-4 dark:border-neutral-800">
              <!-- 禮金 -->
              <div class="flex items-center gap-3">
                <span class="text-caption uppercase tracking-wider text-ink-300">禮金</span>
                <span
                  v-if="status[guest.guestId]?.giftAmount != null"
                  class="font-display text-xl font-semibold text-ink dark:text-paper"
                >
                  NT$ {{ status[guest.guestId]!.giftAmount!.toLocaleString('en-US') }}
                </span>
                <span v-else class="text-body text-ink-300">未登記</span>
                <UButton
                  :data-testid="`reception-gift-${guest.guestId}`"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  class="h-11 lg:h-auto"
                  @click="openGift(guest)"
                >
                  {{ status[guest.guestId]?.giftAmount != null ? '更正' : '登記禮金' }}
                </UButton>
              </div>

              <!-- 喜餅：已發放打勾；未發放且有指定款 → 打勾即發放，另留「發放喜餅」可改款 -->
              <div class="flex items-center gap-3">
                <span class="text-caption uppercase tracking-wider text-ink-300">喜餅</span>
                <span
                  v-if="status[guest.guestId]?.cakeBoxTypeId"
                  class="inline-flex items-center gap-1.5 text-body font-medium text-success-600"
                >
                  <UIcon name="i-heroicons-check-circle-20-solid" class="size-5" />
                  已發放（{{ cakeTypeName(status[guest.guestId]!.cakeBoxTypeId) }}）
                </span>
                <template v-else>
                  <UCheckbox
                    v-if="assignedCake(guest.guestId)"
                    :model-value="false"
                    :data-testid="`reception-cake-tick-${guest.guestId}`"
                    :disabled="quickDistributingId === guest.guestId"
                    :label="`${assignedCake(guest.guestId)!.typeName}（指定）`"
                    @update:model-value="quickDistribute(guest)"
                  />
                  <span v-else class="text-body text-ink-300">未指定款式</span>
                  <UButton
                    :data-testid="`reception-cake-${guest.guestId}`"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    class="h-11 lg:h-auto"
                    @click="openCake(guest)"
                  >
                    發放喜餅
                  </UButton>
                </template>
              </div>

              <!-- 報到（最後位置、無箭頭） -->
              <UButton
                v-if="!status[guest.guestId]?.checkedIn"
                :data-testid="`reception-checkin-${guest.guestId}`"
                color="primary"
                size="lg"
                class="h-11 lg:h-auto"
                :loading="checkingInId === guest.guestId"
                :aria-label="`報到 ${guest.name}`"
                @click="checkIn(guest)"
              >
                報到
              </UButton>
            </div>
          </div>

          <EmptyState
            v-if="filteredGuests.length === 0"
            bordered
            class="flex-1"
            :title="searchTerm ? '找不到相符的賓客' : '目前沒有賓客'"
            :description="searchTerm ? '請確認姓名或新增臨時賓客' : '請先於賓客管理新增賓客'"
          />
        </div>
      </div>

      <!-- 右欄：現場桌次圖（接待人員比照；可現場新增賓客 / 新增桌次） -->
      <div class="flex flex-col lg:min-h-0 lg:w-[520px] lg:shrink-0">
        <div class="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="font-display text-xl font-semibold leading-none text-ink dark:text-paper">
              現場桌次圖
            </h2>
            <!-- 顏色圖例：依報到狀態區分席位 -->
            <div class="mt-2 flex items-center gap-3 text-caption text-ink-500 dark:text-neutral-400">
              <span class="flex items-center gap-1.5">
                <span class="size-2.5 rounded-full border border-success-600 bg-success-500" />已報到
              </span>
              <span class="flex items-center gap-1.5">
                <span class="size-2.5 rounded-full border border-dashed border-ink-200 bg-paper" />未報到
              </span>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              data-testid="vibe-reception-add-guest"
              icon="i-heroicons-user-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="openGuest()"
            >
              新增賓客
            </UButton>
            <UButton
              data-testid="vibe-reception-add-table"
              icon="i-heroicons-plus"
              color="neutral"
              variant="solid"
              size="sm"
              @click="openTable"
            >
              新增桌次
            </UButton>
          </div>
        </div>

        <!-- 桌次平面（米色點陣畫布 + 桌卡） -->
        <div class="min-h-0 flex-1 overflow-auto">
          <div v-if="(tables ?? []).length === 0" data-testid="vibe-reception-table-empty" class="flex h-full flex-col">
            <EmptyState
              bordered
              class="flex-1"
              title="目前沒有桌次"
              description="點擊「新增桌次」開始安排現場座位"
            />
          </div>
          <div
            v-else
            data-testid="vibe-reception-floor-plan"
            class="rounded-lg border border-line bg-paper p-5 shadow-sm"
            :style="{ backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1px)', backgroundSize: '24px 24px' }"
          >
            <div class="mb-5 flex justify-center">
              <span class="rounded border border-dashed border-line px-7 py-1.5 text-overline text-ink-300">
                舞台
              </span>
            </div>
            <!-- 圓桌平面：主桌單獨面對舞台、其餘雙數並列；只標示是哪一桌 + 入座數 -->
            <div class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div
                v-for="table in orderedTables"
                :key="table.tableId"
                :data-testid="`vibe-reception-table-${table.tableId}`"
                class="flex flex-col items-center"
                :class="isMainTable(table) && 'sm:col-span-2'"
              >
                <!-- 圓桌：標示桌名 + 入座數（主桌金色強調、較大、面對舞台） -->
                <div
                  class="flex aspect-square w-full flex-col items-center justify-center rounded-full border-2 px-3 text-center transition-colors"
                  :class="isMainTable(table)
                    ? 'max-w-[200px] border-gold bg-gold-light/25 dark:border-gold dark:bg-gold-deep/20'
                    : 'max-w-[150px] border-line bg-paper dark:border-neutral-700 dark:bg-neutral-800'"
                >
                  <span
                    class="line-clamp-2 font-display font-medium leading-tight text-ink dark:text-paper"
                    :class="isMainTable(table) ? 'text-xl' : 'text-base'"
                  >{{ table.tableName }}</span>
                  <span class="mt-1 text-caption text-ink-500 dark:text-neutral-400">
                    {{ normalSeatCount(table.tableId) }} / {{ table.capacity }} 位
                  </span>
                  <span v-if="childChairCount(table.tableId) > 0" class="text-caption text-gold-deep">
                    +兒童椅 {{ childChairCount(table.tableId) }}
                  </span>
                </div>
                <p v-if="isMainTable(table)" class="mt-1 text-caption text-gold-deep">
                  面對舞台
                </p>
                <!-- 展開列出個別席位（名字1 / 名字-兒童1），方便接待現場核對 -->
                <div
                  v-if="tableSeats(table.tableId).length > 0"
                  :data-testid="`vibe-reception-seats-${table.tableId}`"
                  class="mt-2 flex flex-wrap justify-center gap-1"
                >
                  <span
                    v-for="seat in tableSeats(table.tableId)"
                    :key="`${seat.guestId}-${seat.seatNumber}`"
                    class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-caption transition-colors"
                    :class="seatChipClass(seat)"
                    :title="isSeatCheckedIn(seat) ? '已報到' : '未報到'"
                  >
                    <UIcon
                      v-if="seat.seatType === 'childChair'"
                      name="i-heroicons-sparkles"
                      class="size-3 shrink-0"
                    />
                    {{ seatLabel(seat) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 禮金登記 / 更正 Modal -->
    <UModal v-model:open="isGiftOpen">
      <template #content>
        <div data-testid="reception-gift-modal" class="bg-paper p-8 dark:bg-neutral-900">
          <p class="text-overline uppercase text-gold-deep">
            禮金登記 · {{ giftTarget?.name }}
          </p>
          <h3 class="mb-6 mt-1 text-body-l font-semibold text-ink dark:text-paper">
            {{ giftIsUpdate ? '更正禮金' : '登記禮金' }}
          </h3>

          <UAlert
            v-if="giftError"
            data-testid="reception-gift-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="giftError"
            class="mb-4"
          />

          <div class="space-y-6">
            <!-- 大金額輸入（白底墨黑粗框、金色游標、Cormorant 數字） -->
            <UFormField label="金額" name="amount">
              <div class="flex items-center gap-3 rounded border-2 border-ink bg-white px-6 py-4 dark:border-paper dark:bg-neutral-800">
                <span class="font-display text-2xl text-ink-500 dark:text-neutral-400">NT$</span>
                <input
                  v-model.number="giftAmount"
                  data-testid="reception-gift-amount"
                  type="number"
                  min="0"
                  placeholder="0"
                  aria-label="禮金金額"
                  class="min-w-0 flex-1 rounded bg-transparent font-display text-h1 font-semibold text-ink caret-gold outline-none focus-visible:ring-2 focus-visible:ring-gold/40 placeholder:text-ink-300 dark:text-paper"
                >
              </div>
            </UFormField>

            <!-- 快捷金額（墨黑 / 白卡，選中墨黑） -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <UButton
                v-for="amount in quickAmounts"
                :key="amount"
                :data-testid="`vibe-reception-quick-amount-${amount}`"
                block
                size="xl"
                :color="giftAmount === amount ? 'neutral' : 'neutral'"
                :variant="giftAmount === amount ? 'solid' : 'outline'"
                @click="giftAmount = amount"
              >
                {{ amount.toLocaleString('en-US') }}
              </UButton>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                :disabled="isGiftSubmitting"
                @click="isGiftOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="reception-gift-submit"
                color="primary"
                size="lg"
                :loading="isGiftSubmitting"
                @click="submitGift"
              >
                {{ giftIsUpdate ? '確定更正' : '確定登記' }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 喜餅發放 Modal -->
    <UModal v-model:open="isCakeOpen">
      <template #content>
        <div data-testid="reception-cake-modal" class="bg-paper p-8 dark:bg-neutral-900">
          <p class="text-overline uppercase text-gold-deep">
            喜餅款式 · {{ cakeTarget?.name }}
          </p>
          <h3 class="mb-6 mt-1 text-body-l font-semibold text-ink dark:text-paper">
            發放喜餅
          </h3>

          <UAlert
            v-if="cakeError"
            data-testid="reception-cake-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="cakeError"
            class="mb-4"
          />

          <div class="space-y-6">
            <!-- 喜餅選擇卡（選中：金框 + bg-paper；長輩友善大點擊區） -->
            <UFormField label="喜餅款式" name="cakeBoxTypeId">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  v-for="opt in cakeTypeOptions"
                  :key="opt.value"
                  type="button"
                  :aria-pressed="cakeTypeId === opt.value"
                  class="flex items-center justify-between rounded-lg border-2 p-5 text-left transition-colors"
                  :class="cakeTypeId === opt.value
                    ? 'border-gold bg-gold-light/30'
                    : 'border-line bg-white hover:border-gold/60 dark:border-neutral-800 dark:bg-neutral-800'"
                  @click="cakeTypeId = opt.value"
                >
                  <span class="text-body-l font-medium text-ink dark:text-paper">{{ opt.label }}</span>
                  <span
                    class="flex size-7 shrink-0 items-center justify-center rounded"
                    :class="cakeTypeId === opt.value ? 'bg-gold text-white' : 'border border-line'"
                  >
                    <UIcon v-if="cakeTypeId === opt.value" name="i-heroicons-check" class="size-5" />
                  </span>
                </button>
              </div>

              <!-- 同步同一 cakeTypeId 的可達控制（保留既有 testid 合約） -->
              <USelectMenu
                v-model="cakeTypeId"
                data-testid="distribute-cake-select"
                :items="cakeTypeOptions"
                value-key="value"
                placeholder="選擇喜餅款式"
                class="mt-3 w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                :disabled="isCakeSubmitting"
                @click="isCakeOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="reception-cake-submit"
                color="primary"
                size="lg"
                :loading="isCakeSubmitting"
                @click="submitCake"
              >
                確定發放
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 現場新增桌次 Modal -->
    <UModal v-model:open="isTableOpen">
      <template #content>
        <div data-testid="vibe-reception-table-modal" class="bg-paper p-8 dark:bg-neutral-900">
          <p class="text-overline uppercase text-gold-deep">
            Floor Plan
          </p>
          <h3 class="mb-6 mt-1 text-body-l font-semibold text-ink dark:text-paper">
            新增桌次
          </h3>

          <UAlert
            v-if="tableError"
            data-testid="vibe-reception-table-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="tableError"
            class="mb-4"
          />

          <div class="space-y-5">
            <UFormField label="桌次名稱" name="tableName">
              <UInput
                v-model="tableForm.tableName"
                data-testid="vibe-reception-table-name"
                placeholder="如：主桌、男方家屬桌"
                class="w-full"
              />
            </UFormField>
            <UFormField label="座位數" name="capacity">
              <UInput
                v-model.number="tableForm.capacity"
                data-testid="vibe-reception-table-capacity"
                type="number"
                min="1"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                :disabled="isTableSubmitting"
                @click="isTableOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="vibe-reception-table-submit"
                color="primary"
                size="lg"
                :loading="isTableSubmitting"
                @click="submitTable"
              >
                新增
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 現場新增賓客 Modal -->
    <UModal v-model:open="isGuestOpen">
      <template #content>
        <div data-testid="vibe-reception-guest-modal" class="bg-paper p-8 dark:bg-neutral-900">
          <p class="text-overline uppercase text-gold-deep">
            Guest
          </p>
          <h3 class="mb-6 mt-1 text-body-l font-semibold text-ink dark:text-paper">
            新增賓客
          </h3>

          <UAlert
            v-if="guestError"
            data-testid="vibe-reception-guest-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="guestError"
            class="mb-4"
          />

          <div class="space-y-5">
            <UFormField label="賓客姓名" name="newGuestName">
              <UInput
                v-model="newGuestForm.name"
                data-testid="vibe-reception-new-guest-name"
                placeholder="請輸入賓客姓名"
                class="w-full"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="男方 / 女方" name="newGuestSide">
                <USelectMenu
                  v-model="newGuestForm.side"
                  data-testid="vibe-reception-new-guest-side"
                  :items="sideOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="葷 / 素" name="newGuestDiet">
                <USelectMenu
                  v-model="newGuestForm.diet"
                  data-testid="vibe-reception-new-guest-diet"
                  :items="dietOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField label="分類（選填）" name="newGuestCategory">
              <UInput
                v-model="newGuestForm.category"
                data-testid="vibe-reception-new-guest-category"
                placeholder="如：親友、同事"
                class="w-full"
              />
            </UFormField>
            <UFormField label="聯絡方式（選填）" name="newGuestContact">
              <UInput
                v-model="newGuestForm.contact"
                data-testid="vibe-reception-new-guest-contact"
                placeholder="電話 / Email"
                class="w-full"
              />
            </UFormField>
            <!-- 人數：同行（佔正常席）＋ 兒童椅嬰兒（額外加位、不佔正常席） -->
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="同行人數" name="newGuestPlusOne">
                <UInput
                  v-model.number="newGuestForm.plusOneCount"
                  data-testid="vibe-reception-new-guest-plus-one"
                  type="number"
                  min="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="兒童椅嬰兒數" name="newGuestChildChair">
                <UInput
                  v-model.number="newGuestForm.childChairCount"
                  data-testid="vibe-reception-new-guest-child-chair"
                  type="number"
                  min="0"
                  class="w-full"
                />
              </UFormField>
            </div>
            <p class="text-caption text-ink-300">
              會自己坐、吃大人菜的小孩請算進「同行人數」；用兒童椅的小嬰兒填「兒童椅嬰兒數」。
            </p>

            <!-- 桌次（選填）：選定後當場入座；提示隨同行 / 兒童椅即時更新 -->
            <UFormField label="桌次（選填，可當場入座）" name="newGuestTable">
              <USelectMenu
                v-model="newGuestForm.tableId"
                data-testid="vibe-reception-new-guest-table"
                :items="tableOptions"
                value-key="value"
                placeholder="先不排桌"
                class="w-full"
              />
              <p
                v-if="seatHint"
                data-testid="vibe-reception-new-guest-seat-hint"
                class="mt-1.5 text-caption text-ink-500 dark:text-neutral-400"
              >
                {{ seatHint }}
              </p>
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                :disabled="isGuestSubmitting"
                @click="isGuestOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="vibe-reception-guest-submit"
                color="primary"
                size="lg"
                :loading="isGuestSubmitting"
                @click="submitGuest"
              >
                新增
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 禮金彙總（宴後對帳）：總額 / 筆數 / 依側小計 / 逐筆清單 -->
    <USlideover v-model:open="isGiftSummaryOpen">
      <template #content>
        <div data-testid="vibe-gift-summary" class="flex h-full flex-col bg-paper p-6 dark:bg-neutral-900">
          <div class="flex shrink-0 items-start justify-between gap-3">
            <div>
              <p class="text-overline uppercase text-gold-deep">
                Gift Money Summary
              </p>
              <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
                禮金彙總
              </h3>
            </div>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="關閉禮金彙總"
              @click="isGiftSummaryOpen = false"
            />
          </div>

          <!-- 總額大數字（數值展示，非標題） -->
          <div class="mt-5 shrink-0 rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p class="text-caption uppercase tracking-wider text-ink-300">
              禮金總額
            </p>
            <p data-testid="vibe-gift-summary-total" class="mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
              NT$ {{ giftTotal.toLocaleString('en-US') }}
            </p>
            <p data-testid="vibe-gift-summary-count" class="mt-1 text-body text-ink-500 dark:text-neutral-400">
              共 {{ giftRecords.length }} 筆
            </p>
          </div>

          <!-- 男方 / 女方小計 -->
          <div class="mt-3 grid shrink-0 grid-cols-2 gap-3">
            <div data-testid="vibe-gift-summary-groom" class="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p class="text-caption uppercase tracking-wider text-ink-300">
                男方
              </p>
              <p class="mt-1 font-display text-xl font-semibold text-ink dark:text-paper">
                NT$ {{ giftBySide.groom.amount.toLocaleString('en-US') }}
              </p>
              <p class="text-caption text-ink-500 dark:text-neutral-400">
                {{ giftBySide.groom.count }} 筆
              </p>
            </div>
            <div data-testid="vibe-gift-summary-bride" class="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p class="text-caption uppercase tracking-wider text-ink-300">
                女方
              </p>
              <p class="mt-1 font-display text-xl font-semibold text-ink dark:text-paper">
                NT$ {{ giftBySide.bride.amount.toLocaleString('en-US') }}
              </p>
              <p class="text-caption text-ink-500 dark:text-neutral-400">
                {{ giftBySide.bride.count }} 筆
              </p>
            </div>
          </div>

          <!-- 逐筆清單 -->
          <p class="text-overline mb-2 mt-5 shrink-0 uppercase text-gold-deep">
            逐筆明細
          </p>
          <div data-testid="vibe-gift-summary-list" class="flex min-h-0 flex-1 flex-col overflow-auto">
            <div
              v-for="record in giftRecords"
              :key="record.guest.guestId"
              role="article"
              :aria-label="record.guest.name"
              class="flex items-center justify-between gap-3 border-b border-line/60 py-2.5 last:border-0 dark:border-neutral-800"
            >
              <div class="min-w-0 flex-1">
                <span class="text-body font-medium text-ink dark:text-paper">{{ record.guest.name }}</span>
                <span class="ml-2 text-caption text-ink-500 dark:text-neutral-400">{{ sideLabel(record.guest.side) }}</span>
              </div>
              <span class="shrink-0 font-display text-body-l font-semibold text-ink dark:text-paper">
                NT$ {{ record.amount.toLocaleString('en-US') }}
              </span>
            </div>

            <EmptyState
              v-if="giftRecords.length === 0"
              bordered
              class="flex-1"
              title="尚未登記任何禮金"
              description="於賓客卡片點「登記禮金」後會列於此"
            />
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
