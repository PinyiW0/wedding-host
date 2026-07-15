<!-- app/pages/weddings/[weddingId]/guests.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateGuestBody,
  GuestDiet,
  GuestListItem,
  GuestSide,
  ImportGuestsBody,
  UpdateGuestBody,
} from '~/types/api/guests'

import type { MatchConfidence } from '~/utils/guestMatch'

import { z } from 'zod'
import {
  batchCategorizeGuests,
  batchDeleteGuests,
  confirmPendingGuest,
  createGuest,
  deleteGuest,
  getSignedLink,
  importGuests,
  listGuestCategories,
  listGuests,
  listPendingGuests,
  mergePendingGuest,
  rejectPendingGuest,
  renameGuestCategory,
  restoreGuest,
  saveGuestCategories,
  updateGuest,
} from '~/api'
import { matchConfidenceLabel, suggestMatches } from '~/utils/guestMatch'
import { rsvpAttendingMeta } from '~/utils/statusMeta'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 賓客名單（含已移除，UI 以 deletedAt 分區呈現）
const { data: guests, refresh } = await listGuests(weddingId, {
  default: () => [],
})

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)
// 已移除賓客預設不顯示（避免干擾正式名單），展開折疊區才可見、可恢復
const showDeletedGuests = ref(false)
const deletedGuests = computed(() =>
  (guests.value ?? []).filter(g => g.deletedAt),
)

// 出席統計總覽（純前端讀模型）：出席 = rsvpAttending 'attending'；
// 大人 = partySize − childChairCount；素食以登記筆數計（diet 為每組一筆，無法拆到人頭）
const attendingGuests = computed(() =>
  activeGuests.value.filter(g => g.rsvpAttending === 'attending'),
)
const guestStats = computed(() => {
  const adults = attendingGuests.value.reduce((sum, g) => sum + (g.partySize - g.childChairCount), 0)
  const children = attendingGuests.value.reduce((sum, g) => sum + g.childChairCount, 0)
  const vegetarian = attendingGuests.value.filter(g => g.diet === 'vegetarian').length
  return [
    { key: 'total', label: '出席總人數', value: adults + children },
    { key: 'adults', label: '大人', value: adults },
    { key: 'children', label: '小孩（兒童椅）', value: children },
    { key: 'vegetarian', label: '素食（組）', value: vegetarian },
  ]
})

// 婚禮層級分類清單（新增賓客快選 + 管理 modal；GET = 儲存清單 ∪ 在用分類）
const { data: categories, refresh: refreshCategories } = await listGuestCategories(weddingId, {
  default: () => [],
})
const categoryList = computed(() => categories.value ?? [])
// 分類下拉選項（分類多時 badge 快選會擠爆表單，改下拉選擇帶入）
const categorySelectItems = computed(() => categoryList.value.map(c => ({ label: c, value: c })))

// 各分類使用數（僅計未刪除賓客；刪除分類的守門依據）
const categoryUsage = computed(() => {
  const map = new Map<string, number>()
  for (const g of activeGuests.value) {
    const name = g.category.trim()
    if (!name)
      continue
    map.set(name, (map.get(name) ?? 0) + 1)
  }
  return map
})

// === 管理分類 modal ===
const isCategoryOpen = ref(false)
const isCategorySubmitting = ref(false)
const categoryActionError = ref('')
const newCategoryName = ref('')
// 單列 inline 改名狀態
const renamingFrom = ref<string | null>(null)
const renameTo = ref('')

function openCategoryManager() {
  categoryActionError.value = ''
  newCategoryName.value = ''
  renamingFrom.value = null
  isCategoryOpen.value = true
}

async function addCategory() {
  const name = newCategoryName.value.trim()
  if (!name || isCategorySubmitting.value)
    return
  if (categoryList.value.includes(name)) {
    categoryActionError.value = '分類已存在'
    return
  }
  isCategorySubmitting.value = true
  categoryActionError.value = ''
  try {
    await saveGuestCategories(weddingId.value, { categories: [...categoryList.value, name] })
    newCategoryName.value = ''
    await refreshCategories()
  }
  catch (error: any) {
    categoryActionError.value = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isCategorySubmitting.value = false
  }
}

async function removeCategory(name: string) {
  if (isCategorySubmitting.value || (categoryUsage.value.get(name) ?? 0) > 0)
    return
  isCategorySubmitting.value = true
  categoryActionError.value = ''
  try {
    await saveGuestCategories(weddingId.value, { categories: categoryList.value.filter(c => c !== name) })
    await refreshCategories()
  }
  catch (error: any) {
    categoryActionError.value = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isCategorySubmitting.value = false
  }
}

function startRename(name: string) {
  renamingFrom.value = name
  renameTo.value = name
  categoryActionError.value = ''
}

async function confirmRename() {
  const from = renamingFrom.value
  const to = renameTo.value.trim()
  if (!from || isCategorySubmitting.value)
    return
  if (!to || from === to) {
    renamingFrom.value = null
    return
  }
  isCategorySubmitting.value = true
  categoryActionError.value = ''
  try {
    const result = await renameGuestCategory(weddingId.value, { from, to })
    toast.add({
      title: '分類已改名',
      description: `「${from}」→「${to}」，已同步 ${result.updatedGuests} 位賓客`,
      color: 'success',
    })
    renamingFrom.value = null
    await Promise.all([refresh(), refreshCategories()])
  }
  catch (error: any) {
    categoryActionError.value = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isCategorySubmitting.value = false
  }
}

// 待確認賓客（公開自助回覆，與正式名單隔離；獨立端點）
const { data: pendingGuests, refresh: refreshPending } = await listPendingGuests(weddingId, {
  default: () => [],
})
const pendingList = computed(() => pendingGuests.value ?? [])

// 姓名提示候選（永不自動合併）：以正式名單比對每筆待確認回覆
function candidatesFor(pending: GuestListItem) {
  return suggestMatches(activeGuests.value, pending)
}
const confidenceColor: Record<MatchConfidence, 'success' | 'warning' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'neutral',
}

// 待確認動作：併入既有 / 建為新賓客 / 略過
const actingId = ref<string | null>(null)
async function doMerge(pending: GuestListItem, target: GuestListItem) {
  if (actingId.value)
    return
  actingId.value = pending.guestId
  try {
    await mergePendingGuest(weddingId.value, pending.guestId, { targetGuestId: target.guestId })
    toast.add({ title: `已併入 ${target.name}`, color: 'success' })
    await Promise.all([refresh(), refreshPending()])
  }
  catch (error: any) {
    toast.add({
      title: '併入失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    actingId.value = null
  }
}
async function doConfirm(pending: GuestListItem) {
  if (actingId.value)
    return
  actingId.value = pending.guestId
  try {
    await confirmPendingGuest(weddingId.value, pending.guestId)
    toast.add({ title: `已建立賓客 ${pending.name}`, color: 'success' })
    await Promise.all([refresh(), refreshPending()])
  }
  catch (error: any) {
    toast.add({
      title: '建立失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    actingId.value = null
  }
}
async function doReject(pending: GuestListItem) {
  if (actingId.value)
    return
  actingId.value = pending.guestId
  try {
    await rejectPendingGuest(weddingId.value, pending.guestId)
    toast.add({ title: '已略過此回覆', color: 'success' })
    await refreshPending()
  }
  catch (error: any) {
    toast.add({
      title: '略過失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    actingId.value = null
  }
}

// 連結中心（issue #15）：單一賓客四類簽名連結 + QR
const linkCenterOpen = ref(false)
const linkCenterGuest = ref<{ guestId: string, name: string } | null>(null)
function openLinkCenter(guest: GuestListItem) {
  linkCenterGuest.value = { guestId: guest.guestId, name: guest.name }
  linkCenterOpen.value = true
}

// 複製公開自助回覆連結（供分享給尚未在名單上的賓客）
async function copyPublicLink() {
  const base = `${window.location.origin}/rsvp/public/${weddingId.value}`
  try {
    // 連結附 HMAC 簽名：enforced 模式下公開頁憑此放行
    const { sig } = await getSignedLink(weddingId.value)
    const url = `${base}?sig=${sig}`
    await navigator.clipboard.writeText(url)
    toast.add({ title: '已複製公開回覆連結', description: url, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: base, color: 'error' })
  }
}

// 顯示文字對照
const sideLabel = (side: GuestSide) => (side === 'groom' ? '男方' : '女方')
const dietLabel = (diet: GuestDiet) => (diet === 'meat' ? '葷食' : '素食')

// RSVP 出席狀態顯示（null = 待回覆）；文字與語意色由 statusMeta 統一（declined 統一為 error）
const rsvpMeta = (s: GuestListItem['rsvpAttending']) => rsvpAttendingMeta(s)

// === 篩選膠囊（純前端，預設「全部」；膠囊帶數量避免與表單「男方」按鈕撞名）===
type GuestFilter = 'all' | 'groom' | 'bride' | 'pending' | 'review'
const filter = ref<GuestFilter>('all')
const filterTabs = [
  { key: 'all', label: '全部' },
  { key: 'groom', label: '男方' },
  { key: 'bride', label: '女方' },
  { key: 'pending', label: '待回覆' },
  { key: 'review', label: '待確認' },
] as const

function countOf(key: GuestFilter) {
  if (key === 'review')
    return pendingList.value.length
  const list = activeGuests.value
  if (key === 'groom')
    return list.filter(g => g.side === 'groom').length
  if (key === 'bride')
    return list.filter(g => g.side === 'bride').length
  if (key === 'pending')
    return list.filter(g => g.rsvpAttending == null).length
  return list.length
}

// 搜尋（純前端，僅過濾已載入資料的顯示，不動 API）
const search = ref('')

const filteredGuests = computed(() => {
  let list = activeGuests.value
  if (filter.value === 'groom')
    list = list.filter(g => g.side === 'groom')
  else if (filter.value === 'bride')
    list = list.filter(g => g.side === 'bride')
  else if (filter.value === 'pending')
    list = list.filter(g => g.rsvpAttending == null)

  const keyword = search.value.trim().toLowerCase()
  if (keyword) {
    list = list.filter(g =>
      g.name.toLowerCase().includes(keyword)
      || g.category.toLowerCase().includes(keyword),
    )
  }
  return list
})

// === 批次操作（多選模式，issue #75）===
// 比照 reception 批量報到的 batchMode／selectedIds；操作走批次單端點（單語句 SQL）
const batchMode = ref(false)
const selectedIds = ref(new Set<string>())
const isBatchWorking = ref(false)

// 實際操作對象：目前過濾結果 ∩ 已勾選（改篩選後看不見的不會被誤操作）
const selectedGuests = computed(() =>
  filteredGuests.value.filter(g => selectedIds.value.has(g.guestId)),
)

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  selectedIds.value = new Set()
}

function exitBatchMode() {
  batchMode.value = false
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
  selectedIds.value = new Set(filteredGuests.value.map(g => g.guestId))
}

// 批次移除（軟刪除；回報實際筆數，未命中者不計）
const isBatchRemoveOpen = ref(false)

async function confirmBatchRemove() {
  if (isBatchWorking.value || selectedGuests.value.length === 0)
    return
  isBatchWorking.value = true
  const ids = selectedGuests.value.map(g => g.guestId)
  try {
    const result = await batchDeleteGuests(weddingId.value, { guestIds: ids })
    const skipped = ids.length - result.deletedCount
    toast.add({
      title: `已移除 ${result.deletedCount} 位賓客`,
      description: skipped > 0 ? `${skipped} 位未處理，請重新整理後再試` : undefined,
      color: 'success',
    })
    isBatchRemoveOpen.value = false
    exitBatchMode()
    await refresh()
  }
  catch (error: any) {
    toast.add({
      title: '批次移除失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    isBatchWorking.value = false
  }
}

// 批次改分類（自由字串，與單筆編輯一致；新分類會進入在用分類 union）
const isBatchCategoryOpen = ref(false)
const batchCategoryName = ref('')
const batchCategoryError = ref('')

function openBatchCategory() {
  batchCategoryName.value = ''
  batchCategoryError.value = ''
  isBatchCategoryOpen.value = true
}

async function confirmBatchCategory() {
  if (isBatchWorking.value || selectedGuests.value.length === 0)
    return
  const name = batchCategoryName.value.trim()
  if (!name) {
    batchCategoryError.value = '請輸入分類名稱'
    return
  }
  isBatchWorking.value = true
  batchCategoryError.value = ''
  const ids = selectedGuests.value.map(g => g.guestId)
  try {
    const result = await batchCategorizeGuests(weddingId.value, { guestIds: ids, category: name })
    toast.add({ title: `已將 ${result.updatedCount} 位賓客分類為「${name}」`, color: 'success' })
    isBatchCategoryOpen.value = false
    exitBatchMode()
    await Promise.all([refresh(), refreshCategories()])
  }
  catch (error: any) {
    batchCategoryError.value = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isBatchWorking.value = false
  }
}

// === 待確認區一鍵處理（issue #75）：逐筆呼叫既有端點（量小），完成後統計回報 ===
const isPendingBatchWorking = ref(false)
const isRejectAllOpen = ref(false)

async function runPendingBatch(action: (guestId: string) => Promise<unknown>, label: string) {
  if (isPendingBatchWorking.value || pendingList.value.length === 0)
    return
  isPendingBatchWorking.value = true
  const targets = [...pendingList.value]
  try {
    const results = await Promise.allSettled(targets.map(p => action(p.guestId)))
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - succeeded
    toast.add({
      title: `${label}完成：成功 ${succeeded}、失敗 ${failed}`,
      color: failed > 0 ? 'warning' : 'success',
    })
    await Promise.all([refresh(), refreshPending()])
  }
  finally {
    isPendingBatchWorking.value = false
  }
}

function confirmAllPending() {
  return runPendingBatch(id => confirmPendingGuest(weddingId.value, id), '全部建立')
}

async function rejectAllPending() {
  await runPendingBatch(id => rejectPendingGuest(weddingId.value, id), '全部略過')
  isRejectAllOpen.value = false
}

// === 新增 / 編輯賓客表單 ===
const schema = z.object({
  name: z.string().trim().min(1, '請輸入賓客姓名'),
  side: z.enum(['groom', 'bride']),
  diet: z.enum(['meat', 'vegetarian']),
  category: z.string().trim().min(1, '請輸入分類'),
  contact: z.string().trim(),
  plusOneCount: z.number().min(0), // 同行人數（攜伴大人＋會自己坐吃大人菜的小孩；佔正常席）
  childChairCount: z.number().min(0), // 兒童椅嬰兒數（額外加位、不佔正常席）
  notes: z.string().trim(),
})

type Schema = z.output<typeof schema>

const isFormOpen = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const editingId = ref<string | null>(null)
const state = reactive<Schema>({
  name: '',
  side: 'groom',
  diet: 'meat',
  category: '',
  contact: '',
  plusOneCount: 0,
  childChairCount: 0,
  notes: '',
})

function resetState() {
  state.name = ''
  state.side = 'groom'
  state.diet = 'meat'
  state.category = ''
  state.contact = ''
  state.plusOneCount = 0
  state.childChairCount = 0
  state.notes = ''
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  resetState()
  isFormOpen.value = true
}

function openEdit(guest: GuestListItem) {
  editingId.value = guest.guestId
  formError.value = ''
  state.name = guest.name
  state.side = guest.side
  state.diet = guest.diet
  state.category = guest.category
  state.contact = guest.contact
  state.childChairCount = guest.childChairCount
  // partySize 含本人＋同行＋兒童椅嬰兒，回填時拆出同行人數
  state.plusOneCount = Math.max(0, guest.partySize - 1 - guest.childChairCount)
  state.notes = guest.notes ?? ''
  isFormOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  formError.value = ''
  try {
    const data = event.data
    if (editingId.value) {
      const body: UpdateGuestBody = {
        name: data.name,
        side: data.side,
        diet: data.diet,
        category: data.category,
        contact: data.contact,
        partySize: 1 + data.plusOneCount + data.childChairCount,
        childChairCount: data.childChairCount,
        notes: data.notes,
      }
      await updateGuest(weddingId.value, editingId.value, body)
      toast.add({ title: '賓客已更新', color: 'success' })
    }
    else {
      const body: CreateGuestBody = {
        name: data.name,
        side: data.side,
        diet: data.diet,
        category: data.category,
        contact: data.contact,
        partySize: 1 + data.plusOneCount + data.childChairCount,
        childChairCount: data.childChairCount,
        notes: data.notes || undefined,
      }
      await createGuest(weddingId.value, body)
      toast.add({ title: '賓客新增成功', color: 'success' })
    }
    isFormOpen.value = false
    // 自由輸入的新分類會進入在用分類 union，一併刷新快選清單
    await Promise.all([refresh(), refreshCategories()])
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

// === 移除賓客 ===
const isRemoveOpen = ref(false)
const isRemoving = ref(false)
const removeTarget = ref<GuestListItem | null>(null)

function openRemove(guest: GuestListItem) {
  removeTarget.value = guest
  isRemoveOpen.value = true
}

async function confirmRemove() {
  if (!removeTarget.value || isRemoving.value)
    return
  isRemoving.value = true
  try {
    await deleteGuest(weddingId.value, removeTarget.value.guestId)
    toast.add({ title: '賓客已移除', color: 'success' })
    isRemoveOpen.value = false
    await refresh()
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

// === 恢復賓客 ===
const isRestoreOpen = ref(false)
const isRestoring = ref(false)
const restoreTarget = ref<GuestListItem | null>(null)

function openRestore(guest: GuestListItem) {
  restoreTarget.value = guest
  isRestoreOpen.value = true
}

async function confirmRestore() {
  if (!restoreTarget.value || isRestoring.value)
    return
  isRestoring.value = true
  try {
    await restoreGuest(weddingId.value, restoreTarget.value.guestId)
    toast.add({ title: '賓客已恢復', color: 'success' })
    isRestoreOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '恢復失敗，請稍後再試'
    toast.add({ title: '恢復失敗', description: message, color: 'error' })
  }
  finally {
    isRestoring.value = false
  }
}

// === 批次匯入 ===
const isImportOpen = ref(false)
const isImporting = ref(false)
const importError = ref('')
const importResult = ref<number | null>(null)
const selectedFileName = ref('')

function openImport() {
  importError.value = ''
  importResult.value = null
  selectedFileName.value = ''
  isImportOpen.value = true
}

function onFileSelected(payload: { file: File, name: string, dataUrl: string }) {
  importError.value = ''
  importResult.value = null
  selectedFileName.value = payload.name
}

function onFileError(message: string) {
  importError.value = message
}

async function confirmImport() {
  if (isImporting.value)
    return
  if (!selectedFileName.value) {
    importError.value = '請先選擇檔案'
    return
  }
  isImporting.value = true
  importError.value = ''
  try {
    const body: ImportGuestsBody = { fileName: selectedFileName.value }
    const result = await importGuests(weddingId.value, body)
    importResult.value = result.importedCount
    toast.add({
      title: `成功匯入 ${result.importedCount} 位賓客`,
      color: 'success',
    })
    await refresh()
  }
  catch (error: any) {
    importError.value
      = error?.data?.message || error?.statusMessage || '匯入失敗，請稍後再試'
  }
  finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div data-testid="guests-page" class="flex h-full flex-col">
    <PageHeader
      title="賓客名單"
      :eyebrow="`Guest List · ${activeGuests.length} 位`"
      description="管理此婚禮的賓客資料與批次匯入"
    >
      <template #actions>
        <div class="flex gap-2">
          <UButton
            data-testid="guest-public-link"
            icon="i-heroicons-link"
            color="neutral"
            variant="ghost"
            @click="copyPublicLink"
          >
            公開回覆連結
          </UButton>
          <!-- 命名避開凍結 strict regex（不可含「新增」「匯入」） -->
          <UButton
            data-testid="vibe-guest-categories"
            icon="i-heroicons-tag"
            color="neutral"
            variant="ghost"
            @click="openCategoryManager"
          >
            管理分類
          </UButton>
          <UButton
            data-testid="guest-import"
            icon="i-heroicons-arrow-up-tray"
            color="neutral"
            variant="outline"
            @click="openImport"
          >
            匯入名單
          </UButton>
          <UButton
            data-testid="guest-create"
            icon="i-heroicons-plus"
            color="neutral"
            variant="solid"
            @click="openCreate"
          >
            新增賓客
          </UButton>
        </div>
      </template>
    </PageHeader>

    <!-- 出席統計總覽（vibe：依 RSVP 出席回覆即時計算，與下方名單同資料源） -->
    <div
      data-testid="vibe-guest-stats"
      class="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800"
    >
      <div
        v-for="stat in guestStats"
        :key="stat.key"
        :data-testid="`vibe-guest-stats-${stat.key}`"
        class="bg-white px-5 py-4 dark:bg-neutral-900"
      >
        <p class="text-caption text-ink-500 dark:text-neutral-400">
          {{ stat.label }}
        </p>
        <p class="mt-1 font-display text-h2 font-semibold leading-none text-ink dark:text-paper">
          {{ stat.value }}
        </p>
      </div>
    </div>

    <!-- 搜尋 + 篩選膠囊（編輯式工具列；純前端篩選） -->
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <UInput
        v-model="search"
        data-testid="vibe-guests-search"
        icon="i-heroicons-magnifying-glass"
        placeholder="搜尋姓名 / 分類⋯"
        variant="outline"
        class="w-full sm:max-w-xs"
      />
      <div class="flex flex-wrap items-center gap-2">
        <div data-testid="vibe-guests-filter" class="flex flex-wrap gap-2">
          <button
            v-for="tab in filterTabs"
            :key="tab.key"
            type="button"
            :data-testid="`vibe-guests-filter-${tab.key}`"
            class="rounded-full border px-4 py-1.5 text-sm transition-colors"
            :class="filter === tab.key
              ? 'border-ink bg-ink text-cream'
              : 'border-line text-ink-500 hover:border-gold-deep'"
            @click="filter = tab.key"
          >
            {{ tab.label }} {{ countOf(tab.key) }}
          </button>
        </div>
        <!-- 多選模式切換（僅正式名單適用；命名避開凍結 strict regex） -->
        <UButton
          v-if="filter !== 'review'"
          data-testid="vibe-guest-batch-toggle"
          :icon="batchMode ? 'i-heroicons-x-mark' : 'i-heroicons-check-circle'"
          color="neutral"
          :variant="batchMode ? 'solid' : 'outline'"
          size="sm"
          @click="toggleBatchMode"
        >
          {{ batchMode ? '取消多選' : '多選' }}
        </UButton>
      </div>
    </div>

    <div class="min-h-0 flex-1 space-y-8 overflow-auto">
      <!-- 待確認區（公開自助回覆，人工併入；系統永不自動合併） -->
      <template v-if="filter === 'review'">
        <EmptyState
          v-if="pendingList.length === 0"
          title="目前沒有待確認回覆"
          description="賓客透過公開連結自助回覆後，會出現在這裡等待人工確認"
        />
        <div v-else class="space-y-4">
          <!-- 一鍵處理工具列（issue #75）：逐筆呼叫既有端點，完成後統計回報 -->
          <div
            data-testid="vibe-pending-batch-bar"
            class="flex flex-wrap items-center justify-between gap-3"
          >
            <span class="text-body text-ink-500 dark:text-neutral-400">
              共 <span class="font-semibold text-ink dark:text-paper">{{ pendingList.length }}</span> 筆待確認回覆
            </span>
            <div class="flex flex-wrap gap-2">
              <UButton
                data-testid="vibe-pending-confirm-all"
                icon="i-heroicons-user-plus"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="isPendingBatchWorking"
                @click="confirmAllPending"
              >
                全部建為新賓客
              </UButton>
              <UButton
                data-testid="vibe-pending-reject-all"
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="isPendingBatchWorking"
                @click="isRejectAllOpen = true"
              >
                全部略過
              </UButton>
            </div>
          </div>
          <div
            v-for="pending in pendingList"
            :key="pending.guestId"
            :data-testid="`pending-card-${pending.guestId}`"
            class="rounded-lg border border-line bg-paper p-5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <!-- 回覆摘要 -->
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-display text-body-l font-semibold text-ink dark:text-paper">
                  {{ pending.name }}
                </p>
                <p class="mt-0.5 text-caption text-ink-300">
                  {{ sideLabel(pending.side) }} · {{ pending.category }} · {{ dietLabel(pending.diet) }}
                  <span v-if="pending.contact"> · {{ pending.contact }}</span>
                </p>
                <p class="mt-2">
                  <StatusBadge :color="rsvpMeta(pending.rsvpAttending).color">
                    {{ rsvpMeta(pending.rsvpAttending).label }}
                  </StatusBadge>
                </p>
                <p v-if="pending.blessing" class="mt-2 whitespace-pre-line text-body text-ink-500">
                  「{{ pending.blessing }}」
                </p>
              </div>
              <UBadge color="warning" variant="soft">
                待確認
              </UBadge>
            </div>

            <!-- 姓名提示候選 -->
            <div class="mt-4 border-t border-line pt-4 dark:border-neutral-800">
              <p class="mb-2 text-overline uppercase text-gold-deep">
                系統提示候選（永不自動合併，請人工確認）
              </p>
              <p v-if="candidatesFor(pending).length === 0" class="text-caption text-ink-300">
                無相符的既有賓客，建議「建為新賓客」
              </p>
              <ul v-else class="space-y-2">
                <li
                  v-for="c in candidatesFor(pending)"
                  :key="c.guest.guestId"
                  class="flex items-center justify-between gap-3 rounded border border-line px-3 py-2 dark:border-neutral-800"
                >
                  <span class="flex min-w-0 flex-wrap items-center gap-2">
                    <span class="font-medium text-ink dark:text-paper">{{ c.guest.name }}</span>
                    <UBadge :color="confidenceColor[c.confidence]" variant="soft" size="xs">
                      {{ matchConfidenceLabel[c.confidence] }}
                    </UBadge>
                    <span class="text-caption text-ink-300">{{ c.reason }}</span>
                  </span>
                  <UButton
                    color="primary"
                    variant="soft"
                    size="xs"
                    :loading="actingId === pending.guestId"
                    :aria-label="`併入${c.guest.name}`"
                    @click="doMerge(pending, c.guest)"
                  >
                    併入
                  </UButton>
                </li>
              </ul>
            </div>

            <!-- 動作 -->
            <div class="mt-4 flex flex-wrap gap-2">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-heroicons-user-plus"
                :loading="actingId === pending.guestId"
                @click="doConfirm(pending)"
              >
                建為新賓客
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-heroicons-x-mark"
                :loading="actingId === pending.guestId"
                @click="doReject(pending)"
              >
                略過
              </UButton>
            </div>
          </div>
        </div>
      </template>

      <!-- 正式名單 -->
      <template v-else>
        <!-- 批次操作工具列（多選模式限定；比照 reception vibe-batch-toolbar 模式） -->
        <div
          v-if="batchMode"
          data-testid="vibe-guest-batch-toolbar"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <span class="text-body text-ink-500 dark:text-neutral-400">
            已選 <span class="font-semibold text-ink dark:text-paper">{{ selectedGuests.length }}</span> 位
          </span>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              data-testid="vibe-guest-batch-select-all"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="filteredGuests.length === 0"
              @click="selectAllFiltered"
            >
              全選結果
            </UButton>
            <UButton
              data-testid="vibe-guest-batch-category"
              icon="i-heroicons-tag"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="selectedGuests.length === 0"
              @click="openBatchCategory"
            >
              改分類
            </UButton>
            <UButton
              data-testid="vibe-guest-batch-remove"
              icon="i-heroicons-trash"
              color="error"
              variant="soft"
              size="sm"
              :disabled="selectedGuests.length === 0"
              :loading="isBatchWorking"
              @click="isBatchRemoveOpen = true"
            >
              移除 {{ selectedGuests.length }} 位
            </UButton>
          </div>
        </div>

        <!-- 賓客名單（未移除）— 編輯式表格 -->
        <table
          data-testid="guest-list"
          class="w-full border-collapse text-body"
        >
          <thead>
            <tr class="text-left text-overline uppercase text-gold-deep">
              <th
                v-if="batchMode"
                scope="col"
                aria-label="選取"
                class="w-10 border-b border-line px-3 py-3.5"
              />
              <th class="border-b border-line px-3 py-3.5 font-medium">
                姓名
              </th>
              <th class="hidden border-b border-line px-3 py-3.5 font-medium sm:table-cell">
                方
              </th>
              <th class="hidden border-b border-line px-3 py-3.5 font-medium sm:table-cell">
                餐點
              </th>
              <th class="hidden border-b border-line px-3 py-3.5 font-medium sm:table-cell">
                人數
              </th>
              <th class="hidden border-b border-line px-3 py-3.5 font-medium md:table-cell">
                分類
              </th>
              <th class="border-b border-line px-3 py-3.5 font-medium">
                RSVP
              </th>
              <th class="border-b border-line px-3 py-3.5 text-right font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="text-ink-700 dark:text-neutral-300">
            <tr
              v-for="guest in filteredGuests"
              :key="guest.guestId"
              :data-testid="`guest-row-${guest.guestId}`"
              class="transition-colors hover:bg-paper dark:hover:bg-neutral-900"
            >
              <!-- 多選模式：勾選批次對象 -->
              <td v-if="batchMode" class="border-b border-line px-3 py-4 dark:border-neutral-800">
                <UCheckbox
                  :model-value="selectedIds.has(guest.guestId)"
                  :data-testid="`vibe-guest-batch-tick-${guest.guestId}`"
                  :aria-label="`選取 ${guest.name}`"
                  @update:model-value="toggleSelect(guest.guestId)"
                />
              </td>
              <td class="border-b border-line px-3 py-4 dark:border-neutral-800">
                <span class="flex items-center gap-2.5">
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :class="guest.side === 'groom' ? 'bg-info-500' : 'bg-gold'"
                  />
                  <span class="font-medium text-ink dark:text-paper">
                    {{ guest.name }}
                  </span>
                </span>
              </td>
              <td class="hidden border-b border-line px-3 py-4 sm:table-cell dark:border-neutral-800">
                <span :class="guest.side === 'groom' ? 'text-info-500' : 'text-gold'">
                  {{ sideLabel(guest.side) }}
                </span>
              </td>
              <td class="hidden border-b border-line px-3 py-4 text-ink-500 sm:table-cell dark:border-neutral-800 dark:text-neutral-300">
                <span>{{ dietLabel(guest.diet) }}</span>
              </td>
              <!-- 人數 = 含本人與兒童椅嬰兒的總人頭（partySize）；兒童椅另計 -->
              <td class="hidden border-b border-line px-3 py-4 text-ink-500 sm:table-cell dark:border-neutral-800 dark:text-neutral-300">
                <span>{{ guest.partySize }} 人</span>
                <span v-if="guest.childChairCount > 0" class="text-ink-300"> · 兒童椅 ×{{ guest.childChairCount }}</span>
              </td>
              <td class="hidden border-b border-line px-3 py-4 text-ink-500 md:table-cell dark:border-neutral-800 dark:text-neutral-300">
                {{ guest.category }}
              </td>
              <td class="border-b border-line px-3 py-4 dark:border-neutral-800">
                <StatusBadge :color="rsvpMeta(guest.rsvpAttending).color">
                  {{ rsvpMeta(guest.rsvpAttending).label }}
                </StatusBadge>
              </td>
              <td class="border-b border-line px-3 py-4 text-right dark:border-neutral-800">
                <div class="flex justify-end gap-1">
                  <UButton
                    data-testid="vibe-guest-links"
                    icon="i-heroicons-qr-code"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="`連結 ${guest.name}`"
                    @click="openLinkCenter(guest)"
                  >
                    連結
                  </UButton>
                  <UButton
                    data-testid="guest-edit"
                    icon="i-heroicons-pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="`編輯 ${guest.name}`"
                    @click="openEdit(guest)"
                  >
                    編輯
                  </UButton>
                  <UButton
                    data-testid="guest-remove"
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :aria-label="`移除 ${guest.name}`"
                    @click="openRemove(guest)"
                  >
                    移除
                  </UButton>
                </div>
              </td>
            </tr>
            <tr v-if="filteredGuests.length === 0">
              <td :colspan="batchMode ? 8 : 7">
                <EmptyState
                  title="目前沒有賓客"
                  description="點擊「新增賓客」或「匯入名單」建立賓客名單"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 回收區（已移除）：預設收合不佔畫面，展開後才可見、可恢復 -->
        <div v-if="deletedGuests.length > 0">
          <div class="mb-3 flex items-center gap-3">
            <button
              type="button"
              data-testid="vibe-toggle-deleted-guests"
              class="flex items-center gap-1.5 text-overline uppercase text-gold-deep transition-colors hover:text-gold"
              :aria-expanded="showDeletedGuests"
              @click="showDeletedGuests = !showDeletedGuests"
            >
              已移除的賓客（{{ deletedGuests.length }}）
              <UIcon :name="showDeletedGuests ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="size-3.5" />
            </button>
            <span class="h-px flex-1 bg-line" />
          </div>
          <table
            v-if="showDeletedGuests"
            data-testid="guest-deleted-list"
            class="w-full border-collapse"
          >
            <tbody>
              <tr
                v-for="guest in deletedGuests"
                :key="guest.guestId"
                :data-testid="`guest-row-${guest.guestId}`"
              >
                <td class="border-b border-line px-3 py-4 dark:border-neutral-800">
                  <span class="font-medium text-ink-300 line-through">
                    {{ guest.name }}
                  </span>
                </td>
                <td class="hidden border-b border-line px-3 py-4 text-ink-300 sm:table-cell dark:border-neutral-800">
                  {{ sideLabel(guest.side) }}
                </td>
                <td class="border-b border-line px-3 py-4 text-right dark:border-neutral-800">
                  <UButton
                    data-testid="guest-restore"
                    icon="i-heroicons-arrow-uturn-left"
                    color="primary"
                    variant="ghost"
                    size="sm"
                    :aria-label="`恢復 ${guest.name}`"
                    @click="openRestore(guest)"
                  >
                    恢復
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- 新增 / 編輯賓客 Modal -->
    <UModal v-model:open="isFormOpen">
      <template #content>
        <div data-testid="guest-form-modal" class="flex max-h-[85dvh] flex-col bg-paper dark:bg-neutral-900">
          <!-- 固定標題區 -->
          <div class="px-8 pt-8">
            <h3 class="mb-5 text-body-l font-semibold text-ink dark:text-paper">
              {{ editingId ? '編輯賓客' : '新增賓客' }}
            </h3>

            <UAlert
              v-if="formError"
              data-testid="guest-error"
              icon="i-heroicons-exclamation-triangle"
              color="error"
              variant="soft"
              :title="formError"
              class="mb-0"
            />
          </div>

          <UForm
            :schema="schema"
            :state="state"
            class="flex min-h-0 flex-1 flex-col"
            @submit="onSubmit"
          >
            <!-- 可捲動表單區：欄位過多時只捲這裡，標題與底部按鈕固定 -->
            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-8 py-6">
              <!-- 姓名與分類同排：兩者皆為必填，欄位高度一致，捲動時不會錯版 -->
              <div class="grid grid-cols-2 gap-3">
                <UFormField
                  label="姓名"
                  name="name"
                  class="relative mb-6"
                  :ui="{ error: 'absolute top-full left-0 mt-1' }"
                >
                  <UInput
                    v-model="state.name"
                    data-testid="guest-name"
                    placeholder="請輸入賓客姓名"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  label="分類"
                  name="category"
                  class="relative mb-6"
                  :ui="{ error: 'absolute top-full left-0 mt-1' }"
                >
                  <!-- 保持可 fill 的 UInput（凍結 getByLabel(/分類/).fill 依賴）；下方下拉選擇既有分類帶入 -->
                  <UInput
                    v-model="state.category"
                    data-testid="guest-category"
                    placeholder="如：同事、家人、朋友"
                    class="w-full"
                  />
                  <USelectMenu
                    v-if="categoryList.length"
                    v-model="state.category"
                    data-testid="vibe-guest-category-select"
                    :items="categorySelectItems"
                    value-key="value"
                    placeholder="從既有分類選擇"
                    class="mt-2 w-full"
                  />
                </UFormField>
              </div>

              <!-- 男女方與飲食同排 -->
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="男女方" name="side">
                  <div class="flex gap-2">
                    <UButton
                      :color="state.side === 'groom' ? 'primary' : 'neutral'"
                      :variant="state.side === 'groom' ? 'solid' : 'outline'"
                      @click="state.side = 'groom'"
                    >
                      男方
                    </UButton>
                    <UButton
                      :color="state.side === 'bride' ? 'primary' : 'neutral'"
                      :variant="state.side === 'bride' ? 'solid' : 'outline'"
                      @click="state.side = 'bride'"
                    >
                      女方
                    </UButton>
                  </div>
                </UFormField>

                <UFormField label="飲食" name="diet">
                  <div class="flex gap-2">
                    <UButton
                      :color="state.diet === 'meat' ? 'primary' : 'neutral'"
                      :variant="state.diet === 'meat' ? 'solid' : 'outline'"
                      @click="state.diet = 'meat'"
                    >
                      葷食
                    </UButton>
                    <UButton
                      :color="state.diet === 'vegetarian' ? 'primary' : 'neutral'"
                      :variant="state.diet === 'vegetarian' ? 'solid' : 'outline'"
                      @click="state.diet = 'vegetarian'"
                    >
                      素食
                    </UButton>
                  </div>
                </UFormField>
              </div>

              <UFormField label="聯絡方式" name="contact">
                <UInput
                  v-model="state.contact"
                  data-testid="guest-contact"
                  placeholder="請輸入聯絡電話"
                  class="w-full"
                />
              </UFormField>

              <div class="grid grid-cols-2 gap-3">
                <UFormField label="同行人數" name="plusOneCount">
                  <UInput
                    v-model.number="state.plusOneCount"
                    data-testid="guest-plus-one"
                    type="number"
                    min="0"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="兒童椅嬰兒數" name="childChairCount">
                  <UInput
                    v-model.number="state.childChairCount"
                    data-testid="guest-child-seat"
                    type="number"
                    min="0"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <p class="-mt-2 text-caption text-ink-300">
                會自己坐、吃大人菜的小孩請算進「同行人數」；用兒童椅的小嬰兒填「兒童椅嬰兒數」。
              </p>

              <UFormField label="備註" name="notes">
                <UTextarea
                  v-model="state.notes"
                  data-testid="guest-notes"
                  placeholder="其他備註資訊"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- 固定底部按鈕列：正常流、不覆蓋內容 -->
            <div class="flex justify-end gap-3 border-t border-line bg-paper px-8 py-4 dark:border-neutral-800 dark:bg-neutral-900">
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
                data-testid="guest-submit"
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

    <!-- 批次匯入 Modal -->
    <UModal v-model:open="isImportOpen">
      <template #content>
        <div data-testid="guest-import-modal" class="bg-paper p-8 dark:bg-neutral-900">
          <h3 class="mb-5 text-body-l font-semibold text-ink dark:text-paper">
            批次匯入賓客
          </h3>

          <UAlert
            v-if="importError"
            data-testid="guest-import-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="importError"
            class="mb-4"
          />

          <UAlert
            v-if="importResult !== null"
            data-testid="guest-import-result"
            icon="i-heroicons-check-circle"
            color="success"
            variant="soft"
            :title="`成功匯入 ${importResult} 位賓客`"
            class="mb-4"
          />

          <FileUpload
            accept=".xlsx,.xls"
            label="點擊或拖放 Excel 檔案上傳"
            hint="僅支援 .xlsx 或 .xls 格式"
            @selected="onFileSelected"
            @error="onFileError"
          />

          <div class="mt-6 flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isImporting"
              @click="isImportOpen = false"
            >
              關閉
            </UButton>
            <UButton
              data-testid="guest-import-submit"
              color="neutral"
              variant="solid"
              :loading="isImporting"
              @click="confirmImport"
            >
              開始匯入
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 移除確認 -->
    <ConfirmModal
      v-model:open="isRemoveOpen"
      title="確認移除"
      :description="`確定要移除賓客「${removeTarget?.name ?? ''}」嗎？移除後可從回收區恢復。`"
      confirm-label="移除"
      confirm-color="error"
      :loading="isRemoving"
      @confirm="confirmRemove"
    />

    <!-- 恢復確認 -->
    <ConfirmModal
      v-model:open="isRestoreOpen"
      title="確認恢復"
      :description="`確定要恢復賓客「${restoreTarget?.name ?? ''}」嗎？`"
      confirm-label="恢復"
      confirm-color="primary"
      :loading="isRestoring"
      @confirm="confirmRestore"
    />

    <!-- 批次移除確認 -->
    <ConfirmModal
      v-model:open="isBatchRemoveOpen"
      title="確認批次移除"
      :description="`確定要移除選取的 ${selectedGuests.length} 位賓客嗎？移除後可從回收區恢復。`"
      confirm-label="移除"
      confirm-color="error"
      :loading="isBatchWorking"
      @confirm="confirmBatchRemove"
    />

    <!-- 全部略過確認（略過後不進回收區、無法恢復） -->
    <ConfirmModal
      v-model:open="isRejectAllOpen"
      title="確認全部略過"
      :description="`確定要略過全部 ${pendingList.length} 筆待確認回覆嗎？略過後將不再顯示。`"
      confirm-label="略過"
      confirm-color="error"
      :loading="isPendingBatchWorking"
      @confirm="rejectAllPending"
    />

    <!-- 批次改分類 Modal -->
    <UModal v-model:open="isBatchCategoryOpen">
      <template #content>
        <div data-testid="vibe-guest-batch-category-modal" class="bg-paper p-6 dark:bg-neutral-900">
          <h3 class="text-body-l font-semibold text-ink dark:text-paper">
            批次改分類
          </h3>
          <p class="mb-5 mt-1 text-caption text-ink-300">
            將選取的 {{ selectedGuests.length }} 位賓客改為同一分類
          </p>

          <UAlert
            v-if="batchCategoryError"
            data-testid="vibe-guest-batch-category-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="batchCategoryError"
            class="mb-4"
          />

          <UInput
            v-model="batchCategoryName"
            data-testid="vibe-guest-batch-category-input"
            placeholder="輸入新分類名稱"
            aria-label="批次分類名稱"
            class="w-full"
            @keyup.enter="confirmBatchCategory"
          />
          <USelectMenu
            v-if="categoryList.length"
            v-model="batchCategoryName"
            data-testid="vibe-guest-batch-category-select"
            :items="categorySelectItems"
            value-key="value"
            placeholder="從既有分類選擇"
            class="mt-2 w-full"
          />

          <div class="mt-6 flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isBatchWorking"
              @click="isBatchCategoryOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="vibe-guest-batch-category-submit"
              color="neutral"
              variant="solid"
              :loading="isBatchWorking"
              @click="confirmBatchCategory"
            >
              套用
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 管理分類 Modal -->
    <UModal v-model:open="isCategoryOpen">
      <template #content>
        <div data-testid="vibe-guest-category-modal" class="max-h-[85vh] overflow-y-auto p-6">
          <p class="text-overline uppercase text-gold-deep">
            Categories
          </p>
          <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
            管理分類
          </h3>
          <p class="mb-5 mt-1 text-caption text-ink-300">
            改名會同步所有使用中的賓客；使用中的分類不可刪除
          </p>

          <UAlert
            v-if="categoryActionError"
            data-testid="vibe-guest-category-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="categoryActionError"
            class="mb-4"
          />

          <!-- 新增分類 -->
          <div class="mb-4 flex gap-2">
            <UInput
              v-model="newCategoryName"
              data-testid="vibe-guest-category-input"
              placeholder="輸入新分類名稱"
              aria-label="新分類名稱"
              class="flex-1"
              @keyup.enter="addCategory"
            />
            <UButton
              data-testid="vibe-guest-category-add"
              color="neutral"
              variant="solid"
              :loading="isCategorySubmitting"
              @click="addCategory"
            >
              加入
            </UButton>
          </div>

          <!-- 分類清單（含使用數；inline 改名） -->
          <EmptyState
            v-if="categoryList.length === 0"
            title="尚無分類"
            description="輸入名稱後點「加入」建立第一個分類"
          />
          <ul v-else class="divide-y divide-line rounded-lg border border-line dark:divide-neutral-800 dark:border-neutral-800">
            <li
              v-for="c in categoryList"
              :key="c"
              class="flex items-center gap-2 px-4 py-2.5"
            >
              <template v-if="renamingFrom === c">
                <UInput
                  v-model="renameTo"
                  :aria-label="`改名 ${c}`"
                  class="flex-1"
                  @keyup.enter="confirmRename"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="solid"
                  :loading="isCategorySubmitting"
                  @click="confirmRename"
                >
                  確認改名
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="renamingFrom = null"
                >
                  取消改名
                </UButton>
              </template>
              <template v-else>
                <span class="flex-1 text-body text-ink dark:text-paper">{{ c }}</span>
                <span class="text-caption text-ink-300">{{ categoryUsage.get(c) ?? 0 }} 位使用</span>
                <UButton
                  size="xs"
                  icon="i-heroicons-pencil"
                  color="neutral"
                  variant="ghost"
                  :aria-label="`改名分類 ${c}`"
                  @click="startRename(c)"
                />
                <UButton
                  size="xs"
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  :disabled="(categoryUsage.get(c) ?? 0) > 0"
                  :aria-label="`刪除分類 ${c}`"
                  @click="removeCategory(c)"
                />
              </template>
            </li>
          </ul>

          <div class="mt-5 flex justify-end">
            <UButton
              color="neutral"
              variant="outline"
              @click="isCategoryOpen = false"
            >
              關閉
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 連結中心：每位賓客四類簽名連結 + QR -->
    <GuestLinkCenter
      v-model:open="linkCenterOpen"
      :wedding-id="weddingId"
      :guest="linkCenterGuest"
    />
  </div>
</template>
