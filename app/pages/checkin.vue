<!-- app/pages/checkin.vue -->
<script setup lang="ts">
import type { SelfCheckInBody } from '~/types/api/reception'
import { selfCheckInGuest } from '~/api'

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
    const res = await selfCheckInGuest(weddingId.value, guestId.value, body)
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
    <!-- 報到成功：深色 editorial 卡片 -->
    <div
      v-if="isCheckedIn"
      data-testid="checkin-success"
      role="status"
      class="rounded-lg bg-ink px-8 py-12 text-center text-cream shadow-lg"
    >
      <span
        data-testid="vibe-checkin-badge"
        class="inline-flex items-center gap-2 rounded-full bg-success px-4 py-1.5 text-overline uppercase text-white"
      >
        <UIcon name="i-heroicons-check-circle" class="size-4" />
        已完成報到
      </span>
      <h1 class="mt-6 font-display text-display-l font-semibold leading-none">
        報到成功
      </h1>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />
      <p class="mt-5 text-body-l text-cream/80">
        歡迎 <span class="font-display text-2xl text-gold-light">{{ checkedInName }}</span>，感謝您的蒞臨。
      </p>
    </div>

    <template v-else>
      <!-- Hero -->
      <div class="py-6 text-center">
        <p class="text-overline uppercase text-gold-deep">
          Check-in · 報到
        </p>
        <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
          自助報到
        </h1>
        <div class="mx-auto mt-4 h-px w-10 bg-gold" />
        <p class="mt-4 text-body-l text-ink-500">
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
        class="mt-2"
      />

      <form class="mt-8 space-y-6" @submit.prevent="selfCheckIn">
        <UFormField label="姓名" name="name">
          <!-- 超大姓名輸入：白底墨黑粗框、金色游標（長輩友善大字） -->
          <div class="flex items-center gap-4 rounded border-2 border-ink bg-white px-6 py-5 shadow">
            <UIcon name="i-heroicons-user" class="size-7 shrink-0 text-gold" />
            <input
              v-model="name"
              data-testid="checkin-name"
              placeholder="請輸入您的姓名"
              aria-label="姓名"
              class="min-w-0 flex-1 bg-transparent font-display text-4xl font-medium text-ink caret-gold outline-none placeholder:text-ink-300"
            >
          </div>
        </UFormField>

        <UButton
          type="submit"
          data-testid="checkin-submit"
          color="neutral"
          variant="solid"
          size="xl"
          block
          :loading="isSubmitting"
          class="py-5 text-2xl"
        >
          確認報到
        </UButton>
      </form>
    </template>
  </div>
</template>
