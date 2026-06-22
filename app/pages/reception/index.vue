<!-- app/pages/reception/index.vue -->
<script setup lang="ts">
import type { GuestListItem } from '~/types/api/guests'
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
  createTable,
  distributeCakeBox,
  getReceptionStatus,
  getTableSeats,
  listCakeBoxAssignments,
  listCakeBoxTypes,
  listGuests,
  listTables,
  recordGiftMoney,
  seatGuest,
  updateGiftMoney,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
// SSR：loadSeats 於 setup 多個 await 後才迴圈呼叫 getTableSeats（內部用 useHttp→useRuntimeConfig），
// 需於 await 前取得 nuxtApp，迴圈內以 runWithContext 保留 Nuxt context
const nuxtApp = useNuxtApp()
// weddingId 由查詢字串帶入（沿用既有模式），預設 wedding-001
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

// 賓客清單
const { data: guests } = await listGuests(weddingId, { default: () => [] })

// 喜餅款式（供發放選擇）
const { data: cakeBoxTypes } = await listCakeBoxTypes(weddingId, { default: () => [] })

// 後台逐位指定的喜餅款式（接待端據此顯示「指定款式」並可打勾發放）
const { data: cakeAssignments } = await listCakeBoxAssignments(weddingId, { default: () => [] })

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
const filteredGuests = computed(() => {
  const t = searchTerm.value.trim()
  if (!t)
    return activeGuests.value
  return activeGuests.value.filter(g => g.name.includes(t))
})

// 禮金快速金額（接待確認用）
const quickAmounts = [1200, 3600, 6000, 12000]

// 接待狀態：報到 / 禮金 / 喜餅
// GuestListItem 不含接待狀態欄位，改由 reception-status 端點取得，操作後就地更新
type ReceptionStatus = Omit<ReceptionStatusItem, 'guestId'>
const status = reactive<Record<string, ReceptionStatus>>({})

const { data: receptionStatus } = await getReceptionStatus(weddingId, { default: () => [] })

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

// 已報到人數 + 總報到率（供頂部計數）
const checkedInCount = computed(
  () => activeGuests.value.filter(g => status[g.guestId]?.checkedIn).length,
)
const checkInRate = computed(() => {
  const total = activeGuests.value.length
  return total ? Math.round((checkedInCount.value / total) * 100) : 0
})

// === 報到 ===
const checkingInId = ref<string | null>(null)
async function checkIn(guest: GuestListItem) {
  if (checkingInId.value)
    return
  checkingInId.value = guest.guestId
  try {
    await checkInGuest(weddingId.value, guest.guestId)
    ensureStatus(guest.guestId).checkedIn = true
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
// 現場桌次圖：載入桌次與座位，供接待人員比照，並可現場新增桌次 / 安排座位
// ===========================================================================
const { data: tables, refresh: refreshTables } = await listTables(weddingId, { default: () => [] })

// 每張桌的座位（key = tableId）
const seatsByTable = ref<Record<string, SeatListItem[]>>({})

async function loadSeats() {
  const list = tables.value ?? []
  // 15 桌平行抓取座位（runWithContext 保留 SSR Nuxt context）
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

async function refreshSeating() {
  await refreshTables()
  await loadSeats()
}

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

// === 現場安排座位 ===
const tableOptions = computed(() =>
  (tables.value ?? []).map(t => ({ label: t.tableName, value: t.tableId })),
)
const seatGuestOptions = computed(() =>
  activeGuests.value.map(g => ({ label: g.name, value: g.guestId })),
)

const isSeatOpen = ref(false)
const isSeating = ref(false)
const seatError = ref('')
const seatForm = reactive<{ guestId: string, tableId: string, seatNumber: number }>({
  guestId: '',
  tableId: '',
  seatNumber: 1,
})

function openSeat() {
  seatError.value = ''
  seatForm.guestId = ''
  seatForm.tableId = ''
  seatForm.seatNumber = 1
  isSeatOpen.value = true
}

// 在 Modal 內改選桌次時，自動建議下一個座位號
function onSeatTableChange(tableId: string) {
  seatForm.seatNumber = tableSeats(tableId).length + 1
}

async function submitSeat() {
  if (isSeating.value)
    return
  if (!seatForm.guestId || !seatForm.tableId) {
    seatError.value = '請選擇賓客與桌次'
    return
  }
  isSeating.value = true
  seatError.value = ''
  try {
    const body: SeatGuestBody = {
      guestId: seatForm.guestId,
      seatNumber: Number(seatForm.seatNumber) || 1,
    }
    await seatGuest(weddingId.value, seatForm.tableId, body)
    toast.add({ title: '已安排座位', color: 'success' })
    isSeatOpen.value = false
    await refreshSeating()
  }
  catch (error: any) {
    seatError.value
      = error?.data?.message || error?.statusMessage || '安排失敗，請稍後再試'
  }
  finally {
    isSeating.value = false
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
        <h1 class="mt-2 font-display text-h1 font-semibold leading-none text-ink dark:text-paper">
          接待台
        </h1>
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
              <div class="h-full rounded-full bg-gold transition-all duration-500" :style="{ width: `${checkInRate}%` }" />
            </div>
            <span class="text-caption font-medium text-gold-deep">報到率 {{ checkInRate }}%</span>
          </div>
        </div>
        <span class="rounded-full border border-line px-4 py-2 text-caption uppercase tracking-wider text-gold-deep dark:border-neutral-700">
          接待 · 共用帳號
        </span>
      </div>
    </div>

    <!-- 兩欄：左 報到（窄） / 右 現場桌次圖（寬） -->
    <div class="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      <!-- 左欄：報到搜尋 + 結果（較寬） -->
      <div class="flex min-h-0 flex-1 flex-col">
        <!-- 報到搜尋標題 -->
        <div class="mb-3 shrink-0">
          <h2 class="font-display text-xl font-semibold leading-none text-ink dark:text-paper">
            請輸入賓客姓名
          </h2>
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
              class="min-w-0 flex-1 bg-transparent font-display text-2xl font-medium text-ink caret-gold outline-none placeholder:text-ink-300 dark:text-paper"
            >
          </div>
          <p class="mt-2 pl-1 text-caption text-ink-500 dark:text-neutral-400">
            {{ filteredGuests.length }} 位相符
          </p>
        </div>

        <!-- 結果卡片列表 -->
        <div data-testid="reception-list" class="min-h-0 flex-1 space-y-3 overflow-auto">
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
              <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-light/40 font-display text-xl font-semibold text-gold-deep">
                {{ guest.name.charAt(0) }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-3">
                  <p class="font-display text-2xl font-medium leading-tight text-ink dark:text-paper">
                    {{ guest.name }}
                  </p>
                  <UBadge v-if="status[guest.guestId]?.checkedIn" color="success" variant="soft" size="md">
                    已報到
                  </UBadge>
                  <UBadge v-else color="warning" variant="outline" size="md">
                    未報到
                  </UBadge>
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
                共 {{ guest.partySize ?? 1 }} 人
              </span>
              <span
                v-if="guest.needChildSeat"
                class="inline-flex items-center gap-1.5 rounded border border-gold bg-gold-light/20 px-3 py-1.5 text-body font-medium text-gold-deep"
              >
                <UIcon name="i-heroicons-sparkles" class="size-4" />
                需兒童椅
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
            :title="searchTerm ? '找不到相符的賓客' : '目前沒有賓客'"
            :description="searchTerm ? '請確認姓名或新增臨時賓客' : '請先於賓客管理新增賓客'"
          />
        </div>
      </div>

      <!-- 右欄：現場桌次圖（接待人員比照；可現場新增桌次 / 安排座位） -->
      <div class="flex min-h-0 flex-col lg:w-[520px] lg:shrink-0">
        <div class="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="font-display text-xl font-semibold leading-none text-ink dark:text-paper">
              現場桌次圖
            </h2>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              data-testid="vibe-reception-seat"
              icon="i-heroicons-user-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="openSeat()"
            >
              安排座位
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
          <div v-if="(tables ?? []).length === 0" data-testid="vibe-reception-table-empty">
            <EmptyState
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
                    {{ tableSeats(table.tableId).length }} / {{ table.capacity }} 位
                  </span>
                </div>
                <p v-if="isMainTable(table)" class="mt-1 text-caption text-gold-deep">
                  面對舞台
                </p>
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
          <h3 class="mb-6 mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
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
                  class="min-w-0 flex-1 bg-transparent font-display text-5xl font-semibold text-ink caret-gold outline-none placeholder:text-ink-300 dark:text-paper"
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
          <h3 class="mb-6 mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
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
                  <span class="text-h2 font-medium text-ink dark:text-paper">{{ opt.label }}</span>
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
          <h3 class="mb-6 mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
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

    <!-- 現場安排座位 Modal -->
    <UModal v-model:open="isSeatOpen">
      <template #content>
        <div data-testid="vibe-reception-seat-modal" class="bg-paper p-8 dark:bg-neutral-900">
          <p class="text-overline uppercase text-gold-deep">
            Floor Plan
          </p>
          <h3 class="mb-6 mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
            安排座位
          </h3>

          <UAlert
            v-if="seatError"
            data-testid="vibe-reception-seat-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="seatError"
            class="mb-4"
          />

          <div class="space-y-5">
            <UFormField label="賓客" name="guestId">
              <USelectMenu
                v-model="seatForm.guestId"
                data-testid="vibe-reception-seat-guest"
                :items="seatGuestOptions"
                value-key="value"
                placeholder="選擇賓客"
                class="w-full"
              />
            </UFormField>
            <UFormField label="桌次" name="tableId">
              <USelectMenu
                v-model="seatForm.tableId"
                data-testid="vibe-reception-seat-table"
                :items="tableOptions"
                value-key="value"
                placeholder="選擇桌次"
                class="w-full"
                @update:model-value="onSeatTableChange"
              />
            </UFormField>
            <UFormField label="座位號" name="seatNumber">
              <UInput
                v-model.number="seatForm.seatNumber"
                data-testid="vibe-reception-seat-number"
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
                :disabled="isSeating"
                @click="isSeatOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="vibe-reception-seat-submit"
                color="primary"
                size="lg"
                :loading="isSeating"
                @click="submitSeat"
              >
                安排
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
