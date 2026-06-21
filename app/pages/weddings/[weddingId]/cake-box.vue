<!-- app/pages/weddings/[weddingId]/cake-box.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CakeBoxAssignmentConfiguredEvent,
  CakeBoxAssignmentListItem,
  CakeBoxTypeCreatedEvent,
  CakeBoxTypeListItem,
  CakeBoxTypeUpdatedEvent,
  ConfigureCakeBoxAssignmentBody,
  CreateCakeBoxTypeBody,
  UpdateCakeBoxTypeBody,
} from '~/types/api/cakebox'
import type { GuestListItem } from '~/types/api/guests'

import { z } from 'zod'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 喜餅款式清單
const { data: cakeBoxTypes, refresh } = await useFetch<CakeBoxTypeListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/cake-box-types`,
  { default: () => [] },
)

// 賓客清單（供指派規則選擇對象賓客）
const { data: guests } = await useFetch<GuestListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/guests`,
  { default: () => [] },
)

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

function guestName(guestId: string): string {
  return (guests.value ?? []).find(g => g.guestId === guestId)?.name ?? guestId
}

// 已設定指派規則清單（由 GET 讀回，重整仍能還原顯示）
const { data: assignments, refresh: refreshAssignments } = await useFetch<CakeBoxAssignmentListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/cake-box-types/assignments`,
  { default: () => [] },
)

const assignmentList = computed(() =>
  (assignments.value ?? []).map(a => ({
    key: `${a.cakeBoxTypeId}-${a.guestId}`,
    cakeBoxTypeName: a.cakeBoxTypeName,
    guestName: guestName(a.guestId),
    assignmentRule: a.assignmentRule,
  })),
)

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

function resetState() {
  state.name = ''
  state.description = ''
  state.isDefault = false
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
      const body: UpdateCakeBoxTypeBody = {
        name: data.name,
        description: data.description,
      }
      await $fetch<CakeBoxTypeUpdatedEvent>(
        `/api/v1/weddings/${weddingId.value}/cake-box-types/${editingId.value}`,
        { method: 'PATCH', body },
      )
      toast.add({ title: '喜餅款式已更新', color: 'success' })
    }
    else {
      const body: CreateCakeBoxTypeBody = {
        name: data.name,
        description: data.description || undefined,
        isDefault: data.isDefault,
      }
      await $fetch<CakeBoxTypeCreatedEvent>(
        `/api/v1/weddings/${weddingId.value}/cake-box-types`,
        { method: 'POST', body },
      )
      toast.add({ title: '喜餅款式新增成功', color: 'success' })
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
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/cake-box-types/${removeTarget.value.cakeBoxTypeId}`,
      { method: 'DELETE' },
    )
    toast.add({ title: '喜餅款式已移除', color: 'success' })
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
    await $fetch<CakeBoxAssignmentConfiguredEvent>(
      `/api/v1/weddings/${weddingId.value}/cake-box-types/${assignState.cakeBoxTypeId}/assignment`,
      { method: 'POST', body },
    )
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
</script>

<template>
  <div data-testid="cake-box-page" class="flex h-full flex-col">
    <PageHeader title="喜餅款式" description="管理喜餅款式與賓客指派規則">
      <template #actions>
        <div class="flex gap-2">
          <UButton
            data-testid="cake-box-assign"
            icon="i-heroicons-adjustments-horizontal"
            color="neutral"
            variant="outline"
            @click="openAssign"
          >
            設定指派規則
          </UButton>
          <UButton
            data-testid="cake-box-create"
            icon="i-heroicons-plus"
            color="primary"
            @click="openCreate"
          >
            新增喜餅款式
          </UButton>
        </div>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 space-y-6 overflow-auto">
      <table
        data-testid="cake-box-list"
        class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        <thead class="bg-neutral-50 dark:bg-neutral-900">
          <tr class="text-left text-sm text-neutral-500 dark:text-neutral-400">
            <th class="px-4 py-3 font-medium">
              名稱
            </th>
            <th class="hidden px-4 py-3 font-medium md:table-cell">
              說明
            </th>
            <th class="px-4 py-3 font-medium">
              預設
            </th>
            <th class="px-4 py-3 text-right font-medium">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="type in cakeBoxTypes"
            :key="type.cakeBoxTypeId"
            :data-testid="`cake-box-row-${type.cakeBoxTypeId}`"
            :aria-label="type.name"
            class="border-t border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <td class="px-4 py-3">
              <span class="font-medium text-neutral-900 dark:text-white">
                {{ type.name }}
              </span>
            </td>
            <td class="hidden px-4 py-3 text-neutral-600 md:table-cell dark:text-neutral-300">
              {{ type.description ?? '—' }}
            </td>
            <td class="px-4 py-3">
              <UBadge
                v-if="type.isDefault"
                color="primary"
                variant="soft"
                size="sm"
              >
                預設
              </UBadge>
              <span v-else class="text-neutral-400">—</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-1">
                <UButton
                  data-testid="cake-box-edit"
                  icon="i-heroicons-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :aria-label="`編輯 ${type.name}`"
                  @click="openEdit(type)"
                >
                  編輯
                </UButton>
                <UButton
                  data-testid="cake-box-remove"
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="sm"
                  :aria-label="`移除 ${type.name}`"
                  @click="openRemove(type)"
                >
                  移除
                </UButton>
              </div>
            </td>
          </tr>
          <tr v-if="(cakeBoxTypes ?? []).length === 0">
            <td colspan="4">
              <EmptyState
                title="目前沒有喜餅款式"
                description="點擊「新增喜餅款式」建立第一個款式"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 已設定指派規則（由 GET 讀回，重整仍能還原顯示） -->
      <section
        data-testid="cake-box-assignment-list"
        class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <h2 class="mb-3 font-semibold text-neutral-900 dark:text-white">
          已設定指派規則
        </h2>

        <div v-if="assignmentList.length === 0">
          <EmptyState
            title="尚未設定指派規則"
            description="點擊「設定指派規則」為賓客指派喜餅款式"
          />
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="a in assignmentList"
            :key="a.key"
            :aria-label="a.guestName"
            class="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <p class="font-medium text-neutral-900 dark:text-white">
              {{ a.guestName }} → {{ a.cakeBoxTypeName }}
            </p>
            <p
              v-if="a.assignmentRule"
              class="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
            >
              {{ a.assignmentRule }}
            </p>
          </li>
        </ul>
      </section>
    </div>

    <!-- 新增 / 編輯喜餅款式 Modal -->
    <UModal v-model:open="isFormOpen">
      <template #content>
        <div data-testid="cake-box-form-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
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

            <UFormField v-if="!editingId" name="isDefault">
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

    <!-- 設定指派規則 Modal -->
    <UModal v-model:open="isAssignOpen">
      <template #content>
        <div data-testid="cake-box-assign-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            設定喜餅指派規則
          </h3>

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
            <UFormField label="指派規則" name="assignmentRule">
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
                color="primary"
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
  </div>
</template>
