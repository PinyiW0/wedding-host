<!-- app/pages/login.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import { z } from 'zod'

import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'auth' })

const toast = useToast()
const router = useRouter()
const authStore = useAuthStore()

const schema = z.object({
  account: z.string().trim().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  account: '',
  password: '',
})

const showPassword = ref(false)
const isSubmitting = ref(false)
// 後端錯誤訊息（如帳號或密碼錯誤），inline 顯示供使用者感知失敗原因
const errorMessage = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return // 防止重複提交
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    // 登入用 store 方法（狀態自動 persist）
    await authStore.login(event.data.account, event.data.password)
    toast.add({
      title: '登入成功',
      description: '歡迎回來',
      color: 'success',
    })
    router.push('/weddings')
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '登入失敗，請稍後再試'
    errorMessage.value = message
    toast.add({ title: '登入失敗', description: message, color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="login-page">
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
          登入帳號
        </h2>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          輸入帳號與密碼進入後台
        </p>
      </template>

      <UForm
        :schema="schema"
        :state="state"
        data-testid="login-form"
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
          label="帳號"
          name="account"
          class="relative mb-6"
          :ui="{ error: 'absolute top-full left-0 mt-1' }"
        >
          <UInput
            v-model="state.account"
            data-testid="login-account"
            placeholder="請輸入帳號"
            autocomplete="username"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="密碼"
          name="password"
          class="relative mb-6"
          :ui="{ error: 'absolute top-full left-0 mt-1' }"
        >
          <UInput
            v-model="state.password"
            data-testid="login-password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="請輸入密碼"
            autocomplete="current-password"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="
                  showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'
                "
                :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'"
                tabindex="-1"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <UButton
          type="submit"
          data-testid="login-submit"
          color="primary"
          block
          :loading="isSubmitting"
        >
          登入
        </UButton>
      </UForm>

      <template #footer>
        <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
          還沒有帳號？
          <NuxtLink
            to="/register"
            class="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            前往註冊
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
