<!-- app/pages/users.vue：新人帳號管理（管理者限定，issue #23） -->
<!-- 雙層守門：auth.global.ts 導走非管理者、API adminOnly 兜底 403；導覽入口僅管理者可見 -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type { CoupleAccountListItem, CreateCoupleAccountBody } from '~/types/api/users'

import { z } from 'zod'
import {
  createCoupleAccount,
  deleteCoupleAccount,
  listCoupleAccounts,
  listWeddings,
  updateCoupleAccount,
} from '~/api'

definePageMeta({ layout: 'default' })

const toast = useToast()

// 新人帳號列表（含已停用，依 deletedAt 呈現狀態）
const { data: couples, refresh } = await listCoupleAccounts({
  default: () => [],
})
// 婚禮列表：綁定選項 + 綁定婚禮名稱顯示
const { data: weddings } = await listWeddings({
  default: () => [],
})

function weddingTitle(weddingId: string | null) {
  if (!weddingId)
    return null
  return weddings.value?.find(w => w.weddingId === weddingId)?.title ?? weddingId
}

// === 建立新人帳號 ===
// USelectMenu 選項 value 不可空字串（下拉會打不開），未綁定用哨兵值
const NO_WEDDING = '__none__'

const createSchema = z.object({
  username: z.string().trim().min(1, '請輸入帳號名稱'),
  password: z.string().min(1, '請輸入登入密碼'),
  displayName: z.string().trim().min(1, '請輸入顯示名稱'),
  weddingId: z.string(),
})

type CreateSchema = z.output<typeof createSchema>

const isCreateOpen = ref(false)
const isSubmitting = ref(false)
const createErrorMsg = ref('')
const showCreatePassword = ref(false)
const createState = reactive<CreateSchema>({ username: '', password: '', displayName: '', weddingId: NO_WEDDING })

// 可綁定的婚禮：未刪除、且未被其他有效新人帳號綁定（管理員自建的 ownerId 不算占用）
const weddingOptions = computed(() => {
  const options = (weddings.value ?? [])
    .filter(w => !w.deletedAt)
    .filter(w => !couples.value?.some(c => c.userId === w.ownerId && !c.deletedAt))
    .map(w => ({ label: `${w.title}（${w.date}）`, value: w.weddingId }))
  return [{ label: '暫不綁定', value: NO_WEDDING }, ...options]
})

function openCreate() {
  createState.username = ''
  createState.password = ''
  createState.displayName = ''
  createState.weddingId = NO_WEDDING
  showCreatePassword.value = false
  createErrorMsg.value = ''
  isCreateOpen.value = true
}

async function onCreateSubmit(event: FormSubmitEvent<CreateSchema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  createErrorMsg.value = ''
  try {
    const body: CreateCoupleAccountBody = {
      username: event.data.username,
      password: event.data.password,
      displayName: event.data.displayName,
      ...(event.data.weddingId !== NO_WEDDING ? { weddingId: event.data.weddingId } : {}),
    }
    await createCoupleAccount(body)
    toast.add({ title: '新人帳號建立成功', color: 'success' })
    isCreateOpen.value = false
    await refresh()
  }
  catch (error: any) {
    createErrorMsg.value
      = error?.data?.message || error?.statusMessage || '建立失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}

// === 重設密碼（不回顯既有密碼） ===
const isResetOpen = ref(false)
const isResetting = ref(false)
const resetErrorMsg = ref('')
const showResetPassword = ref(false)
const resetTarget = ref<CoupleAccountListItem | null>(null)

const resetSchema = z.object({
  password: z.string().min(1, '請輸入新密碼'),
})

type ResetSchema = z.output<typeof resetSchema>

const resetState = reactive<ResetSchema>({ password: '' })

function openReset(couple: CoupleAccountListItem) {
  resetTarget.value = couple
  resetState.password = ''
  showResetPassword.value = false
  resetErrorMsg.value = ''
  isResetOpen.value = true
}

async function onResetSubmit(event: FormSubmitEvent<ResetSchema>) {
  if (!resetTarget.value || isResetting.value)
    return
  isResetting.value = true
  resetErrorMsg.value = ''
  try {
    await updateCoupleAccount(resetTarget.value.userId, { password: event.data.password })
    toast.add({ title: '密碼已重設', color: 'success' })
    isResetOpen.value = false
  }
  catch (error: any) {
    resetErrorMsg.value
      = error?.data?.message || error?.statusMessage || '重設失敗，請稍後再試'
  }
  finally {
    isResetting.value = false
  }
}

// === 停用（軟刪除，停用後無法登入） ===
const isDisableOpen = ref(false)
const isDisabling = ref(false)
const disableTarget = ref<CoupleAccountListItem | null>(null)

function openDisable(couple: CoupleAccountListItem) {
  disableTarget.value = couple
  isDisableOpen.value = true
}

async function confirmDisable() {
  if (!disableTarget.value || isDisabling.value)
    return
  isDisabling.value = true
  try {
    await deleteCoupleAccount(disableTarget.value.userId)
    toast.add({ title: '帳號已停用', color: 'success' })
    isDisableOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '停用失敗，請稍後再試'
    toast.add({ title: '停用失敗', description: message, color: 'error' })
  }
  finally {
    isDisabling.value = false
  }
}

// 由 username 取首字作頭像（純顯示衍生）
function avatarInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '新'
}
</script>

<template>
  <div data-testid="vibe-couples-page" class="flex h-full flex-col">
    <PageHeader
      title="新人帳號"
      eyebrow="Couple Accounts"
      description="建立新人帳號並綁定婚禮，帳密由管理員私下交付"
    >
      <template #actions>
        <UButton
          data-testid="vibe-couple-create"
          icon="i-heroicons-plus"
          color="neutral"
          variant="solid"
          @click="openCreate"
        >
          建立新人帳號
        </UButton>
      </template>
    </PageHeader>

    <div class="flex min-h-0 flex-1 flex-col overflow-auto">
      <p class="text-overline mb-4 shrink-0 uppercase text-gold-deep">
        新人與婚禮
      </p>

      <div data-testid="vibe-couple-list" class="flex flex-1 flex-col gap-2.5">
        <div
          v-for="couple in couples"
          :key="couple.userId"
          role="article"
          :aria-label="couple.username"
          class="flex items-center gap-4 rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          :class="couple.deletedAt && 'opacity-60'"
        >
          <div class="flex size-10 flex-none items-center justify-center rounded-full bg-gold font-display text-lg text-ink">
            {{ avatarInitial(couple.username) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium text-ink dark:text-paper">
              {{ couple.username }}
            </div>
            <div class="truncate text-caption text-ink-500 dark:text-neutral-400">
              {{ couple.displayName }}
              <template v-if="weddingTitle(couple.weddingId)">
                · {{ weddingTitle(couple.weddingId) }}
              </template>
              <template v-else>
                · 未綁定婚禮
              </template>
            </div>
          </div>
          <StatusBadge :color="couple.deletedAt ? 'neutral' : 'success'">
            {{ couple.deletedAt ? '已停用' : '使用中' }}
          </StatusBadge>
          <template v-if="!couple.deletedAt">
            <UButton
              data-testid="vibe-couple-reset"
              icon="i-heroicons-key"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`重設 ${couple.username} 的密碼`"
              @click="openReset(couple)"
            >
              重設密碼
            </UButton>
            <UButton
              data-testid="vibe-couple-disable"
              icon="i-heroicons-no-symbol"
              color="error"
              variant="ghost"
              size="sm"
              :aria-label="`停用 ${couple.username}`"
              @click="openDisable(couple)"
            >
              停用
            </UButton>
          </template>
        </div>

        <EmptyState
          v-if="(couples?.length ?? 0) === 0"
          bordered
          class="flex-1"
          title="目前沒有新人帳號"
          description="點擊「建立新人帳號」新增第一組帳號"
        />
      </div>
    </div>

    <!-- 建立新人帳號 Modal -->
    <UModal v-model:open="isCreateOpen">
      <template #content>
        <div data-testid="vibe-couple-form-modal" class="p-6">
          <h3 class="mb-4 text-body-l font-semibold text-ink dark:text-paper">
            建立新人帳號
          </h3>

          <UAlert
            v-if="createErrorMsg"
            data-testid="vibe-couple-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="createErrorMsg"
            class="mb-4"
          />

          <UForm
            :schema="createSchema"
            :state="createState"
            class="space-y-4"
            @submit="onCreateSubmit"
          >
            <UFormField
              label="帳號名稱"
              name="username"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="createState.username"
                data-testid="vibe-couple-username"
                placeholder="請輸入帳號名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="登入密碼"
              name="password"
              hint="建立後不回顯，請私下交付新人"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="createState.password"
                data-testid="vibe-couple-password"
                :type="showCreatePassword ? 'text' : 'password'"
                placeholder="請輸入登入密碼"
                autocomplete="new-password"
                class="w-full"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showCreatePassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="showCreatePassword ? '隱藏密碼' : '顯示密碼'"
                    @click="showCreatePassword = !showCreatePassword"
                  />
                </template>
              </UInput>
            </UFormField>

            <UFormField
              label="顯示名稱"
              name="displayName"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="createState.displayName"
                data-testid="vibe-couple-displayname"
                placeholder="請輸入顯示名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="綁定婚禮"
              name="weddingId"
              hint="每場婚禮僅能綁定一組新人帳號"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <USelectMenu
                v-model="createState.weddingId"
                data-testid="vibe-couple-wedding"
                :items="weddingOptions"
                value-key="value"
                :search-input="false"
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
                data-testid="vibe-couple-submit"
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

    <!-- 重設密碼 Modal -->
    <UModal v-model:open="isResetOpen">
      <template #content>
        <div data-testid="vibe-couple-reset-modal" class="p-6">
          <h3 class="mb-4 text-body-l font-semibold text-ink dark:text-paper">
            重設密碼
          </h3>
          <p class="mb-4 text-body text-ink-500 dark:text-neutral-400">
            為「{{ resetTarget?.username ?? '' }}」設定新密碼，設定後請私下交付新人。
          </p>

          <UAlert
            v-if="resetErrorMsg"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="resetErrorMsg"
            class="mb-4"
          />

          <UForm
            :schema="resetSchema"
            :state="resetState"
            class="space-y-4"
            @submit="onResetSubmit"
          >
            <UFormField
              label="新密碼"
              name="password"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="resetState.password"
                data-testid="vibe-couple-new-password"
                :type="showResetPassword ? 'text' : 'password'"
                placeholder="請輸入新密碼"
                autocomplete="new-password"
                class="w-full"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showResetPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="showResetPassword ? '隱藏密碼' : '顯示密碼'"
                    @click="showResetPassword = !showResetPassword"
                  />
                </template>
              </UInput>
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isResetting"
                @click="isResetOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="vibe-couple-reset-submit"
                color="neutral"
                variant="solid"
                :loading="isResetting"
              >
                重設密碼
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 停用確認 -->
    <ConfirmModal
      v-model:open="isDisableOpen"
      title="確認停用"
      :description="`確定要停用「${disableTarget?.username ?? ''}」嗎？停用後此帳號將無法登入。`"
      confirm-label="停用"
      confirm-color="error"
      :loading="isDisabling"
      @confirm="confirmDisable"
    />
  </div>
</template>
