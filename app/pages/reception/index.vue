<!-- app/pages/reception/index.vue -->
<script setup lang="ts">
import type { CakeBoxTypeListItem } from '~/types/api/cakebox'
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
import type { CakeBoxThumbItem } from '~/utils/cakeBoxDisplay'
import {
  checkInGuest,
  createGuest,
  createTable,
  distributeCakeBox,
  getReceptionStatus,
  listCakeBoxAssignments,
  listCakeBoxExclusions,
  listCakeBoxTypes,
  listGuests,
  listTables,
  listWeddingSeats,
  recordGiftMoney,
  seatGuest,
  updateGiftMoney,
} from '~/api'
import { cakeBoxDisplayName, cakeBoxThumbItems } from '~/utils/cakeBoxDisplay'

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
// 後台標記不發放的賓客（新人本人、男方親屬等）：接待端顯示「不發放」並收起所有發放操作
const cakeExclusionAsync = listCakeBoxExclusions(weddingId, { default: () => [] })
// 報到／禮金／喜餅狀態（GuestListItem 不含這些欄位，見下方 status 區）
const statusAsync = getReceptionStatus(weddingId, { default: () => [] })
// 現場桌次圖：桌次 + 全婚禮座位（一次抓，取代逐桌 N 請求）
const tablesAsync = listTables(weddingId, { default: () => [] })
const seatsAsync = listWeddingSeats(weddingId, { default: () => [] })
await Promise.all([guestsAsync, cakeTypesAsync, cakeAssignAsync, cakeExclusionAsync, statusAsync, tablesAsync, seatsAsync])
const { data: guests, refresh: refreshGuests } = guestsAsync
// 款式清單原本只取 data，後台改款／改組合後接待端會停在開頁當下的舊資料直到整頁重載（issue #138）
const { data: cakeBoxTypes, refresh: refreshCakeTypes } = cakeTypesAsync
const { data: cakeAssignments, refresh: refreshCakeAssignments } = cakeAssignAsync
const { data: cakeExclusions, refresh: refreshCakeExclusions } = cakeExclusionAsync
const { data: receptionStatus, refresh: refreshStatus } = statusAsync
const { data: tables, refresh: refreshTables } = tablesAsync
const { data: allSeats, refresh: refreshSeats } = seatsAsync

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

const cakeTypeById = computed(() =>
  new Map((cakeBoxTypes.value ?? []).map(t => [t.cakeBoxTypeId, t])),
)

// 款式顯示：組合款以內含單款為主行（接待員實際要拿的盒子），組合自訂名降為副標（issue #140）
function cakeTypeView(type: CakeBoxTypeListItem) {
  return {
    ...cakeBoxDisplayName(type, cakeTypeById.value),
    thumbItems: cakeBoxThumbItems(type, cakeTypeById.value),
  }
}

// 選款清單只列出後台開放「接待台可選」的款式（issue #138）；
// 已指派／已發放的隱藏款仍由 cakeTypeById 查得到名稱，不會顯示成空白
// label 供 USelectMenu 過濾與選取後顯示；組合自訂名走內建 description 副標，縮圖走 item-leading
const cakeTypeOptions = computed(() =>
  (cakeBoxTypes.value ?? [])
    .filter(t => t.visibleToReception)
    .map((t) => {
      const { primary, secondary, thumbItems } = cakeTypeView(t)
      return { label: primary, description: secondary, thumbItems, value: t.cakeBoxTypeId }
    }),
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

// guestId → 指定款顯示（款名 + 副標 + 縮圖）；
// 款式已被刪除或關閉可選時，退回指派帶出的款名，不讓卡片變空白
const assignedCakeViewByGuest = computed(() => {
  const map = new Map<string, { primary: string, secondary: string, thumbItems: CakeBoxThumbItem[] }>()
  for (const [guestId, assigned] of assignedCakeByGuest.value) {
    const type = cakeTypeById.value.get(assigned.typeId)
    map.set(guestId, type
      ? cakeTypeView(type)
      : { primary: assigned.typeName, secondary: '', thumbItems: [] })
  }
  return map
})

function assignedCakeView(guestId: string) {
  return assignedCakeViewByGuest.value.get(guestId) ?? null
}

// 已發放顯示文字；款式被刪除時只說「已發放」，不渲染成「已發放（）」
function distributedLabel(typeId: string | null): string {
  const type = typeId ? cakeTypeById.value.get(typeId) : null
  return type ? `已發放（${cakeTypeView(type).primary}）` : '已發放'
}

// 不發放賓客：接待端據此收起打勾與發放按鈕（後端另有 409 守門）
const excludedGuestIds = computed(() =>
  new Set((cakeExclusions.value ?? []).map(e => e.guestId)),
)

function isCakeExcluded(guestId: string): boolean {
  return excludedGuestIds.value.has(guestId)
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
const quickAmounts = [1200, 1600, 2000, 2200, 2600, 3600, 6000, 6600]

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

// 顯示順序：三項（報到／禮金／喜餅）皆完成者視為已處理，穩定沉到清單最下方；
// 其餘（含剛報到、尚未登禮金／喜餅者）維持原順序留在上方，避免處理到一半就跳走干擾
// 不發放的賓客喜餅永遠不會有發放紀錄，視為該項已處理，否則他們會永遠卡在待處理區
function isFullyServed(g: GuestListItem): boolean {
  const s = status[g.guestId]
  return !!s?.checkedIn && s.giftAmount != null && (s.cakeBoxTypeId != null || isCakeExcluded(g.guestId))
}
const displayGuests = computed(() => {
  const pending: GuestListItem[] = []
  const served: GuestListItem[] = []
  for (const g of filteredGuests.value)
    (isFullyServed(g) ? served : pending).push(g)
  return [...pending, ...served]
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
// 報到成功後的桌次回饋（issue #25）：賓客報到完第一句話是「我坐哪桌」，單筆與批量共用。
// 低調細長一行、約 5 秒後自動淡出（不擾民）；下一次報到覆蓋、可手動關閉
const lastCheckIns = ref<{ name: string, table: string }[]>([])
let checkInBannerTimer: ReturnType<typeof setTimeout> | null = null
const CHECKIN_BANNER_MS = 3000
function showCheckInFeedback(entries: { name: string, table: string }[]) {
  lastCheckIns.value = entries
  if (checkInBannerTimer)
    clearTimeout(checkInBannerTimer)
  checkInBannerTimer = setTimeout(() => {
    lastCheckIns.value = []
    checkInBannerTimer = null
  }, CHECKIN_BANNER_MS)
}
function dismissCheckInFeedback() {
  lastCheckIns.value = []
  if (checkInBannerTimer) {
    clearTimeout(checkInBannerTimer)
    checkInBannerTimer = null
  }
}

const checkingInId = ref<string | null>(null)
async function checkIn(guest: GuestListItem) {
  if (checkingInId.value)
    return
  checkingInId.value = guest.guestId
  try {
    await checkInGuest(weddingId.value, guest.guestId)
    ensureStatus(guest.guestId).checkedIn = true
    showCheckInFeedback([{ name: guest.name, table: guestTable(guest) }])
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
      showCheckInFeedback(succeeded.map(g => ({ name: g.name, table: guestTable(g) })))
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
// 每桌收禮金額（宴後對帳；依 guestTable 分組——實際入座優先、退回預排桌次），金額高到低
const giftByTable = computed(() => {
  const map = new Map<string, { amount: number, count: number }>()
  for (const r of giftRecords.value) {
    const table = guestTable(r.guest)
    const cur = map.get(table) ?? { amount: 0, count: 0 }
    cur.amount += r.amount
    cur.count++
    map.set(table, cur)
  }
  return Array.from(map.entries(), ([table, v]) => ({ table, ...v }))
    .sort((a, b) => b.amount - a.amount)
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
// 刻意不做推播——維持 5 秒短輪詢是定案，決策依據見 docs/architecture.md §3.5「接待台即時性」（issue #77）。
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
      refreshCakeTypes(),
      refreshCakeAssignments(),
      refreshCakeExclusions(),
      refreshSeating(),
    ]).catch(() => {})
  }, POLL_MS)
})
onUnmounted(() => {
  if (pollTimer)
    clearInterval(pollTimer)
  if (checkInBannerTimer)
    clearTimeout(checkInBannerTimer)
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
// 現場桌次圖以「賓客的桌次指派」為準（實際入座優先、退回預排桌次 tableName），
// 報到即時反映，也涵蓋尚未用排位工具拖曳入座、僅預排桌次的賓客
const guestsByTableName = computed<Record<string, GuestListItem[]>>(() => {
  const map: Record<string, GuestListItem[]> = {}
  for (const g of activeGuests.value)
    (map[guestTable(g)] ??= []).push(g)
  return map
})
interface TableInfo {
  members: GuestListItem[]
  normalHeads: number // 正常席人頭（不含兒童椅）
  childChairs: number // 兒童椅嬰兒
  heads: number // 總人頭（含兒童）
  checkedHeads: number // 已報到人頭
  rate: number // 報到率（依人頭）
}
const tableInfoMap = computed<Record<string, TableInfo>>(() => {
  const map: Record<string, TableInfo> = {}
  for (const t of tables.value ?? []) {
    const members = guestsByTableName.value[t.tableName] ?? []
    let normalHeads = 0
    let childChairs = 0
    let heads = 0
    let checkedHeads = 0
    for (const g of members) {
      const total = Math.max(1, g.partySize)
      heads += total
      childChairs += g.childChairCount
      normalHeads += Math.max(1, total - g.childChairCount)
      if (status[g.guestId]?.checkedIn)
        checkedHeads += total
    }
    map[t.tableName] = { members, normalHeads, childChairs, heads, checkedHeads, rate: heads > 0 ? checkedHeads / heads : 0 }
  }
  return map
})
const EMPTY_TABLE_INFO: TableInfo = { members: [], normalHeads: 0, childChairs: 0, heads: 0, checkedHeads: 0, rate: 0 }
// 某桌的賓客與報到統計（依桌名對應）
function tableInfo(table: TableListItem): TableInfo {
  return tableInfoMap.value[table.tableName] ?? EMPTY_TABLE_INFO
}
// 賓客是否已報到（供桌次圖名字上色）
function isGuestCheckedIn(guestId: string): boolean {
  return status[guestId]?.checkedIn ?? false
}

// 桌次圖檢視切換：桌次圖（平面配置，預設）/ 桌次清單（逐桌展開賓客小圓圈，快速核對整桌）
const floorView = ref('map')
const floorViewTabs = [
  { label: '桌次圖', icon: 'i-heroicons-squares-2x2', slot: 'map', value: 'map' },
  { label: '桌次清單', icon: 'i-heroicons-list-bullet', slot: 'list', value: 'list' },
]
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
            <!-- OFF 態軌道底色調深（正常 switch 樣式，不加框/ring），灰態不再糊在背景；ON 態填金 -->
            <USwitch
              v-model="showOnlyUnchecked"
              data-testid="vibe-reception-unchecked-toggle"
              label="只看未報到"
              size="sm"
              :ui="{ base: 'data-[state=unchecked]:bg-ink-300 dark:data-[state=unchecked]:bg-neutral-600' }"
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

        <!-- 報到完成桌次回饋：低調細長一行，約 5 秒後自動淡出（reduced-motion 友善）、可手動關閉 -->
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-500 motion-reduce:transition-none"
          leave-to-class="opacity-0"
        >
          <div
            v-if="lastCheckIns.length"
            data-testid="vibe-checkin-table-banner"
            class="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-gold/40 bg-gold-light/15 px-3 py-2"
          >
            <UIcon name="i-heroicons-check-circle" class="size-4 shrink-0 text-gold-deep" />
            <p class="min-w-0 flex-1 text-body text-ink dark:text-paper">
              <span class="text-caption text-gold-deep">報到完成</span>
              <span v-for="(entry, i) in lastCheckIns" :key="entry.name">
                <span v-if="i > 0" class="text-ink-300">、</span>
                <span class="ml-1 font-medium">{{ entry.name }}</span>
                <span class="mx-1 text-ink-300">·</span>{{ entry.table }}
              </span>
            </p>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="關閉桌次提示"
              @click="dismissCheckInFeedback"
            />
          </div>
        </Transition>

        <!-- 結果卡片列表；lg 鎖高內捲、flex-1 讓空狀態撐滿 -->
        <div data-testid="reception-list" class="flex flex-col space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-auto">
          <div
            v-for="guest in displayGuests"
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

              <!-- 喜餅：已發放顯示款式；不發放者無操作；有指定款打勾即發放；
                   「發放喜餅」按鈕只留給沒有後台指派的現場臨時來賓（issue #138） -->
              <div class="flex items-center gap-3">
                <span class="text-caption uppercase tracking-wider text-ink-300">喜餅</span>
                <span
                  v-if="status[guest.guestId]?.cakeBoxTypeId"
                  class="inline-flex items-center gap-1.5 text-body font-medium text-success-600"
                >
                  <UIcon name="i-heroicons-check-circle-20-solid" class="size-5" />
                  {{ distributedLabel(status[guest.guestId]!.cakeBoxTypeId) }}
                </span>
                <span
                  v-else-if="isCakeExcluded(guest.guestId)"
                  :data-testid="`vibe-reception-cake-nobox-${guest.guestId}`"
                  class="text-body text-ink-300"
                >
                  不發放
                </span>
                <!-- 組合款以內含單款為主行、組合自訂名走 description 副標（issue #140） -->
                <UCheckbox
                  v-else-if="assignedCakeView(guest.guestId)"
                  :model-value="false"
                  :data-testid="`reception-cake-tick-${guest.guestId}`"
                  :disabled="quickDistributingId === guest.guestId"
                  :ui="{ root: 'items-center' }"
                  @update:model-value="quickDistribute(guest)"
                >
                  <!-- 縮圖與副標都放進 label：整塊等高後，勾選框才會對齊縮圖中心
                       （用 description prop 會讓副標落在 label 外，勾選框被推到頂部） -->
                  <template #label>
                    <span class="flex items-center gap-2">
                      <CakeBoxThumb :items="assignedCakeView(guest.guestId)!.thumbItems" size="sm" />
                      <span class="min-w-0">
                        <span class="block">{{ assignedCakeView(guest.guestId)!.primary }}（指定）</span>
                        <span
                          v-if="assignedCakeView(guest.guestId)!.secondary"
                          class="block text-caption text-ink-300"
                        >
                          {{ assignedCakeView(guest.guestId)!.secondary }}
                        </span>
                      </span>
                    </span>
                  </template>
                </UCheckbox>
                <template v-else>
                  <span class="text-body text-ink-300">未指定款式</span>
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
        <!-- 不在此層捲動：tab bar 固定在頂端，改由 UTabs 內容區（:ui.content）內部捲動 -->
        <div class="flex min-h-0 flex-1 flex-col">
          <div v-if="(tables ?? []).length === 0" data-testid="vibe-reception-table-empty" class="flex h-full flex-col">
            <EmptyState
              bordered
              class="flex-1"
              title="目前沒有桌次"
              description="點擊「新增桌次」開始安排現場座位"
            />
          </div>
          <UTabs
            v-else
            v-model="floorView"
            :items="floorViewTabs"
            color="primary"
            variant="link"
            size="sm"
            class="flex min-h-0 flex-1 flex-col"
            :ui="{ content: 'min-h-0 flex-1 overflow-auto' }"
          >
            <!-- 檢視一：桌次圖（現況，預設）——每桌圓圈 + 報到率環 -->
            <template #map>
              <div
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
                    <!-- 圓桌：桌名 + 指派人數 + 報到率環（主桌金色強調、較大、面對舞台） -->
                    <div
                      class="relative flex aspect-square w-full flex-col items-center justify-center rounded-full border-2 px-3 text-center transition-colors"
                      :class="isMainTable(table)
                        ? 'max-w-[200px] border-gold bg-gold-light/25 dark:border-gold dark:bg-gold-deep/20'
                        : 'max-w-[150px] border-line bg-paper dark:border-neutral-700 dark:bg-neutral-800'"
                    >
                      <!-- 報到率環：柔和 success 弧線由正上方順時針，弧長 = 已報到 / 指派人頭；尚無人報到時不顯示 -->
                      <svg
                        v-if="tableInfo(table).checkedHeads > 0"
                        class="pointer-events-none absolute inset-0 size-full -rotate-90 text-success-400"
                        viewBox="0 0 100 100"
                        aria-hidden="true"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="48"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          :stroke-dasharray="`${(tableInfo(table).rate * 301.6).toFixed(1)} 301.6`"
                        />
                      </svg>
                      <span
                        class="line-clamp-2 font-display font-medium leading-tight text-ink dark:text-paper"
                        :class="isMainTable(table) ? 'text-xl' : 'text-base'"
                      >{{ table.tableName }}</span>
                      <span class="mt-1 text-caption text-ink-500 dark:text-neutral-400">
                        {{ tableInfo(table).normalHeads }} / {{ table.capacity }} 位
                      </span>
                      <span v-if="tableInfo(table).childChairs > 0" class="text-caption text-gold-deep">
                        +兒童椅 {{ tableInfo(table).childChairs }}
                      </span>
                      <span
                        v-if="tableInfo(table).heads > 0"
                        class="mt-0.5 text-caption font-medium text-success-600 dark:text-success-400"
                      >
                        報到 {{ tableInfo(table).checkedHeads }}/{{ tableInfo(table).heads }}
                      </span>
                    </div>
                    <p v-if="isMainTable(table)" class="mt-1 text-caption text-gold-deep">
                      面對舞台
                    </p>
                    <!-- 該桌賓客姓名（依桌次指派）：已報到淡綠、未報到虛線淡，方便現場核對 -->
                    <div
                      v-if="tableInfo(table).members.length > 0"
                      :data-testid="`vibe-reception-seats-${table.tableId}`"
                      class="mt-2 flex flex-wrap justify-center gap-1"
                    >
                      <span
                        v-for="guest in tableInfo(table).members"
                        :key="guest.guestId"
                        class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-caption transition-colors"
                        :class="isGuestCheckedIn(guest.guestId)
                          ? 'border-success-300 bg-success-50 text-success-700 dark:border-success-700 dark:bg-success-900/30 dark:text-success-300'
                          : 'border-dashed border-ink-200 bg-paper text-ink-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500'"
                        :title="isGuestCheckedIn(guest.guestId) ? '已報到' : '未報到'"
                      >
                        <UIcon
                          v-if="guest.childChairCount > 0"
                          name="i-heroicons-sparkles"
                          class="size-3 shrink-0 text-gold-deep"
                        />
                        {{ guest.name }}<template v-if="guest.partySize > 1">·{{ guest.partySize }}</template>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 檢視二：桌次清單——每桌垂直展開、賓客小圓圈依報到狀態（已報到淡綠、未報到淡） -->
            <template #list>
              <div data-testid="vibe-reception-list" class="space-y-4">
                <div
                  v-for="table in orderedTables"
                  :key="table.tableId"
                  :data-testid="`vibe-reception-list-table-${table.tableId}`"
                  class="rounded-lg border border-line bg-paper p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                >
                  <!-- 桌首：桌名 + 指派人數 + 已報到/總數 -->
                  <div class="flex items-center justify-between gap-2 border-b border-line pb-1.5 dark:border-neutral-800">
                    <div class="flex items-baseline gap-2">
                      <span
                        class="font-display text-base font-medium"
                        :class="isMainTable(table) ? 'text-gold-deep' : 'text-ink dark:text-paper'"
                      >{{ table.tableName }}</span>
                      <span class="text-caption text-ink-500 dark:text-neutral-400">
                        {{ tableInfo(table).normalHeads }}/{{ table.capacity }} 位
                      </span>
                    </div>
                    <span
                      v-if="tableInfo(table).heads > 0"
                      class="text-caption font-medium text-success-600 dark:text-success-400"
                    >
                      已報到 {{ tableInfo(table).checkedHeads }}/{{ tableInfo(table).heads }}
                    </span>
                  </div>
                  <!-- 賓客小圓圈：色碼依報到狀態（已報到淡綠、未報到虛線淡），姓名在下方 -->
                  <div
                    v-if="tableInfo(table).members.length > 0"
                    class="mt-3 flex flex-wrap gap-x-3 gap-y-2"
                  >
                    <div
                      v-for="guest in tableInfo(table).members"
                      :key="guest.guestId"
                      class="flex w-14 flex-col items-center gap-1"
                      :title="isGuestCheckedIn(guest.guestId) ? '已報到' : '未報到'"
                    >
                      <div
                        class="flex size-10 items-center justify-center rounded-full border transition-colors"
                        :class="isGuestCheckedIn(guest.guestId)
                          ? 'border-success-300 bg-success-50 text-success-700 dark:border-success-700 dark:bg-success-900/30 dark:text-success-300'
                          : 'border-dashed border-ink-200 bg-paper text-ink-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500'"
                      >
                        <UIcon v-if="isGuestCheckedIn(guest.guestId)" name="i-heroicons-check" class="size-5" />
                        <UIcon v-else-if="guest.childChairCount > 0" name="i-heroicons-sparkles" class="size-4" />
                        <span v-else class="text-caption">{{ guest.partySize }}</span>
                      </div>
                      <span class="line-clamp-1 max-w-full text-caption text-ink-600 dark:text-neutral-300">
                        {{ guest.name }}
                      </span>
                    </div>
                  </div>
                  <p v-else class="mt-3 text-caption text-ink-400 dark:text-neutral-500">
                    尚無賓客
                  </p>
                </div>
              </div>
            </template>
          </UTabs>
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
              <!-- 單欄長條：組合款名（內含兩款）在兩欄寬度下會擠到勾選框，且現場單欄更好按 -->
              <div class="flex flex-col gap-3">
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
                  <span class="flex min-w-0 flex-1 items-center gap-3">
                    <CakeBoxThumb :items="opt.thumbItems" />
                    <span class="min-w-0">
                      <!-- break-keep：組合款只在「＋」兩側的空白斷行，不會斷在「輕巧禮／盒」中間 -->
                      <span class="block break-keep text-body-l font-medium text-ink dark:text-paper">{{ opt.label }}</span>
                      <span
                        v-if="opt.description"
                        class="block truncate text-caption text-ink-500 dark:text-neutral-400"
                      >
                        {{ opt.description }}
                      </span>
                    </span>
                  </span>
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
              >
                <template #item-leading="{ item }">
                  <CakeBoxThumb :items="item.thumbItems" size="sm" />
                </template>
              </USelectMenu>
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

          <!-- 每桌收禮（依金額高到低；獨立捲動避免擠壓逐筆清單） -->
          <template v-if="giftByTable.length > 0">
            <p class="text-overline mb-2 mt-5 shrink-0 uppercase text-gold-deep">
              每桌收禮
            </p>
            <div data-testid="vibe-gift-summary-tables" class="max-h-40 shrink-0 space-y-1.5 overflow-auto">
              <div
                v-for="row in giftByTable"
                :key="row.table"
                class="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span class="inline-flex min-w-0 items-center gap-1.5 text-body text-ink dark:text-paper">
                  <UIcon name="i-heroicons-table-cells" class="size-4 shrink-0 text-gold-deep" />
                  <span class="truncate">{{ row.table }}</span>
                  <span class="shrink-0 text-caption text-ink-400">{{ row.count }} 筆</span>
                </span>
                <span class="shrink-0 font-display text-body-l font-semibold text-ink dark:text-paper">
                  NT$ {{ row.amount.toLocaleString('en-US') }}
                </span>
              </div>
            </div>
          </template>

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
