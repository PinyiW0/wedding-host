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
  confirmPendingGuest,
  createGuest,
  deleteGuest,
  importGuests,
  listGuests,
  listPendingGuests,
  mergePendingGuest,
  rejectPendingGuest,
  restoreGuest,
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
const deletedGuests = computed(() =>
  (guests.value ?? []).filter(g => g.deletedAt),
)

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

// 複製公開自助回覆連結（供分享給尚未在名單上的賓客）
async function copyPublicLink() {
  const url = `${window.location.origin}/rsvp/public/${weddingId.value}`
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: '已複製公開回覆連結', description: url, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: url, color: 'error' })
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
    await refresh()
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
          <div
            v-for="pending in pendingList"
            :key="pending.guestId"
            :data-testid="`pending-card-${pending.guestId}`"
            class="rounded-lg border border-line bg-paper p-5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <!-- 回覆摘要 -->
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-display text-h3 font-semibold text-ink dark:text-paper">
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
        <!-- 賓客名單（未移除）— 編輯式表格 -->
        <table
          data-testid="guest-list"
          class="w-full border-collapse text-body"
        >
          <thead>
            <tr class="text-left text-overline uppercase text-gold-deep">
              <th class="border-b border-line px-3 py-3.5 font-medium">
                姓名
              </th>
              <th class="hidden border-b border-line px-3 py-3.5 font-medium sm:table-cell">
                方
              </th>
              <th class="hidden border-b border-line px-3 py-3.5 font-medium sm:table-cell">
                餐點
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
              <td colspan="6">
                <EmptyState
                  title="目前沒有賓客"
                  description="點擊「新增賓客」或「匯入名單」建立賓客名單"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 回收區（已移除，常駐渲染供恢復操作可達） -->
        <div v-if="deletedGuests.length > 0">
          <div class="mb-3 flex items-center gap-3">
            <span class="text-overline uppercase text-gold-deep">已移除的賓客</span>
            <span class="h-px flex-1 bg-line" />
          </div>
          <table
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
            <h3 class="mb-5 font-display text-h2 font-semibold text-ink dark:text-paper">
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
                  <UInput
                    v-model="state.category"
                    data-testid="guest-category"
                    placeholder="如：同事、家人、朋友"
                    class="w-full"
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
          <h3 class="mb-5 font-display text-h2 font-semibold text-ink dark:text-paper">
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
  </div>
</template>
