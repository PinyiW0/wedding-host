<!-- app/pages/weddings/[weddingId]/accounts.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateReceptionAccountBody,
  ReceptionAccountListItem,
} from '~/types/api/accounts'

import { z } from 'zod'
import {
  createReceptionAccount,
  deleteReceptionAccount,
  listReceptionAccounts,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 接待帳號列表
const { data: accounts, refresh } = await listReceptionAccounts(weddingId, {
  default: () => [],
})

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
    await createReceptionAccount(weddingId.value, body)
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
    await deleteReceptionAccount(weddingId.value, removeTarget.value.accountId)
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

// 由既有 username 取首字作頭像（純顯示衍生，不影響資料邏輯）
function avatarInitial(name: string) {
  return name.trim().charAt(0) || '接'
}
</script>

<template>
  <div data-testid="accounts-page" class="flex h-full flex-col">
    <PageHeader
      title="接待帳號"
      eyebrow="Accounts & Roles"
      description="管理此婚禮的接待人員共用帳號"
    >
      <template #actions>
        <UButton
          data-testid="account-create"
          icon="i-heroicons-plus"
          color="neutral"
          variant="solid"
          @click="openCreate"
        >
          建立接待帳號
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <!-- 區段金色 overline -->
      <p class="text-overline mb-4 uppercase text-gold-deep">
        角色與帳號
      </p>

      <!-- 帳號列：編輯式卡片（頭像金圓 + 名稱 + 角色 caption + 權限 badge） -->
      <div data-testid="account-list" class="flex flex-col gap-2.5">
        <div
          v-for="account in accounts"
          :key="account.accountId"
          role="article"
          :aria-label="account.username"
          class="flex items-center gap-4 rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <!-- 金色頭像圓 -->
          <div class="flex size-10 flex-none items-center justify-center rounded-full bg-gold font-display text-lg text-ink">
            {{ avatarInitial(account.username) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium text-ink dark:text-paper">
              {{ account.username }}
            </div>
            <div class="text-caption text-ink-500 dark:text-neutral-400">
              現場接待 · 共用帳號
            </div>
          </div>
          <!-- 權限 badge -->
          <UBadge color="primary" variant="outline" size="sm">
            受限
          </UBadge>
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
        </div>

        <EmptyState
          v-if="(accounts?.length ?? 0) === 0"
          title="目前沒有接待帳號"
          description="點擊「建立接待帳號」新增第一個帳號"
        />
      </div>
    </div>

    <!-- 建立接待帳號 Modal -->
    <UModal v-model:open="isCreateOpen">
      <template #content>
        <div data-testid="account-form-modal" class="p-6">
          <h3 class="mb-4 font-display text-h2 font-semibold text-ink dark:text-paper">
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
                color="neutral"
                variant="solid"
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
