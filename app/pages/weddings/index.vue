<!-- app/pages/weddings/index.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateWeddingBody,
  WeddingCreatedEvent,
  WeddingListItem,
  WeddingRestoredEvent,
} from '~/types/api/weddings'

import { z } from 'zod'

definePageMeta({ layout: 'default' })

const toast = useToast()

// 婚禮列表（含已軟刪除，UI 以 deletedAt 分區呈現）
const { data: weddings, refresh } = await useFetch<WeddingListItem[]>(
  '/api/v1/weddings',
  {
    default: () => [],
  },
)

// 搜尋：依名稱 / 場地過濾
const search = ref('')

const activeWeddings = computed(() =>
  (weddings.value ?? [])
    .filter(w => !w.deletedAt)
    .filter(w => matchSearch(w)),
)

const deletedWeddings = computed(() =>
  (weddings.value ?? [])
    .filter(w => w.deletedAt)
    .filter(w => matchSearch(w)),
)

function matchSearch(w: WeddingListItem) {
  const keyword = search.value.trim()
  if (!keyword)
    return true
  return w.title.includes(keyword) || w.venue.includes(keyword)
}

// === 建立婚禮 ===
const schema = z.object({
  title: z.string().trim().min(1, '請輸入婚禮名稱'),
  venue: z.string().trim().min(1, '請輸入場地'),
  address: z.string().trim().min(1, '請輸入地址'),
  date: z.string().trim().min(1, '請選擇日期'),
})

type Schema = z.output<typeof schema>

const isCreateOpen = ref(false)
const isSubmitting = ref(false)
const state = reactive<Schema>({ title: '', venue: '', address: '', date: '' })

function openCreate() {
  state.title = ''
  state.venue = ''
  state.address = ''
  state.date = ''
  isCreateOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  try {
    const body: CreateWeddingBody = {
      title: event.data.title,
      venue: event.data.venue,
      address: event.data.address,
      date: event.data.date,
    }
    await $fetch<WeddingCreatedEvent>('/api/v1/weddings', {
      method: 'POST',
      body,
    })
    toast.add({ title: '婚禮建立成功', color: 'success' })
    isCreateOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '建立失敗，請稍後再試'
    toast.add({ title: '建立失敗', description: message, color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}

// === 軟刪除婚禮 ===
const isDeleteOpen = ref(false)
const isDeleting = ref(false)
const deleteTarget = ref<WeddingListItem | null>(null)

function openDelete(wedding: WeddingListItem) {
  deleteTarget.value = wedding
  isDeleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value || isDeleting.value)
    return
  isDeleting.value = true
  try {
    await $fetch(`/api/v1/weddings/${deleteTarget.value.weddingId}`, {
      method: 'DELETE',
    })
    toast.add({ title: '婚禮已刪除', color: 'success' })
    isDeleteOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '刪除失敗，請稍後再試'
    toast.add({ title: '刪除失敗', description: message, color: 'error' })
  }
  finally {
    isDeleting.value = false
  }
}

// === 恢復婚禮 ===
const isRestoreOpen = ref(false)
const isRestoring = ref(false)
const restoreTarget = ref<WeddingListItem | null>(null)

function openRestore(wedding: WeddingListItem) {
  restoreTarget.value = wedding
  isRestoreOpen.value = true
}

async function confirmRestore() {
  if (!restoreTarget.value || isRestoring.value)
    return
  isRestoring.value = true
  try {
    await $fetch<WeddingRestoredEvent>(
      `/api/v1/weddings/${restoreTarget.value.weddingId}/restore`,
      { method: 'POST' },
    )
    toast.add({ title: '婚禮已恢復', color: 'success' })
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
</script>

<template>
  <div data-testid="weddings-page" class="flex h-full flex-col">
    <PageHeader title="婚禮" description="管理所有婚禮場次">
      <template #actions>
        <UButton
          data-testid="wedding-create"
          icon="i-heroicons-plus"
          color="primary"
          @click="openCreate"
        >
          建立婚禮
        </UButton>
      </template>
    </PageHeader>

    <!-- 搜尋框 -->
    <div class="mb-4 flex shrink-0 justify-end">
      <UInput
        v-model="search"
        data-testid="wedding-search"
        icon="i-heroicons-magnifying-glass"
        placeholder="搜尋婚禮名稱或場地..."
        class="w-full sm:w-64"
      />
    </div>

    <div class="min-h-0 flex-1 space-y-8 overflow-auto">
      <!-- 婚禮列表（未刪除） -->
      <div>
        <table
          data-testid="wedding-list"
          class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
        >
          <thead class="bg-neutral-50 dark:bg-neutral-900">
            <tr
              class="text-left text-sm text-neutral-500 dark:text-neutral-400"
            >
              <th class="px-4 py-3 font-medium">
                婚禮名稱
              </th>
              <th class="hidden px-4 py-3 font-medium sm:table-cell">
                場地
              </th>
              <th class="hidden px-4 py-3 font-medium md:table-cell">
                日期
              </th>
              <th class="px-4 py-3 text-right font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="wedding in activeWeddings"
              :key="wedding.weddingId"
              class="border-t border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <td class="px-4 py-3">
                <NuxtLink
                  :to="`/weddings/${wedding.weddingId}`"
                  class="font-medium text-neutral-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                >
                  {{ wedding.title }}
                </NuxtLink>
              </td>
              <td
                class="hidden px-4 py-3 text-neutral-600 sm:table-cell dark:text-neutral-300"
              >
                {{ wedding.venue }}
              </td>
              <td
                class="hidden px-4 py-3 text-neutral-600 md:table-cell dark:text-neutral-300"
              >
                {{ wedding.date }}
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  data-testid="wedding-delete"
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="sm"
                  :aria-label="`刪除 ${wedding.title}`"
                  @click="openDelete(wedding)"
                >
                  刪除
                </UButton>
              </td>
            </tr>
            <tr v-if="activeWeddings.length === 0">
              <td colspan="4">
                <EmptyState
                  title="目前沒有婚禮"
                  description="點擊「建立婚禮」新增第一場婚禮"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 回收區（已軟刪除） -->
      <div v-if="deletedWeddings.length > 0">
        <h2
          class="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400"
        >
          已刪除的婚禮
        </h2>
        <table
          data-testid="wedding-deleted-list"
          class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
        >
          <tbody>
            <tr
              v-for="wedding in deletedWeddings"
              :key="wedding.weddingId"
              class="border-t border-neutral-200 dark:border-neutral-800"
            >
              <td class="px-4 py-3">
                <span
                  class="font-medium text-neutral-500 line-through dark:text-neutral-400"
                >
                  {{ wedding.title }}
                </span>
              </td>
              <td class="hidden px-4 py-3 text-neutral-400 sm:table-cell">
                {{ wedding.venue }}
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  data-testid="wedding-restore"
                  icon="i-heroicons-arrow-uturn-left"
                  color="primary"
                  variant="ghost"
                  size="sm"
                  :aria-label="`恢復 ${wedding.title}`"
                  @click="openRestore(wedding)"
                >
                  恢復
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 建立婚禮 Modal -->
    <UModal v-model:open="isCreateOpen">
      <template #content>
        <div data-testid="wedding-form-modal" class="p-6">
          <h3
            class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white"
          >
            建立婚禮
          </h3>
          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField
              label="婚禮名稱"
              name="title"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.title"
                data-testid="wedding-title"
                placeholder="請輸入婚禮名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="場地"
              name="venue"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.venue"
                data-testid="wedding-venue"
                placeholder="請輸入場地名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="地址"
              name="address"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.address"
                data-testid="wedding-address"
                placeholder="請輸入地址"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="日期"
              name="date"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.date"
                data-testid="wedding-date"
                type="date"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
                @click="isCreateOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="wedding-submit"
                color="primary"
                :loading="isSubmitting"
              >
                建立
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 刪除確認 -->
    <ConfirmModal
      v-model:open="isDeleteOpen"
      title="確認刪除"
      :description="`確定要刪除「${deleteTarget?.title ?? ''}」嗎？刪除後可從回收區恢復。`"
      confirm-label="刪除"
      confirm-color="error"
      :loading="isDeleting"
      @confirm="confirmDelete"
    />

    <!-- 恢復確認 -->
    <ConfirmModal
      v-model:open="isRestoreOpen"
      title="確認恢復"
      :description="`確定要恢復「${restoreTarget?.title ?? ''}」嗎？`"
      confirm-label="恢復"
      confirm-color="primary"
      :loading="isRestoring"
      @confirm="confirmRestore"
    />
  </div>
</template>
