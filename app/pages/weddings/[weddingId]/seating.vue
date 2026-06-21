<!-- app/pages/weddings/[weddingId]/seating.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type { GuestListItem } from '~/types/api/guests'
import type {
  CreateTableBody,
  EtiquetteSettings,
  EtiquetteSettingsBody,
  EtiquetteSettingsDetail,
  EtiquetteWarningListItem,
  SeatGuestBody,
  SeatListItem,
  TableListItem,
  UpdateTableBody,
  VenueLayoutBody,
  VenueLayoutDetail,
} from '~/types/api/seating'

import { z } from 'zod'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// === 資料載入 ===
const { data: tables, refresh: refreshTables } = await useFetch<TableListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/tables`,
  { default: () => [] },
)
const { data: guests } = await useFetch<GuestListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/guests`,
  { default: () => [] },
)
const { data: warnings, refresh: refreshWarnings } = await useFetch<EtiquetteWarningListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/etiquette-warnings`,
  { default: () => [] },
)
// 場地佈局與禮俗設定：由 GET 讀回，重整後 modal 仍能還原既有值
const { data: venueLayout, refresh: refreshVenue } = await useFetch<VenueLayoutDetail | null>(
  () => `/api/v1/weddings/${weddingId.value}/venue-layout`,
  { default: () => null },
)
const { data: etiquetteSettings, refresh: refreshEtiquette } = await useFetch<EtiquetteSettingsDetail>(
  () => `/api/v1/weddings/${weddingId.value}/etiquette-settings`,
)

const activeGuests = computed(() => (guests.value ?? []).filter(g => !g.deletedAt))
const activeWarnings = computed(() => (warnings.value ?? []).filter(w => !w.dismissed))

// 每張桌的座位（key = tableId）
const seatsByTable = ref<Record<string, SeatListItem[]>>({})

async function loadSeats() {
  const result: Record<string, SeatListItem[]> = {}
  for (const table of tables.value ?? []) {
    result[table.tableId] = await $fetch<SeatListItem[]>(
      `/api/v1/weddings/${weddingId.value}/tables/${table.tableId}/seats`,
    )
  }
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

function tableSeats(tableId: string): SeatListItem[] {
  return seatsByTable.value[tableId] ?? []
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
      await $fetch(
        `/api/v1/weddings/${weddingId.value}/tables/${editingTableId.value}`,
        { method: 'PATCH', body },
      )
      toast.add({ title: '桌次已更新', color: 'success' })
    }
    else {
      const body: CreateTableBody = {
        tableName: data.tableName,
        capacity: data.capacity,
        positionX: data.positionX,
        positionY: data.positionY,
      }
      await $fetch(
        `/api/v1/weddings/${weddingId.value}/tables`,
        { method: 'POST', body },
      )
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/tables/${removeTarget.value.tableId}`,
      { method: 'DELETE' },
    )
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

// === 安排座位 ===
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/tables/${seatState.tableId}/seats`,
      { method: 'POST', body },
    )
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/tables/${unseatTarget.value.tableId}/seats/${unseatTarget.value.guestId}`,
      { method: 'DELETE' },
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/venue-layout`,
      { method: 'PUT', body },
    )
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/etiquette-settings`,
      { method: 'PUT', body },
    )
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/etiquette-warnings/${warning.warningId}/dismiss`,
      { method: 'POST', body: { warningType: warning.warningType } },
    )
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
</script>

<template>
  <div data-testid="seating-page" class="flex h-full flex-col">
    <PageHeader title="座位安排" description="管理桌次、場地佈局、座位安排與禮俗設定">
      <template #actions>
        <div class="flex flex-wrap gap-2">
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
            color="primary"
            @click="openCreateTable"
          >
            新增桌次
          </UButton>
        </div>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 space-y-8 overflow-auto">
      <!-- 禮俗警告區 -->
      <section v-if="activeWarnings.length > 0" data-testid="warning-list" class="space-y-3">
        <h2 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          禮俗建議警告
        </h2>
        <div
          v-for="warning in activeWarnings"
          :key="warning.warningId"
          role="alert"
          :data-testid="`warning-row-${warning.warningId}`"
          :aria-label="warning.message"
          class="flex items-start justify-between gap-4 rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-900 dark:bg-warning-950"
        >
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 size-5 shrink-0 text-warning-600" />
            <p class="text-sm text-neutral-700 dark:text-neutral-200">
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

      <!-- 桌次清單（每張桌一張卡，含已入座賓客） -->
      <section class="space-y-4">
        <h2 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          桌次平面
        </h2>

        <div
          v-if="(tables ?? []).length === 0"
          data-testid="table-list-empty"
        >
          <EmptyState
            title="目前沒有桌次"
            description="點擊「新增桌次」開始規劃座位"
          />
        </div>

        <div v-else data-testid="table-list" class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="table in tables"
            :key="table.tableId"
            :data-testid="`table-row-${table.tableId}`"
            :aria-label="table.tableName"
            class="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold text-neutral-900 dark:text-white">
                  {{ table.tableName }}
                </h3>
                <p class="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  座位數 {{ table.capacity }}｜已入座 {{ tableSeats(table.tableId).length }}
                </p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UButton
                  data-testid="table-edit"
                  icon="i-heroicons-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
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
                  size="sm"
                  :aria-label="`移除 ${table.tableName}`"
                  @click="openRemoveTable(table)"
                >
                  移除
                </UButton>
              </div>
            </div>

            <!-- 已入座賓客 -->
            <ul v-if="tableSeats(table.tableId).length > 0" class="mt-3 space-y-1.5">
              <li
                v-for="seat in tableSeats(table.tableId)"
                :key="seat.guestId"
                :data-testid="`${table.tableId}-seat-${seat.seatNumber}`"
                class="flex items-center justify-between gap-2 rounded-md bg-neutral-50 px-3 py-1.5 text-sm dark:bg-neutral-800"
              >
                <span class="text-neutral-700 dark:text-neutral-200">
                  座位 {{ seat.seatNumber }}：{{ guestName(seat.guestId) }}
                </span>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`取消座位 ${guestName(seat.guestId)}`"
                  @click="openUnseat(table.tableId, seat.guestId)"
                >
                  取消座位
                </UButton>
              </li>
            </ul>
            <p v-else class="mt-3 text-sm text-neutral-400">
              尚無賓客入座
            </p>
          </article>
        </div>
      </section>
    </div>

    <!-- 新增 / 編輯桌次 Modal -->
    <UModal v-model:open="isTableFormOpen">
      <template #content>
        <div data-testid="table-form-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
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
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
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
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
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
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
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
              v-model="etiquetteState.genderSeparation"
              data-testid="etiquette-gender-separation"
              label="男女分桌"
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
          <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
            確認移除
          </h3>
          <p class="mt-2 text-neutral-500 dark:text-neutral-400">
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
  </div>
</template>
