<!-- app/pages/checkin.vue -->
<script setup lang="ts">
import type {
  GuestSelfCheckedInEvent,
  SelfCheckInBody,
} from '~/types/api/reception'

definePageMeta({ layout: 'guest' })

const route = useRoute()
// 賓客掃共用 QRCode 進入，連結帶 guestId / weddingId
const guestId = computed(() => String(route.query.guestId ?? ''))
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

const name = ref('')
const isSubmitting = ref(false)
const isCheckedIn = ref(false)
const checkedInName = ref('')
const submitError = ref('')

async function selfCheckIn() {
  if (isSubmitting.value || isCheckedIn.value)
    return
  if (!name.value.trim()) {
    submitError.value = '請輸入姓名'
    return
  }
  isSubmitting.value = true
  submitError.value = ''
  try {
    const body: SelfCheckInBody = { name: name.value.trim() }
    const res = await $fetch<GuestSelfCheckedInEvent>(
      `/api/v1/weddings/${weddingId.value}/guests/${guestId.value}/self-check-in`,
      { method: 'POST', body },
    )
    checkedInName.value = res?.name ?? name.value.trim()
    isCheckedIn.value = true
  }
  catch (error: any) {
    submitError.value
      = error?.data?.message || error?.statusMessage || '報到失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="checkin-page" class="flex flex-col">
    <div class="text-center">
      <UIcon name="i-heroicons-qr-code" class="size-12 text-primary-500" />
      <h1 class="mt-4 text-xl font-bold text-neutral-900">
        自助報到
      </h1>
      <p class="mt-2 text-neutral-500">
        請輸入您的姓名完成報到
      </p>
    </div>

    <UAlert
      v-if="submitError"
      data-testid="checkin-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="submitError"
      class="mt-6"
    />

    <!-- 報到成功反饋 -->
    <UAlert
      v-if="isCheckedIn"
      data-testid="checkin-success"
      icon="i-heroicons-check-circle"
      color="success"
      variant="soft"
      title="報到成功"
      :description="`歡迎 ${checkedInName}，感謝您的蒞臨。`"
      class="mt-6"
    />

    <form v-else class="mt-6 space-y-6" @submit.prevent="selfCheckIn">
      <UFormField label="姓名" name="name">
        <UInput
          v-model="name"
          data-testid="checkin-name"
          placeholder="請輸入您的姓名"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        data-testid="checkin-submit"
        color="primary"
        size="lg"
        block
        :loading="isSubmitting"
      >
        確認報到
      </UButton>
    </form>
  </div>
</template>
