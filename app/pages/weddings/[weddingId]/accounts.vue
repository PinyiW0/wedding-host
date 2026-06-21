<!-- app/pages/weddings/[weddingId]/accounts.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateReceptionAccountBody,
  ReceptionAccountCreatedEvent,
  ReceptionAccountListItem,
} from '~/types/api/accounts'

import { z } from 'zod'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 接待帳號列表
const { data: accounts, refresh } = await useFetch<ReceptionAccountListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/reception-accounts`,
  {
    default: () => [],
  },
)

// === 建立接待帳號 ===
const schema = z.object({
  username: z.string().trim().min(1, '請輸入帳號名稱'),
})

type Schema = z.output<typeof schema>

const isCreateOpen = ref(false)
const isSubmitting = ref(false)
const createError = ref('')
const state = reactive<Schema>({ username: '' })

function openCreate() {
  state.username = ''
  createError.value = ''
  isCreateOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  createError.value = ''
  try {
    const body: CreateReceptionAccountBody = {
      username: event.data.username,
    }
    await $fetch<ReceptionAccountCreatedEvent>(
      `/api/v1/weddings/${weddingId.value}/reception-accounts`,
      { method: 'POST', body },
    )
    toast.add({ title: '接待帳號建立成功', color: 'success' })
    isCreateOpen.value = false
    await refresh()
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複造成測試 strict mode violation）
    createError.value
      = error?.data?.message || error?.statusMessage || '建立失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}

// === 移除接待帳號 ===
const isRemoveOpen = ref(false)
const isRemoving = ref(false)
const removeTarget = ref<ReceptionAccountListItem | null>(null)

function openRemove(account: ReceptionAccountListItem) {
  removeTarget.value = account
  isRemoveOpen.value = true
}

async function confirmRemove() {
  if (!removeTarget.value || isRemoving.value)
    return
  isRemoving.value = true
  try {
    await $fetch(
      `/api/v1/weddings/${weddingId.value}/reception-accounts/${removeTarget.value.accountId}`,
      { method: 'DELETE' },
    )
    toast.add({ title: '接待帳號已移除', color: 'success' })
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
</script>

<template>
  <div data-testid="accounts-page" class="flex h-full flex-col">
    <PageHeader title="接待帳號" description="管理此婚禮的接待人員共用帳號">
      <template #actions>
        <UButton
          data-testid="account-create"
          icon="i-heroicons-plus"
          color="primary"
          @click="openCreate"
        >
          建立接待帳號
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <table
        data-testid="account-list"
        class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        <thead class="bg-neutral-50 dark:bg-neutral-900">
          <tr class="text-left text-sm text-neutral-500 dark:text-neutral-400">
            <th class="px-4 py-3 font-medium">
              帳號名稱
            </th>
            <th class="px-4 py-3 text-right font-medium">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="account in accounts"
            :key="account.accountId"
            class="border-t border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <td class="px-4 py-3">
              <span class="font-medium text-neutral-900 dark:text-white">
                {{ account.username }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <UButton
                data-testid="account-remove"
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="sm"
                :aria-label="`移除 ${account.username}`"
                @click="openRemove(account)"
              >
                移除
              </UButton>
            </td>
          </tr>
          <tr v-if="accounts.length === 0">
            <td colspan="2">
              <EmptyState
                title="目前沒有接待帳號"
                description="點擊「建立接待帳號」新增第一個帳號"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 建立接待帳號 Modal -->
    <UModal v-model:open="isCreateOpen">
      <template #content>
        <div data-testid="account-form-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            建立接待帳號
          </h3>

          <UAlert
            v-if="createError"
            data-testid="account-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="createError"
            class="mb-4"
          />

          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField
              label="帳號名稱"
              name="username"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.username"
                data-testid="account-username"
                placeholder="請輸入帳號名稱"
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
                data-testid="account-submit"
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

    <!-- 移除確認 -->
    <ConfirmModal
      v-model:open="isRemoveOpen"
      title="確認移除"
      :description="`確定要移除接待帳號「${removeTarget?.username ?? ''}」嗎？`"
      confirm-label="移除"
      confirm-color="error"
      :loading="isRemoving"
      @confirm="confirmRemove"
    />
  </div>
</template>
