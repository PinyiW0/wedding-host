<!-- app/pages/register.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AdminRegisteredEvent, RegisterAdminBody } from '~/types/api/auth'

import { z } from 'zod'

definePageMeta({ layout: 'auth' })

const toast = useToast()
const router = useRouter()

const schema = z.object({
  email: z.string().trim().min(1, '請輸入電子郵件').email('電子郵件格式不正確'),
  displayName: z.string().trim().min(1, '請輸入顯示名稱'),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  email: '',
  displayName: '',
})

const isSubmitting = ref(false)
// 後端錯誤訊息（如 email 已被註冊），inline 顯示供使用者感知失敗原因
const errorMessage = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return // 防止重複提交
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    const body: RegisterAdminBody = {
      email: event.data.email,
      displayName: event.data.displayName,
    }
    await $fetch<AdminRegisteredEvent>('/api/v1/admins', {
      method: 'POST',
      body,
    })
    toast.add({
      title: '註冊成功',
      description: '管理員帳號已建立',
      color: 'success',
    })
    router.push('/login')
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '註冊失敗，請稍後再試'
    // 失敗原因僅以頁面內 inline alert 呈現（避免與 toast 重複顯示同一訊息）
    errorMessage.value = message
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="register-page">
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
          建立管理員帳號
        </h2>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          填寫電子郵件與顯示名稱即可註冊
        </p>
      </template>

      <UForm
        :schema="schema"
        :state="state"
        data-testid="register-form"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          icon="i-heroicons-exclamation-circle"
          :title="errorMessage"
        />

        <UFormField
          label="電子郵件"
          name="email"
          class="relative mb-6"
          :ui="{ error: 'absolute top-full left-0 mt-1' }"
        >
          <UInput
            v-model="state.email"
            data-testid="register-email"
            type="email"
            placeholder="admin@example.com"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="顯示名稱"
          name="displayName"
          class="relative mb-6"
          :ui="{ error: 'absolute top-full left-0 mt-1' }"
        >
          <UInput
            v-model="state.displayName"
            data-testid="register-display-name"
            placeholder="王小明"
            class="w-full"
          />
        </UFormField>

        <UButton
          type="submit"
          data-testid="register-submit"
          color="primary"
          block
          :loading="isSubmitting"
        >
          註冊
        </UButton>
      </UForm>

      <template #footer>
        <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
          已有帳號？
          <NuxtLink
            to="/login"
            class="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            前往登入
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
