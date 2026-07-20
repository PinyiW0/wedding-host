<!-- app/pages/weddings/[weddingId]/cake-box.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CakeBoxExtraOrderListItem,
  CakeBoxTypeListItem,
  ConfigureCakeBoxAssignmentBody,
  CreateCakeBoxTypeBody,
  UpdateCakeBoxTypeBody,
} from '~/types/api/cakebox'

import { z } from 'zod'
import {
  cancelCakeBoxDistribution,
  configureCakeBoxAssignment,
  createCakeBoxExtraOrder,
  createCakeBoxType,
  deleteCakeBoxExtraOrder,
  deleteCakeBoxType,
  excludeGuestCakeBox,
  getReceptionStatus,
  listCakeBoxAssignments,
  listCakeBoxExclusions,
  listCakeBoxExtraOrders,
  listCakeBoxTypes,
  listGuestCategories,
  listGuests,
  removeCakeBoxExclusion,
  updateCakeBoxExtraOrder,
  updateCakeBoxType,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))
const { uploadImage } = useImageUpload()

// 喜餅款式清單
const { data: cakeBoxTypes, refresh } = await listCakeBoxTypes(
  weddingId,
  { default: () => [] },
)

// 賓客清單（供指派規則選擇對象賓客）
const { data: guests } = await listGuests(
  weddingId,
  { default: () => [] },
)

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

// 婚禮層級分類清單（與賓客頁同一來源；「依分類帶入」的分類選項）
const { data: weddingCategories } = await listGuestCategories(
  weddingId,
  { default: () => [] },
)

// 已設定指派規則清單（由 GET 讀回，重整仍能還原顯示）
const { data: assignments, refresh: refreshAssignments } = await listCakeBoxAssignments(
  weddingId,
  { default: () => [] },
)

// 不發放清單（新人本人等不需喜餅者）
const { data: exclusions, refresh: refreshExclusions } = await listCakeBoxExclusions(
  weddingId,
  { default: () => [] },
)

// 額外配發清單（公關／公司公餅，非賓客）
const { data: extraOrders, refresh: refreshExtra } = await listCakeBoxExtraOrders(
  weddingId,
  { default: () => [] },
)

// 已發放狀態（後台檢視 + 取消發放）：來源同接待台 reception-status，cakeBoxTypeId != null = 已領喜餅
const { data: receptionStatus, refresh: refreshReceptionStatus } = await getReceptionStatus(
  weddingId,
  { default: () => [] },
)
const distributedByGuest = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const s of receptionStatus.value ?? []) {
    if (s.cakeBoxTypeId)
      map[s.guestId] = s.cakeBoxTypeId
  }
  return map
})
// 已發放款式名（供表格徽章；款式若已刪除退回「已發放」）
function distributedTypeName(guestId: string): string | null {
  const typeId = distributedByGuest.value[guestId]
  if (!typeId)
    return null
  return (cakeBoxTypes.value ?? []).find(t => t.cakeBoxTypeId === typeId)?.name ?? '已發放'
}

// 取消喜餅發放（後台由新人／管理者操作；接待員無此權限，由後端 RBAC 擋 403）
const cancelTarget = ref<{ guestId: string, name: string } | null>(null)
const isCancelOpen = ref(false)
const isCancelling = ref(false)
function openCancelDistribution(guestId: string, name: string) {
  cancelTarget.value = { guestId, name }
  isCancelOpen.value = true
}
async function confirmCancelDistribution() {
  const target = cancelTarget.value
  if (!target || isCancelling.value)
    return
  isCancelling.value = true
  try {
    await cancelCakeBoxDistribution(weddingId.value, target.guestId)
    await refreshReceptionStatus()
    toast.add({ title: `已取消「${target.name}」的喜餅發放`, color: 'success' })
    isCancelOpen.value = false
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '取消發放失敗', description: message, color: 'error' })
  }
  finally {
    isCancelling.value = false
  }
}

// 款式 CRUD 後同步重抓「款式」與「指派」兩支 GET：
// 領取清單表格的已指派列讀的是 assignments 的 cakeBoxTypeName（後端依當前款式即時帶出），
// 只重抓款式會讓表格停在舊名稱／已移除款式，故兩者一起 reload。
async function reloadCakeBoxData() {
  await Promise.all([refresh(), refreshAssignments(), refreshExtra()])
}

// === 新增 / 編輯喜餅款式表單 ===
const schema = z.object({
  name: z.string().trim().min(1, '請輸入款式名稱'),
  description: z.string().trim(),
  isDefault: z.boolean(),
})

type Schema = z.output<typeof schema>

const isFormOpen = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const editingId = ref<string | null>(null)
const state = reactive<Schema>({
  name: '',
  description: '',
  isDefault: false,
})
// 縮圖（base64 data URL）與單價（元）獨立於 zod schema 管理，避免數字/檔案的驗證摩擦
const imageUrl = ref('')
// 隱藏的檔案 input，由 outline 上傳鈕觸發（取代原生 file:bg-ink 黑鈕）
const imageInputRef = ref<HTMLInputElement>()
// 注意：UInput type="number" 會在 runtime 把值轉成數字回填（型別仍標 string），
// 故 onSubmit 解析時改用 Number() 並避免呼叫字串專屬方法（如 .trim）
const priceText = ref('')

function resetState() {
  state.name = ''
  state.description = ''
  state.isDefault = false
  imageUrl.value = ''
  priceText.value = ''
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  resetState()
  isFormOpen.value = true
}

function openEdit(type: CakeBoxTypeListItem) {
  editingId.value = type.cakeBoxTypeId
  formError.value = ''
  state.name = type.name
  state.description = type.description ?? ''
  state.isDefault = type.isDefault
  imageUrl.value = type.imageUrl ?? ''
  priceText.value = type.price != null ? String(type.price) : ''
  isFormOpen.value = true
}

// 選檔縮圖：讀檔 → canvas 縮到最長邊 400px → 轉 jpeg data URL（避免大檔塞爆記憶體 mock）
function onPickImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 400 / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h)
        imageUrl.value = canvas.toDataURL('image/jpeg', 0.8)
      }
      else {
        imageUrl.value = String(reader.result)
      }
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(file)
  input.value = '' // 允許重選同一檔
}

// 卡片快捷：直接把某款設為預設（後端會自動取消其他款預設）
async function setAsDefault(type: CakeBoxTypeListItem) {
  if (type.isDefault)
    return
  try {
    await updateCakeBoxType(weddingId.value, type.cakeBoxTypeId, { isDefault: true })
    toast.add({ title: `已將「${type.name}」設為預設款`, color: 'success' })
    await reloadCakeBoxData()
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '設定預設款失敗', description: message, color: 'error' })
  }
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  formError.value = ''
  try {
    const data = event.data
    // priceText 可能是字串（初始/編輯帶入）或數字（UInput type=number 回填）
    const rawPrice = priceText.value
    const priceNum = rawPrice === '' || rawPrice == null ? Number.NaN : Number(rawPrice)
    const price = Number.isNaN(priceNum) ? undefined : priceNum
    // R2 啟用時縮圖先直傳（已是 URL 則原樣返回）；本機模式維持 dataURL
    const uploadedImageUrl = imageUrl.value
      ? await uploadImage(imageUrl.value, weddingId.value, 'cake-box')
      : ''
    if (editingId.value) {
      const body: UpdateCakeBoxTypeBody = {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault, // 可事後切換預設款
        imageUrl: uploadedImageUrl,
        price,
      }
      await updateCakeBoxType(weddingId.value, editingId.value, body)
      toast.add({ title: '喜餅款式已更新', color: 'success' })
    }
    else {
      const body: CreateCakeBoxTypeBody = {
        name: data.name,
        description: data.description || undefined,
        isDefault: data.isDefault,
        imageUrl: uploadedImageUrl || undefined,
        price,
      }
      await createCakeBoxType(weddingId.value, body)
      toast.add({ title: '喜餅款式新增成功', color: 'success' })
    }
    isFormOpen.value = false
    await reloadCakeBoxData()
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複造成測試 strict mode violation）
    formError.value
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}

// === 移除喜餅款式 ===
const isRemoveOpen = ref(false)
const isRemoving = ref(false)
const removeTarget = ref<CakeBoxTypeListItem | null>(null)

function openRemove(type: CakeBoxTypeListItem) {
  removeTarget.value = type
  isRemoveOpen.value = true
}

async function confirmRemove() {
  if (!removeTarget.value || isRemoving.value)
    return
  isRemoving.value = true
  try {
    await deleteCakeBoxType(weddingId.value, removeTarget.value.cakeBoxTypeId)
    toast.add({ title: '喜餅款式已移除', color: 'success' })
    isRemoveOpen.value = false
    await reloadCakeBoxData()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '移除失敗，請稍後再試'
    toast.add({ title: '移除失敗', description: message, color: 'error' })
  }
  finally {
    isRemoving.value = false
  }
}

// === 設定指派規則 ===
const typeOptions = computed(() =>
  (cakeBoxTypes.value ?? []).map(t => ({ label: t.name, value: t.cakeBoxTypeId })),
)
const guestOptions = computed(() =>
  activeGuests.value.map(g => ({ label: g.name, value: g.guestId })),
)

const isAssignOpen = ref(false)
const isAssigning = ref(false)
const assignError = ref('')
const assignState = reactive<{
  cakeBoxTypeId: string
  guestId: string
  assignmentRule: string
}>({
  cakeBoxTypeId: '',
  guestId: '',
  assignmentRule: '',
})

function openAssign() {
  assignError.value = ''
  assignState.cakeBoxTypeId = ''
  assignState.guestId = ''
  assignState.assignmentRule = ''
  isAssignOpen.value = true
}

async function confirmAssign() {
  if (isAssigning.value)
    return
  if (!assignState.cakeBoxTypeId) {
    assignError.value = '請選擇喜餅款式'
    return
  }
  if (!assignState.guestId) {
    assignError.value = '請選擇對象賓客'
    return
  }
  isAssigning.value = true
  assignError.value = ''
  try {
    const body: ConfigureCakeBoxAssignmentBody = {
      guestId: assignState.guestId,
      assignmentRule: assignState.assignmentRule,
    }
    await configureCakeBoxAssignment(weddingId.value, assignState.cakeBoxTypeId, body)
    toast.add({ title: '指派規則設定成功', color: 'success' })
    isAssignOpen.value = false
    await refreshAssignments()
  }
  catch (error: any) {
    assignError.value
      = error?.data?.message || error?.statusMessage || '設定失敗，請稍後再試'
  }
  finally {
    isAssigning.value = false
  }
}

// === 依分類自動帶入（規則：每個分類 → 一種款式；沒對到給預設款）===
const defaultType = computed(() => (cakeBoxTypes.value ?? []).find(t => t.isDefault) ?? null)

function guestCategory(category: string | null | undefined): string {
  return category || '未分類'
}

// 各分類（婚禮層級清單 ∪ 在用分類兜底；保留「未分類」fallback）
const distinctCategories = computed(() => {
  const set = new Set<string>((weddingCategories.value ?? []).filter(Boolean))
  for (const g of activeGuests.value)
    set.add(guestCategory(g.category))
  return [...set]
})
function categoryCount(cat: string): number {
  return activeGuests.value.filter(g => guestCategory(g.category) === cat).length
}

// 各款式已指派人數（供訂購數量估算）
const assignedCountByType = computed(() => {
  const m: Record<string, number> = {}
  for (const a of assignments.value ?? [])
    m[a.cakeBoxTypeId] = (m[a.cakeBoxTypeId] ?? 0) + 1
  return m
})

function typeNameOf(typeId: string): string {
  return (cakeBoxTypes.value ?? []).find(t => t.cakeBoxTypeId === typeId)?.name ?? ''
}

// 由現有指派回推「該分類目前用哪一款」，供重開 modal 時預填（達到規則持久化效果）
function existingTypeByCategory(): Record<string, string> {
  const m: Record<string, string> = {}
  for (const a of assignments.value ?? []) {
    const g = (guests.value ?? []).find(x => x.guestId === a.guestId)
    if (!g)
      continue
    const cat = guestCategory(g.category)
    if (!m[cat])
      m[cat] = a.cakeBoxTypeId
  }
  return m
}

const isAutoOpen = ref(false)
const isApplying = ref(false)
const autoError = ref('')
const categoryRule = reactive<Record<string, string>>({})

function openAutoAssign() {
  autoError.value = ''
  const byCat = existingTypeByCategory()
  for (const cat of distinctCategories.value)
    categoryRule[cat] = byCat[cat] ?? defaultType.value?.cakeBoxTypeId ?? ''
  isAutoOpen.value = true
}

async function applyByCategory() {
  if (isApplying.value)
    return
  isApplying.value = true
  autoError.value = ''
  try {
    let applied = 0
    let skipped = 0
    for (const g of activeGuests.value) {
      const cat = guestCategory(g.category)
      const typeId = categoryRule[cat] || defaultType.value?.cakeBoxTypeId || ''
      if (!typeId) {
        skipped++
        continue
      }
      await configureCakeBoxAssignment(weddingId.value, typeId, {
        guestId: g.guestId,
        assignmentRule: `${cat}→${typeNameOf(typeId)}`,
      })
      applied++
    }
    await refreshAssignments()
    toast.add({
      title: `已依分類帶入 ${applied} 位`,
      description: skipped > 0 ? `${skipped} 位未對到規則且無預設款` : '可於下方逐位再微調',
      color: 'success',
    })
    isAutoOpen.value = false
  }
  catch (error: any) {
    autoError.value
      = error?.data?.message || error?.statusMessage || '帶入失敗，請稍後再試'
  }
  finally {
    isApplying.value = false
  }
}

// === 喜餅領取清單（含全部賓客；未指派者帶入預設款）===
const assignmentByGuest = computed(() => {
  const m: Record<string, { cakeBoxTypeId: string, cakeBoxTypeName: string, assignmentRule: string }> = {}
  for (const a of assignments.value ?? [])
    m[a.guestId] = { cakeBoxTypeId: a.cakeBoxTypeId, cakeBoxTypeName: a.cakeBoxTypeName || typeNameOf(a.cakeBoxTypeId), assignmentRule: a.assignmentRule }
  return m
})

// 不發放賓客集合（新人本人等不需喜餅者）
const NO_BOX = '__none__'
const excludedGuestIds = computed(() => new Set((exclusions.value ?? []).map(e => e.guestId)))
// 款式下拉選項 + 「不發放」（僅表格列就地改款用；指派 modal 仍只給真實款式）
const styleOptionsWithNone = computed(() => [
  ...typeOptions.value,
  { label: '不發放', value: NO_BOX },
])

// 每位賓客的「實際款式」：已指派者取其款式，否則回退預設款；不發放者另外標記
const pickupList = computed(() =>
  activeGuests.value.map((g) => {
    const a = assignmentByGuest.value[g.guestId]
    const isFallback = !a
    const excluded = excludedGuestIds.value.has(g.guestId)
    return {
      guestId: g.guestId,
      name: g.name,
      category: guestCategory(g.category),
      cakeBoxTypeId: a?.cakeBoxTypeId ?? defaultType.value?.cakeBoxTypeId ?? '',
      cakeBoxTypeName: a?.cakeBoxTypeName ?? defaultType.value?.name ?? '未設定預設款',
      // 個別指派的備註文字（供表格列顯示；vibe 持久化測試靠這段文字定位）
      assignmentRule: a?.assignmentRule ?? '',
      isFallback,
      excluded,
    }
  }),
)

// 表格內就地改款的列型別
interface PickupRow {
  guestId: string
  name: string
  cakeBoxTypeId: string
  assignmentRule: string
  excluded: boolean
}

// 下拉目前值：不發放者顯示「不發放」，否則顯示其實際款式
function rowStyleValue(r: { cakeBoxTypeId: string, excluded: boolean }): string {
  return r.excluded ? NO_BOX : r.cakeBoxTypeId
}

// 表格列下拉變更：選「不發放」→ 標記排除；選真實款式 → 指派（必要時先解除不發放）
function onRowStyleChange(row: PickupRow, value: string) {
  if (value === NO_BOX)
    return setNoBox(row)
  return assignInline(row, value)
}

const inlineSavingId = ref<string | null>(null)

// 設為不發放（新人本人等）：寫入排除清單
async function setNoBox(row: PickupRow) {
  if (row.excluded)
    return
  inlineSavingId.value = row.guestId
  try {
    await excludeGuestCakeBox(weddingId.value, { guestId: row.guestId })
    await refreshExclusions()
    toast.add({ title: `已將「${row.name}」設為不發放`, color: 'success' })
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '設定失敗', description: message, color: 'error' })
  }
  finally {
    inlineSavingId.value = null
  }
}

// 就地改款：直接寫入指派（保留既有規則備註）；若原為不發放先解除
async function assignInline(row: PickupRow, typeId: string) {
  if (!typeId || typeId === NO_BOX || (!row.excluded && typeId === row.cakeBoxTypeId))
    return
  inlineSavingId.value = row.guestId
  try {
    if (row.excluded)
      await removeCakeBoxExclusion(weddingId.value, row.guestId)
    await configureCakeBoxAssignment(weddingId.value, typeId, {
      guestId: row.guestId,
      assignmentRule: row.assignmentRule ?? '',
    })
    await Promise.all([refreshAssignments(), refreshExclusions()])
    toast.add({ title: `已將「${row.name}」改為「${typeNameOf(typeId)}」`, color: 'success' })
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '改款失敗', description: message, color: 'error' })
  }
  finally {
    inlineSavingId.value = null
  }
}

// 實際要發的賓客（排除不發放者）
const includedPickup = computed(() => pickupList.value.filter(r => !r.excluded))

// 訂購總覽：每款 = 賓客需求數 + 額外配發數 = 合計（供下單）
const orderSummary = computed(() => {
  const map: Record<string, {
    cakeBoxTypeId: string
    cakeBoxTypeName: string
    guestQty: number
    extraQty: number
  }> = {}
  for (const r of includedPickup.value) {
    const key = r.cakeBoxTypeId || '__unset__'
    const g = (map[key] ??= { cakeBoxTypeId: r.cakeBoxTypeId, cakeBoxTypeName: r.cakeBoxTypeName, guestQty: 0, extraQty: 0 })
    g.guestQty++
  }
  for (const o of extraOrders.value ?? []) {
    const g = (map[o.cakeBoxTypeId] ??= { cakeBoxTypeId: o.cakeBoxTypeId, cakeBoxTypeName: o.cakeBoxTypeName, guestQty: 0, extraQty: 0 })
    g.extraQty += o.quantity
  }
  return Object.values(map).map(g => ({ ...g, total: g.guestQty + g.extraQty }))
})
const extraTotal = computed(() => (extraOrders.value ?? []).reduce((s, o) => s + o.quantity, 0))
const orderTotal = computed(() => includedPickup.value.length + extraTotal.value)

// 訂購金額（vibe）：每款小計 = 單價 × 合計盒數；未定價（price null）排除加總並標示
const orderAmountSummary = computed(() => {
  const priceByType = new Map((cakeBoxTypes.value ?? []).map(t => [t.cakeBoxTypeId, t.price]))
  return orderSummary.value.map((g) => {
    const price = priceByType.get(g.cakeBoxTypeId) ?? null
    return { ...g, amount: price == null ? null : price * g.total }
  })
})
const orderGrandTotal = computed(() =>
  orderAmountSummary.value.reduce((s, g) => s + (g.amount ?? 0), 0),
)
const hasUnpricedType = computed(() =>
  orderAmountSummary.value.some(g => g.amount == null && g.total > 0),
)

// 表格篩選：搜尋姓名 + 分類選擇
// 「全部分類」用哨兵值（不可用空字串：Reka Combobox/USelectMenu 禁止空字串 value，否則整個下拉 render 失敗）
const ALL_CATEGORIES = '__all__'
// 額外配發併入賓客分配表（issue #108）：單一視角核對所有發放對象；filter 選此值篩出額外列
const EXTRA_CATEGORY = '__extra__'
const nameQuery = ref('')
const categoryFilter = ref(ALL_CATEGORIES)
const categoryFilterOptions = computed(() => [
  { label: '全部分類', value: ALL_CATEGORIES },
  ...distinctCategories.value.map(c => ({ label: c, value: c })),
  { label: '額外配發', value: EXTRA_CATEGORY },
])

// 額外配發列（收餅人非賓客，不經接待發放；聯絡與備註併成次行說明）
interface ExtraPickupRow {
  kind: 'extra'
  extraOrderId: string
  name: string
  cakeBoxTypeId: string
  cakeBoxTypeName: string
  quantity: number
  detail: string
}
const extraPickupRows = computed<ExtraPickupRow[]>(() =>
  (extraOrders.value ?? []).map(o => ({
    kind: 'extra',
    extraOrderId: o.extraOrderId,
    name: o.recipientName?.trim() ? o.recipientName : '未具名',
    cakeBoxTypeId: o.cakeBoxTypeId,
    cakeBoxTypeName: o.cakeBoxTypeName,
    quantity: o.quantity,
    detail: [o.recipientContact, o.note].filter(Boolean).join(' · '),
  })),
)

const filteredPickup = computed(() => {
  const q = nameQuery.value.trim().toLowerCase()
  const guestRows = pickupList.value
    .filter((r) => {
      const matchName = !q || r.name.toLowerCase().includes(q)
      const matchCat = categoryFilter.value === ALL_CATEGORIES || r.category === categoryFilter.value
      return matchName && matchCat
    })
    .map(r => ({ ...r, kind: 'guest' as const }))
  const extraRows = extraPickupRows.value.filter((r) => {
    const matchName = !q || r.name.toLowerCase().includes(q)
    const matchCat = categoryFilter.value === ALL_CATEGORIES || categoryFilter.value === EXTRA_CATEGORY
    return matchName && matchCat
  })
  // 額外配發列固定附在賓客列之後
  return [...guestRows, ...extraRows]
})

// 領取清單分頁（賓客可能逾百筆；分頁套用在篩選後清單上）
const pickupPageSize = 20
const pickupPage = ref(1)
const pagedPickupList = computed(() => {
  const start = (pickupPage.value - 1) * pickupPageSize
  return filteredPickup.value.slice(start, start + pickupPageSize)
})
// 篩選結果筆數變動時回到第 1 頁，避免停留在已不存在的頁
watch(() => filteredPickup.value.length, () => {
  pickupPage.value = 1
})

// CSV 下載（前端組檔；UTF-8 BOM 讓 Excel 正確顯示中文）
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadPickupCsv() {
  const escape = (s: string) => `"${String(s).replaceAll('"', '""')}"`
  // 第一段：逐位領取明細（排除不發放者）
  const rows: string[][] = [
    ['姓名', '分類', '禮盒款式'],
    ...includedPickup.value.map(r => [
      r.name,
      r.category,
      r.isFallback ? `${r.cakeBoxTypeName}（預設）` : r.cakeBoxTypeName,
    ]),
  ]
  // 第二段：額外配發明細（公關用）
  if ((extraOrders.value ?? []).length > 0) {
    rows.push([], ['額外配發（公關用）'], ['款式', '數量', '姓名', '聯絡', '備註'])
    for (const o of extraOrders.value ?? [])
      rows.push([o.cakeBoxTypeName, String(o.quantity), o.recipientName ?? '', o.recipientContact ?? '', o.note ?? ''])
  }
  // 第三段：訂購數量小計（賓客 + 額外 = 合計）+ 總計
  rows.push([], ['款式', '賓客數量', '額外配發', '合計'])
  for (const g of orderSummary.value)
    rows.push([g.cakeBoxTypeName, String(g.guestQty), String(g.extraQty), String(g.total)])
  rows.push(['共計', '', '', String(orderTotal.value)])

  const csv = rows.map(cols => cols.map(escape).join(',')).join('\r\n')
  const bom = String.fromCharCode(0xFEFF) // UTF-8 BOM，讓 Excel 正確辨識中文
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `喜餅領取清單-${weddingId.value}.csv`)
}

function formatPrice(p: number | null): string {
  return p == null ? '' : `NT$ ${p.toLocaleString('zh-TW')}`
}

// === 額外配發（公關／公司公餅）===
const extraTypeId = ref('')
const extraQtyText = ref('')
const extraName = ref('') // 具名收餅對象姓名（選填）
const extraContact = ref('') // 收餅對象聯絡（選填）
const extraNote = ref('')
const isAddingExtra = ref(false)
const extraError = ref('')

// 編輯中的額外配發（issue #108）：點列選單「編輯」帶回上方表單，送出鈕轉為「更新」
const editingExtraId = ref<string | null>(null)

function resetExtraForm() {
  editingExtraId.value = null
  extraTypeId.value = ''
  extraQtyText.value = ''
  extraName.value = ''
  extraContact.value = ''
  extraNote.value = ''
  extraError.value = ''
}

function startEditExtraOrder(order: CakeBoxExtraOrderListItem) {
  editingExtraId.value = order.extraOrderId
  extraTypeId.value = order.cakeBoxTypeId
  extraQtyText.value = String(order.quantity)
  extraName.value = order.recipientName ?? ''
  extraContact.value = order.recipientContact ?? ''
  extraNote.value = order.note ?? ''
  extraError.value = ''
}

// 編輯中的收餅對象名稱：右欄面板顯示「編輯中：誰」、左表對應列 highlight（可視連結）
const editingExtraLabel = computed(() => {
  if (!editingExtraId.value)
    return ''
  const order = (extraOrders.value ?? []).find(o => o.extraOrderId === editingExtraId.value)
  if (!order)
    return ''
  return order.recipientName?.trim() || `未具名（${order.cakeBoxTypeName}）`
})

// 每列「⋯」選單：編輯／刪除（表格列只有 id，回原始清單取完整資料）
function extraOrderMenuItems(extraOrderId: string) {
  const order = (extraOrders.value ?? []).find(o => o.extraOrderId === extraOrderId)
  if (!order)
    return []
  return [[
    { label: '編輯', icon: 'i-heroicons-pencil', onSelect: () => startEditExtraOrder(order) },
    { label: '刪除', icon: 'i-heroicons-trash', color: 'error' as const, onSelect: () => removeExtraOrder(order.extraOrderId) },
  ]]
}

async function submitExtraOrder() {
  if (isAddingExtra.value)
    return
  const qty = Math.floor(Number(extraQtyText.value))
  if (!extraTypeId.value) {
    extraError.value = '請選擇款式'
    return
  }
  if (!qty || qty < 1) {
    extraError.value = '請輸入數量（至少 1）'
    return
  }
  isAddingExtra.value = true
  extraError.value = ''
  try {
    if (editingExtraId.value) {
      // 編輯：選填欄清空要能存回 null
      await updateCakeBoxExtraOrder(weddingId.value, editingExtraId.value, {
        cakeBoxTypeId: extraTypeId.value,
        quantity: qty,
        recipientName: extraName.value.trim() || null,
        recipientContact: extraContact.value.trim() || null,
        note: extraNote.value.trim() || null,
      })
      toast.add({ title: '已更新額外配發', color: 'success' })
    }
    else {
      await createCakeBoxExtraOrder(weddingId.value, {
        cakeBoxTypeId: extraTypeId.value,
        quantity: qty,
        recipientName: extraName.value.trim() || undefined,
        recipientContact: extraContact.value.trim() || undefined,
        note: extraNote.value.trim() || undefined,
      })
      toast.add({ title: '已新增額外配發', color: 'success' })
    }
    await refreshExtra()
    resetExtraForm()
  }
  catch (error: any) {
    extraError.value = error?.data?.message || error?.statusMessage || (editingExtraId.value ? '更新失敗，請稍後再試' : '新增失敗，請稍後再試')
  }
  finally {
    isAddingExtra.value = false
  }
}

async function removeExtraOrder(extraOrderId: string) {
  try {
    await deleteCakeBoxExtraOrder(weddingId.value, extraOrderId)
    // 正在編輯的那筆被刪除時，一併清掉編輯狀態
    if (editingExtraId.value === extraOrderId)
      resetExtraForm()
    await refreshExtra()
    toast.add({ title: '已移除額外配發', color: 'success' })
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '移除失敗', description: message, color: 'error' })
  }
}
</script>

<template>
  <div data-testid="cake-box-page" class="flex h-full flex-col">
    <PageHeader
      title="喜餅規劃"
      :eyebrow="`Cake Box · ${(cakeBoxTypes ?? []).length} 款`"
      description="管理喜餅款式與賓客指派規則"
    >
      <template #actions>
        <UButton
          data-testid="cake-box-create"
          icon="i-heroicons-plus"
          color="neutral"
          variant="solid"
          @click="openCreate"
        >
          新增喜餅款式
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto pr-4">
      <div class="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <!-- 右欄（設定型內容）：source 在前以滿足 findEntity 順序，視覺用 grid 擺右並常駐 -->
        <aside class="space-y-6 self-start lg:col-start-2 lg:row-start-1 lg:sticky lg:top-0">
          <!-- 喜餅款式 — 面板：扁平款式清單 -->
          <section class="rounded-xl border border-line bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div class="mb-2 flex items-center gap-3">
              <span class="text-overline uppercase text-gold-deep">喜餅款式</span>
              <span class="h-px flex-1 bg-line" />
            </div>
            <p class="mb-4 text-caption text-ink-500 dark:text-neutral-400">
              設一款為<span class="font-medium text-ink dark:text-paper">預設</span>，沒指定的賓客都拿這款；下方「賓客分配」再依分類或個人調整。
            </p>

            <div
              v-if="(cakeBoxTypes ?? []).length > 0"
              data-testid="cake-box-list"
              class="divide-y divide-line/60 lg:max-h-[60vh] lg:overflow-y-auto lg:pr-1 dark:divide-neutral-800"
            >
              <!-- 扁平列：小縮圖 + 主資訊 + 動作；預設款以名稱前金星標記，減少白塊與顏色 -->
              <div
                v-for="type in cakeBoxTypes"
                :key="type.cakeBoxTypeId"
                :data-testid="`cake-box-row-${type.cakeBoxTypeId}`"
                role="article"
                :aria-label="type.name"
                class="flex items-center gap-3 px-2 py-3 transition-colors hover:bg-cream dark:hover:bg-neutral-800/40"
              >
                <!-- 小縮圖（無圖以禮盒 icon 佔位；邊框+對比底色，預設款金框列上也分得出來） -->
                <div class="size-12 shrink-0 overflow-hidden rounded-md border border-line bg-white dark:border-neutral-700 dark:bg-neutral-800">
                  <img
                    v-if="type.imageUrl"
                    :src="type.imageUrl"
                    :alt="type.name"
                    loading="lazy"
                    class="size-full object-cover"
                  >
                  <div v-else class="flex size-full items-center justify-center text-ink-300">
                    <UIcon name="i-heroicons-gift" class="size-5" />
                  </div>
                </div>

                <!-- 主資訊 -->
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <UIcon
                      v-if="type.isDefault"
                      name="i-heroicons-star-solid"
                      class="size-4 shrink-0 text-gold"
                    />
                    <span v-if="type.isDefault" class="sr-only">預設款</span>
                    <h3 class="truncate font-display text-body-l font-medium text-ink dark:text-paper">
                      {{ type.name }}
                    </h3>
                    <span v-if="type.price != null" class="font-medium text-gold-deep">
                      {{ formatPrice(type.price) }}
                    </span>
                  </div>
                  <p class="truncate text-caption text-ink-500 dark:text-neutral-400">
                    <span v-if="type.description">{{ type.description }} · </span>已指派 {{ assignedCountByType[type.cakeBoxTypeId] ?? 0 }} 位
                  </p>
                </div>

                <!-- 動作 -->
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    v-if="!type.isDefault"
                    icon="i-heroicons-check-circle"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="`將 ${type.name} 設為預設款`"
                    @click="setAsDefault(type)"
                  />
                  <UButton
                    data-testid="cake-box-edit"
                    icon="i-heroicons-pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="`編輯 ${type.name}`"
                    @click="openEdit(type)"
                  />
                  <UButton
                    data-testid="cake-box-remove"
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :aria-label="`移除 ${type.name}`"
                    @click="openRemove(type)"
                  />
                </div>
              </div>
            </div>

            <div v-else data-testid="cake-box-list">
              <EmptyState
                title="目前沒有喜餅款式"
                description="點擊「新增喜餅款式」建立第一個款式"
              />
            </div>
          </section>
          <!-- 額外配發控制面板（issue #108）：表單留右欄，清單資料併入左側賓客分配表 -->
          <section
            data-testid="cake-box-extra-list"
            class="rounded-xl border border-line bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="mb-2 flex flex-wrap items-center gap-3">
              <span class="text-overline uppercase text-gold-deep">額外配發（公關用）</span>
              <span
                v-if="editingExtraLabel"
                data-testid="vibe-extra-editing-label"
                class="text-caption font-medium text-gold-deep"
              >編輯中：{{ editingExtraLabel }}</span>
              <span v-else-if="extraTotal > 0" class="text-caption text-ink-400 dark:text-neutral-500">共 {{ extraTotal }} 盒</span>
              <span class="h-px flex-1 bg-line" />
            </div>
            <p class="mb-4 text-caption text-ink-500 dark:text-neutral-400">
              發給非賓客的對象（公司同事、合作廠商等）；加入後顯示於左側賓客分配表（分類篩「額外配發」），只併入訂購總數、不進賓客名單。
            </p>

            <UAlert
              v-if="extraError"
              data-testid="cake-box-extra-error"
              icon="i-heroicons-exclamation-triangle"
              color="error"
              variant="soft"
              :title="extraError"
              class="mb-3"
            />
            <div class="space-y-3">
              <div class="flex flex-wrap items-end gap-3">
                <UFormField label="款式" class="min-w-40 flex-1">
                  <USelectMenu
                    v-model="extraTypeId"
                    data-testid="cake-box-extra-type"
                    :items="typeOptions"
                    value-key="value"
                    placeholder="選擇款式"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="數量" class="w-28">
                  <UInput
                    v-model="extraQtyText"
                    data-testid="cake-box-extra-qty"
                    type="number"
                    min="1"
                    placeholder="數量"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <UFormField label="姓名">
                <UInput
                  v-model="extraName"
                  data-testid="cake-box-extra-name"
                  placeholder="收餅人姓名（選填）"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="聯絡">
                <UInput
                  v-model="extraContact"
                  data-testid="cake-box-extra-contact"
                  placeholder="電話／地址（選填）"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="備註">
                <UInput
                  v-model="extraNote"
                  data-testid="cake-box-extra-note"
                  placeholder="如：公司同事（選填）"
                  class="w-full"
                />
              </UFormField>
            </div>
            <!-- 送出／取消獨立一排（不接在欄位後） -->
            <div class="mt-4 flex items-center justify-end gap-2">
              <UButton
                v-if="editingExtraId"
                data-testid="vibe-extra-edit-cancel"
                color="neutral"
                variant="ghost"
                :disabled="isAddingExtra"
                @click="resetExtraForm"
              >
                取消
              </UButton>
              <UButton
                data-testid="cake-box-extra-add"
                :icon="editingExtraId ? 'i-heroicons-check' : 'i-heroicons-plus'"
                color="neutral"
                :variant="editingExtraId ? 'solid' : 'outline'"
                :loading="isAddingExtra"
                :disabled="(cakeBoxTypes ?? []).length === 0"
                @click="submitExtraOrder"
              >
                {{ editingExtraId ? '更新' : '加入' }}
              </UButton>
            </div>
          </section>
        </aside>

        <!-- 主欄：賓客分配（訂購總覽 + 百人表格），視覺擺左 -->
        <div class="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <!-- 賓客分配：訂購總覽 + 全賓客表（款式欄就地下拉改款）；testid 供持久化測試定位 -->
          <section
            data-testid="cake-box-assignment-list"
            class="rounded-xl border border-line bg-white p-5 shadow-sm lg:flex lg:h-full lg:flex-col dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="mb-2 flex flex-wrap items-center gap-3">
              <span class="text-overline uppercase text-gold-deep">賓客分配</span>
              <span class="text-caption text-ink-400 dark:text-neutral-500">共 {{ pickupList.length }} 位</span>
              <span class="h-px flex-1 bg-line" />
            </div>

            <p class="mb-4 text-caption text-ink-500 dark:text-neutral-400">
              每位賓客的禮盒款式：可在表格內直接改款；未指定者帶入預設款（{{ defaultType?.name ?? '尚未設定預設款' }}）。
            </p>

            <div v-if="pickupList.length === 0">
              <EmptyState title="目前沒有賓客" description="請先於賓客管理新增賓客" />
            </div>
            <template v-else>
              <!-- 訂購總覽：暖色 cream 摘要列（與灰色工具面板區隔：摘要暖、工具灰），每款 inline 合計 + 句末總計 -->
              <div class="mb-4 rounded-lg bg-cream p-4 dark:bg-neutral-800/40">
                <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <div
                    v-for="grp in orderAmountSummary"
                    :key="grp.cakeBoxTypeId || 'none'"
                    class="flex items-baseline gap-1.5"
                  >
                    <span class="size-2 shrink-0 self-center rounded-full bg-gold" />
                    <span class="text-caption text-ink-500 dark:text-neutral-400">{{ grp.cakeBoxTypeName }}</span>
                    <span class="font-display text-body-l font-semibold text-ink dark:text-paper">{{ grp.total }}</span>
                    <span class="text-caption text-ink-400">盒</span>
                    <span v-if="grp.extraQty > 0" class="text-caption text-ink-400 dark:text-neutral-500">
                      （賓客 {{ grp.guestQty }}＋額外 {{ grp.extraQty }}）
                    </span>
                    <span
                      v-if="grp.amount != null"
                      :data-testid="`vibe-cake-amount-${grp.cakeBoxTypeId}`"
                      class="text-caption font-medium text-gold-deep"
                    >
                      ＝ {{ formatPrice(grp.amount) }}
                    </span>
                    <span v-else class="text-caption text-ink-400 dark:text-neutral-500">（未定價）</span>
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-1 border-t border-line/70 pt-2 dark:border-neutral-700">
                  <span class="text-caption text-ink-500 dark:text-neutral-400">共計</span>
                  <span class="font-display text-xl font-semibold text-gold-deep">{{ orderTotal }}</span>
                  <span class="text-caption text-ink-400">盒</span>
                  <span v-if="extraTotal > 0" class="text-caption font-normal text-ink-400">
                    （賓客 {{ includedPickup.length }}＋額外 {{ extraTotal }}）
                  </span>
                  <span class="mx-1 text-ink-300 dark:text-neutral-600">·</span>
                  <span class="text-caption text-ink-500 dark:text-neutral-400">總金額</span>
                  <span data-testid="vibe-cake-grand-total" class="font-display text-xl font-semibold text-gold-deep">
                    {{ formatPrice(orderGrandTotal) }}
                  </span>
                  <span v-if="hasUnpricedType" class="text-caption font-normal text-ink-400">
                    （未定價款未計入）
                  </span>
                </div>
              </div>

              <!-- 工具列：指派動作（左）+ 表格搜尋/分類篩選/匯出（右） -->
              <div class="mb-3 flex flex-wrap items-center gap-2">
                <UButton
                  data-testid="cake-box-auto-assign"
                  icon="i-heroicons-sparkles"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="openAutoAssign"
                >
                  依分類帶入
                </UButton>
                <UButton
                  data-testid="cake-box-assign"
                  icon="i-heroicons-adjustments-horizontal"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="openAssign"
                >
                  設定指派
                </UButton>
                <div class="hidden grow sm:block" />
                <UInput
                  v-model="nameQuery"
                  icon="i-heroicons-magnifying-glass"
                  placeholder="搜尋姓名"
                  aria-label="搜尋姓名"
                  size="sm"
                  class="w-full sm:w-44"
                />
                <USelectMenu
                  v-model="categoryFilter"
                  data-testid="vibe-category-filter"
                  :items="categoryFilterOptions"
                  value-key="value"
                  placeholder="全部分類"
                  size="sm"
                  class="w-full sm:w-36"
                />
                <UButton
                  data-testid="cake-box-export-csv"
                  icon="i-heroicons-arrow-down-tray"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :disabled="orderTotal === 0"
                  @click="downloadPickupCsv"
                >
                  下載 CSV
                </UButton>
              </div>
              <p
                v-if="(assignments ?? []).length === 0"
                class="mb-3 text-caption text-ink-400 dark:text-neutral-500"
              >
                尚未設定指派規則，所有賓客皆為預設款。
              </p>

              <!-- 全賓客表（姓名 / 分類 / 禮盒款式：款式欄就地下拉改款）；固定高度、表頭 sticky，只有列在表格內捲 -->
              <div class="max-h-[58vh] overflow-auto rounded-lg border border-line lg:max-h-none lg:min-h-0 lg:flex-1 dark:border-neutral-800">
                <table class="w-full text-left text-body">
                  <thead class="sticky top-0 z-10 bg-white dark:bg-neutral-900">
                    <tr class="border-b border-line text-overline uppercase text-ink-300 dark:border-neutral-800">
                      <th scope="col" class="px-4 py-2.5 font-medium">
                        姓名
                      </th>
                      <th scope="col" class="px-4 py-2.5 font-medium">
                        分類
                      </th>
                      <th scope="col" class="px-4 py-2.5 font-medium">
                        禮盒款式
                      </th>
                      <th scope="col" class="px-4 py-2.5 font-medium">
                        發放狀態
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="filteredPickup.length === 0">
                      <td colspan="4" class="px-4 py-8 text-center text-caption text-ink-400 dark:text-neutral-500">
                        查無符合的賓客
                      </td>
                    </tr>
                    <tr
                      v-for="r in pagedPickupList"
                      :key="r.kind === 'extra' ? r.extraOrderId : r.guestId"
                      :data-testid="r.kind === 'extra' ? `vibe-extra-row-${r.extraOrderId}` : undefined"
                      class="border-b border-line/60 transition-colors last:border-0 dark:border-neutral-800"
                      :class="r.kind === 'extra' && r.extraOrderId === editingExtraId ? 'bg-cream dark:bg-neutral-800/40' : ''"
                    >
                      <!-- 額外配發列（issue #108）：收餅人非賓客，聯絡／備註為次行說明、操作走「⋯」選單 -->
                      <template v-if="r.kind === 'extra'">
                        <td class="px-4 py-2.5">
                          <div class="font-medium text-ink dark:text-paper">
                            {{ r.name }}
                          </div>
                          <p v-if="r.detail" class="mt-0.5 break-words text-caption leading-relaxed text-ink-500 dark:text-neutral-400">
                            {{ r.detail }}
                          </p>
                        </td>
                        <td class="whitespace-nowrap px-4 py-2.5 text-gold-deep">
                          額外配發
                        </td>
                        <!-- pl-2.5 對齊賓客列下拉框的文字起點（USelectMenu sm 內距），欄位左緣視覺一致 -->
                        <td class="whitespace-nowrap px-4 py-2.5 text-ink-500 dark:text-neutral-400">
                          <span class="pl-2.5">{{ r.cakeBoxTypeName }}<span class="ml-1 text-caption font-medium text-gold-deep">×{{ r.quantity }} 盒</span></span>
                        </td>
                        <td class="px-4 py-2.5">
                          <div class="flex items-center gap-1">
                            <span class="whitespace-nowrap text-caption text-ink-300">不經接待發放</span>
                            <UDropdownMenu :items="extraOrderMenuItems(r.extraOrderId)" :content="{ align: 'end' }">
                              <UButton
                                :data-testid="`vibe-extra-menu-${r.extraOrderId}`"
                                icon="i-heroicons-ellipsis-horizontal"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                :aria-label="`${r.cakeBoxTypeName} 額外配發操作`"
                              />
                            </UDropdownMenu>
                          </div>
                        </td>
                      </template>
                      <template v-else>
                        <td class="px-4 py-2.5 font-medium text-ink dark:text-paper">
                          {{ r.name }}
                        </td>
                        <td class="px-4 py-2.5 text-ink-500 dark:text-neutral-400">
                          {{ r.category }}
                        </td>
                        <td class="px-4 py-2.5">
                          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <USelectMenu
                              :model-value="rowStyleValue(r)"
                              :items="styleOptionsWithNone"
                              value-key="value"
                              :data-testid="`vibe-row-style-${r.guestId}`"
                              :loading="inlineSavingId === r.guestId"
                              size="sm"
                              class="w-40"
                              @update:model-value="(v: string) => onRowStyleChange(r, v)"
                            />
                            <span v-if="r.excluded" class="text-caption text-ink-300">不計入訂購</span>
                            <span v-else-if="r.isFallback" class="text-caption text-ink-300">（預設）</span>
                            <span
                              v-else-if="r.assignmentRule"
                              class="text-caption text-ink-400 dark:text-neutral-500"
                            >
                              {{ r.assignmentRule }}
                            </span>
                          </div>
                        </td>
                        <!-- 發放狀態：已發放顯示款式徽章 + 取消發放（後台限定）；未發放留空 -->
                        <td class="px-4 py-2.5">
                          <div v-if="distributedTypeName(r.guestId)" class="flex flex-wrap items-center gap-2">
                            <span class="inline-flex items-center gap-1 text-caption font-medium text-success-600 dark:text-success-400">
                              <UIcon name="i-heroicons-check-circle-20-solid" class="size-4" />
                              已發放（{{ distributedTypeName(r.guestId) }}）
                            </span>
                            <UButton
                              :data-testid="`vibe-cancel-distribution-${r.guestId}`"
                              icon="i-heroicons-arrow-uturn-left"
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              :loading="isCancelling && cancelTarget?.guestId === r.guestId"
                              @click="openCancelDistribution(r.guestId, r.name)"
                            >
                              取消發放
                            </UButton>
                          </div>
                          <span v-else class="text-caption text-ink-300">未發放</span>
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 分頁（逾一頁才顯示；套用在篩選後清單上） -->
              <div
                v-if="filteredPickup.length > pickupPageSize"
                class="mt-4 flex justify-end"
              >
                <UPagination
                  v-model:page="pickupPage"
                  :total="filteredPickup.length"
                  :items-per-page="pickupPageSize"
                  show-edges
                />
              </div>
            </template>
          </section>
        </div>
      </div>
    </div>

    <!-- 新增 / 編輯喜餅款式 Modal -->
    <!-- 攔 focusOutside：點縮圖上傳開啟系統檔案視窗會搶走焦點，預設會被當成「點外面」而關閉 modal；
         只擋焦點外移關閉，點遮罩 / Esc 仍可關閉 -->
    <UModal
      v-model:open="isFormOpen"
      :content="{ onFocusOutside: (e) => e.preventDefault() }"
    >
      <template #content>
        <div data-testid="cake-box-form-modal" class="p-6">
          <h3 class="mb-4 font-display text-body-l font-semibold text-ink dark:text-paper">
            {{ editingId ? '編輯喜餅款式' : '新增喜餅款式' }}
          </h3>

          <UAlert
            v-if="formError"
            data-testid="cake-box-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="formError"
            class="mb-4"
          />

          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField
              label="名稱"
              name="name"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.name"
                data-testid="cake-box-name"
                placeholder="請輸入款式名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField label="說明" name="description">
              <UTextarea
                v-model="state.description"
                data-testid="cake-box-description"
                placeholder="款式說明（選填）"
                class="w-full"
              />
            </UFormField>

            <UFormField label="縮圖" name="imageUrl">
              <div class="flex items-center gap-4">
                <div class="size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-white dark:border-neutral-800 dark:bg-neutral-800">
                  <img
                    v-if="imageUrl"
                    :src="imageUrl"
                    alt="縮圖預覽"
                    loading="lazy"
                    class="size-full object-cover"
                  >
                  <div v-else class="flex size-full items-center justify-center text-ink-300">
                    <UIcon name="i-heroicons-photo" class="size-6" />
                  </div>
                </div>
                <!-- 隱藏 input + outline 次要鈕（取代黑色 file:bg-ink 鈕，對齊克制風格） -->
                <div class="flex flex-col items-start gap-1.5">
                  <input
                    ref="imageInputRef"
                    type="file"
                    accept="image/*"
                    data-testid="cake-box-image"
                    class="hidden"
                    @change="onPickImage"
                  >
                  <UButton
                    type="button"
                    icon="i-heroicons-arrow-up-tray"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="imageInputRef?.click()"
                  >
                    {{ imageUrl ? '更換圖片' : '上傳圖片' }}
                  </UButton>
                  <p class="text-caption text-ink-300">
                    建議方形，5MB 內
                  </p>
                  <UButton
                    v-if="imageUrl"
                    type="button"
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="xs"
                    @click="imageUrl = ''"
                  >
                    移除圖片
                  </UButton>
                </div>
              </div>
            </UFormField>

            <UFormField label="價格" name="price">
              <UInput
                v-model="priceText"
                data-testid="cake-box-price"
                type="number"
                min="0"
                placeholder="單價（元，選填）"
                class="w-full"
              >
                <template #leading>
                  <span class="text-caption text-ink-400">NT$</span>
                </template>
              </UInput>
            </UFormField>

            <UFormField name="isDefault">
              <UCheckbox
                v-model="state.isDefault"
                data-testid="cake-box-default"
                label="設為預設款式"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
                @click="isFormOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="cake-box-submit"
                color="neutral"
                variant="solid"
                :loading="isSubmitting"
              >
                {{ editingId ? '儲存' : '新增' }}
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 設定指派規則 Modal -->
    <UModal v-model:open="isAssignOpen">
      <template #content>
        <div data-testid="cake-box-assign-modal" class="p-6">
          <h3 class="mb-1 font-display text-body-l font-semibold text-ink dark:text-paper">
            設定喜餅指派規則
          </h3>
          <p class="mb-4 text-caption text-ink-500 dark:text-neutral-400">
            指派＝標記某位賓客拿哪一款喜餅，接待發放時會自動帶入該款；沒指派的人發放預設款。
          </p>

          <UAlert
            v-if="assignError"
            data-testid="cake-box-assign-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="assignError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField
              label="指派規則（選填備註）"
              name="assignmentRule"
              description="只是給自己看的備註，例：家人→豪華禮盒。實際決定的是下面的「款式 × 賓客」。"
            >
              <UInput
                v-model="assignState.assignmentRule"
                data-testid="assignment-rule"
                placeholder="如：家人→大餅＋豪華禮盒"
                class="w-full"
              />
            </UFormField>

            <UFormField label="喜餅款式" name="cakeBoxTypeId">
              <USelectMenu
                v-model="assignState.cakeBoxTypeId"
                data-testid="assignment-type-select"
                :items="typeOptions"
                value-key="value"
                placeholder="選擇喜餅款式"
                class="w-full"
              />
            </UFormField>

            <UFormField label="對象賓客" name="guestId">
              <USelectMenu
                v-model="assignState.guestId"
                data-testid="assignment-guest-select"
                :items="guestOptions"
                value-key="value"
                placeholder="選擇對象賓客"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isAssigning"
                @click="isAssignOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="assignment-submit"
                color="neutral"
                variant="solid"
                :loading="isAssigning"
                @click="confirmAssign"
              >
                設定
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 依分類帶入 Modal -->
    <UModal v-model:open="isAutoOpen">
      <template #content>
        <div data-testid="cake-box-auto-modal" class="p-6">
          <h3 class="mb-1 font-display text-body-l font-semibold text-ink dark:text-paper">
            依分類帶入喜餅
          </h3>
          <p class="mb-4 text-body text-ink-500 dark:text-neutral-400">
            為每個賓客分類選一種款式，套用後所有賓客依分類自動帶入；沒對到的給預設款（{{ defaultType?.name ?? '尚未設定預設款' }}）。
          </p>

          <UAlert
            data-testid="cake-box-auto-warning"
            icon="i-heroicons-exclamation-triangle"
            color="warning"
            variant="soft"
            title="此操作會覆蓋所有賓客現有的個別調整，且無法復原。"
            class="mb-4"
          />

          <UAlert
            v-if="autoError"
            data-testid="cake-box-auto-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="autoError"
            class="mb-4"
          />

          <div v-if="distinctCategories.length === 0" class="py-4">
            <EmptyState
              title="目前沒有賓客分類"
              description="請先於賓客管理新增賓客"
            />
          </div>
          <div v-else class="max-h-80 space-y-3 overflow-auto">
            <div
              v-for="cat in distinctCategories"
              :key="cat"
              class="flex items-center gap-3"
            >
              <span class="w-28 shrink-0 text-body font-medium text-ink dark:text-paper">
                {{ cat }}
                <span class="text-caption text-ink-400">（{{ categoryCount(cat) }} 位）</span>
              </span>
              <USelectMenu
                v-model="categoryRule[cat]"
                :data-testid="`cake-box-auto-rule-${cat}`"
                :items="typeOptions"
                value-key="value"
                placeholder="選擇款式"
                class="flex-1"
              />
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-5">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isApplying"
              @click="isAutoOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="cake-box-auto-apply"
              color="primary"
              variant="solid"
              :loading="isApplying"
              :disabled="distinctCategories.length === 0"
              @click="applyByCategory"
            >
              套用
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 移除確認 -->
    <ConfirmModal
      v-model:open="isRemoveOpen"
      title="確認移除"
      :description="`確定要移除喜餅款式「${removeTarget?.name ?? ''}」嗎？`"
      confirm-label="移除"
      confirm-color="error"
      :loading="isRemoving"
      @confirm="confirmRemove"
    />

    <ConfirmModal
      v-model:open="isCancelOpen"
      title="取消喜餅發放"
      :description="`確定要取消「${cancelTarget?.name ?? ''}」的喜餅發放嗎？取消後接待台會回到未發放狀態。`"
      confirm-label="取消發放"
      confirm-color="error"
      :loading="isCancelling"
      @confirm="confirmCancelDistribution"
    />
  </div>
</template>
