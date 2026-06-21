<!-- app/pages/weddings/[weddingId]/guests.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateGuestBody,
  GuestCreatedEvent,
  GuestDiet,
  GuestListItem,
  GuestSide,
  GuestUpdatedEvent,
  ImportGuestsBody,
  UpdateGuestBody,
} from '~/types/api/guests'

import { z } from 'zod'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 賓客名單（含已移除，UI 以 deletedAt 分區呈現）
const { data: guests, refresh } = await useFetch<GuestListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/guests`,
  {
    default: () => [],
  },
)

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)
const deletedGuests = computed(() =>
  (guests.value ?? []).filter(g => g.deletedAt),
)

// 顯示文字對照
const sideLabel = (side: GuestSide) => (side === 'groom' ? '男方' : '女方')
const dietLabel = (diet: GuestDiet) => (diet === 'meat' ? '葷食' : '素食')

// === 新增 / 編輯賓客表單 ===
const schema = z.object({
  name: z.string().trim().min(1, '請輸入賓客姓名'),
  side: z.enum(['groom', 'bride']),
  diet: z.enum(['meat', 'vegetarian']),
  category: z.string().trim().min(1, '請輸入分類'),
  contact: z.string().trim(),
  needChildSeat: z.boolean(),
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
  needChildSeat: false,
  notes: '',
})

function resetState() {
  state.name = ''
  state.side = 'groom'
  state.diet = 'meat'
  state.category = ''
  state.contact = ''
  state.needChildSeat = false
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
  state.needChildSeat = guest.needChildSeat
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
        needChildSeat: data.needChildSeat,
        notes: data.notes,
      }
      await $fetch<GuestUpdatedEvent>(
        `/api/v1/weddings/${weddingId.value}/guests/${editingId.value}`,
        { method: 'PATCH', body },
      )
      toast.add({ title: '賓客已更新', color: 'success' })
    }
    else {
      const body: CreateGuestBody = {
        name: data.name,
        side: data.side,
        diet: data.diet,
        category: data.category,
        contact: data.contact,
        needChildSeat: data.needChildSeat,
        notes: data.notes || undefined,
      }
      await $fetch<GuestCreatedEvent>(
        `/api/v1/weddings/${weddingId.value}/guests`,
        { method: 'POST', body },
      )
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/guests/${removeTarget.value.guestId}`,
      { method: 'DELETE' },
    )
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/guests/${restoreTarget.value.guestId}/restore`,
      { method: 'POST' },
    )
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
    const result = await $fetch(
      `/api/v1/weddings/${weddingId.value}/guests/import`,
      { method: 'POST', body },
    )
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
    <PageHeader title="賓客名單" description="管理此婚禮的賓客資料與批次匯入">
      <template #actions>
        <div class="flex gap-2">
          <UButton
            data-testid="guest-import"
            icon="i-heroicons-arrow-up-tray"
            color="neutral"
            variant="outline"
            @click="openImport"
          >
            批次匯入
          </UButton>
          <UButton
            data-testid="guest-create"
            icon="i-heroicons-plus"
            color="primary"
            @click="openCreate"
          >
            新增賓客
          </UButton>
        </div>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 space-y-8 overflow-auto">
      <!-- 賓客名單（未移除） -->
      <table
        data-testid="guest-list"
        class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        <thead class="bg-neutral-50 dark:bg-neutral-900">
          <tr class="text-left text-sm text-neutral-500 dark:text-neutral-400">
            <th class="px-4 py-3 font-medium">
              姓名
            </th>
            <th class="hidden px-4 py-3 font-medium sm:table-cell">
              男女方
            </th>
            <th class="hidden px-4 py-3 font-medium sm:table-cell">
              飲食
            </th>
            <th class="hidden px-4 py-3 font-medium md:table-cell">
              分類
            </th>
            <th class="px-4 py-3 text-right font-medium">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="guest in activeGuests"
            :key="guest.guestId"
            :data-testid="`guest-row-${guest.guestId}`"
            class="border-t border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <td class="px-4 py-3">
              <span class="font-medium text-neutral-900 dark:text-white">
                {{ guest.name }}
              </span>
            </td>
            <td class="hidden px-4 py-3 text-neutral-600 sm:table-cell dark:text-neutral-300">
              {{ sideLabel(guest.side) }}
            </td>
            <td class="hidden px-4 py-3 text-neutral-600 sm:table-cell dark:text-neutral-300">
              {{ dietLabel(guest.diet) }}
            </td>
            <td class="hidden px-4 py-3 text-neutral-600 md:table-cell dark:text-neutral-300">
              {{ guest.category }}
            </td>
            <td class="px-4 py-3 text-right">
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
          <tr v-if="activeGuests.length === 0">
            <td colspan="5">
              <EmptyState
                title="目前沒有賓客"
                description="點擊「新增賓客」或「批次匯入」建立賓客名單"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 回收區（已移除） -->
      <div v-if="deletedGuests.length > 0">
        <h2 class="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          已移除的賓客
        </h2>
        <table
          data-testid="guest-deleted-list"
          class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
        >
          <tbody>
            <tr
              v-for="guest in deletedGuests"
              :key="guest.guestId"
              :data-testid="`guest-row-${guest.guestId}`"
              class="border-t border-neutral-200 dark:border-neutral-800"
            >
              <td class="px-4 py-3">
                <span class="font-medium text-neutral-500 line-through dark:text-neutral-400">
                  {{ guest.name }}
                </span>
              </td>
              <td class="hidden px-4 py-3 text-neutral-400 sm:table-cell">
                {{ sideLabel(guest.side) }}
              </td>
              <td class="px-4 py-3 text-right">
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
    </div>

    <!-- 新增 / 編輯賓客 Modal -->
    <UModal v-model:open="isFormOpen">
      <template #content>
        <div data-testid="guest-form-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            {{ editingId ? '編輯賓客' : '新增賓客' }}
          </h3>

          <UAlert
            v-if="formError"
            data-testid="guest-error"
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

            <UFormField label="聯絡方式" name="contact">
              <UInput
                v-model="state.contact"
                data-testid="guest-contact"
                placeholder="請輸入聯絡電話"
                class="w-full"
              />
            </UFormField>

            <UFormField name="needChildSeat">
              <UCheckbox
                v-model="state.needChildSeat"
                data-testid="guest-child-seat"
                label="需要兒童座椅"
              />
            </UFormField>

            <UFormField label="備註" name="notes">
              <UTextarea
                v-model="state.notes"
                data-testid="guest-notes"
                placeholder="其他備註資訊"
                class="w-full"
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
                data-testid="guest-submit"
                color="primary"
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
        <div data-testid="guest-import-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
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
              color="primary"
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
