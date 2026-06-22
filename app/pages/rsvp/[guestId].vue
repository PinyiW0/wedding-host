<!-- app/pages/rsvp/[guestId].vue -->
<script setup lang="ts">
import type {
  AttendingStatus,
  SubmitRsvpBody,
} from '~/types/api/rsvp'
import { submitRsvp as submitRsvpApi } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const guestId = computed(() => String(route.params.guestId))
// weddingId 由專屬連結帶入（query），對應提交端點所需
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

const attending = ref<AttendingStatus>('attending')
const diet = ref<'meat' | 'vegetarian'>('meat')
const plusOneCount = ref(0)
const needChildSeat = ref(false)

const isSubmitting = ref(false)
const isSubmitted = ref(false)
const submitError = ref('')

async function submitRsvp() {
  if (isSubmitting.value || isSubmitted.value)
    return
  isSubmitting.value = true
  submitError.value = ''
  try {
    const body: SubmitRsvpBody = {
      attending: attending.value,
      diet: diet.value,
      plusOneCount: Number(plusOneCount.value) || 0,
      needChildSeat: needChildSeat.value,
    }
    await submitRsvpApi(weddingId.value, guestId.value, body)
    isSubmitted.value = true
  }
  catch (error: any) {
    submitError.value
      = error?.data?.message || error?.statusMessage || '提交失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="rsvp-submit-page" class="flex flex-col">
    <!-- Hero -->
    <div data-testid="vibe-rsvp-hero" class="py-6 text-center">
      <p class="text-overline uppercase text-gold-deep">
        RSVP · 敬請回覆
      </p>
      <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
        出席回覆
      </h1>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />
      <p class="mt-4 text-body-l text-ink-500">
        請填寫您的出席資訊，協助我們做好準備
      </p>
    </div>

    <UAlert
      v-if="submitError"
      data-testid="rsvp-submit-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="submitError"
      class="mt-2"
    />

    <!-- 提交成功反饋 -->
    <UAlert
      v-if="isSubmitted"
      data-testid="rsvp-submit-success"
      icon="i-heroicons-check-circle"
      color="success"
      variant="soft"
      title="回覆已送出"
      description="感謝您的回覆，我們已收到您的出席資訊。"
      class="mt-2"
    />

    <form v-else class="mt-6 space-y-7" @submit.prevent="submitRsvp">
      <!-- 出席狀態 -->
      <div data-testid="vibe-rsvp-attend-toggle">
        <p class="mb-3 text-overline uppercase text-gold-deep">
          是否出席
        </p>
        <div class="grid grid-cols-2 gap-3">
          <UButton
            color="neutral"
            :variant="attending === 'attending' ? 'solid' : 'outline'"
            size="xl"
            block
            @click="attending = 'attending'"
          >
            出席
          </UButton>
          <UButton
            color="neutral"
            :variant="attending === 'declined' ? 'solid' : 'outline'"
            size="xl"
            block
            @click="attending = 'declined'"
          >
            不出席
          </UButton>
        </div>
      </div>

      <!-- 飲食 -->
      <div data-testid="vibe-rsvp-diet-segment">
        <p class="mb-3 text-overline uppercase text-gold-deep">
          餐點選擇
        </p>
        <div class="grid grid-cols-2 gap-3">
          <UButton
            color="neutral"
            :variant="diet === 'meat' ? 'solid' : 'outline'"
            size="xl"
            block
            @click="diet = 'meat'"
          >
            葷食
          </UButton>
          <UButton
            color="neutral"
            :variant="diet === 'vegetarian' ? 'solid' : 'outline'"
            size="xl"
            block
            @click="diet = 'vegetarian'"
          >
            素食
          </UButton>
        </div>
      </div>

      <!-- 加一人數（stepper） -->
      <div class="flex items-center justify-between border-y border-line py-4">
        <span class="text-body-l text-ink">攜伴人數</span>
        <div data-testid="vibe-rsvp-plusone-stepper" class="flex items-center gap-5">
          <UButton
            icon="i-heroicons-minus"
            color="neutral"
            variant="outline"
            size="lg"
            class="rounded-full"
            :disabled="plusOneCount <= 0"
            aria-label="少一位"
            @click="plusOneCount = Math.max(0, Number(plusOneCount) - 1)"
          />
          <UInput
            v-model.number="plusOneCount"
            data-testid="rsvp-plus-one"
            type="number"
            min="0"
            aria-label="攜伴人數"
            class="w-16"
            :ui="{ base: 'text-center font-display text-3xl' }"
          />
          <UButton
            icon="i-heroicons-plus"
            color="neutral"
            variant="solid"
            size="lg"
            class="rounded-full"
            aria-label="多一位"
            @click="plusOneCount = Number(plusOneCount) + 1"
          />
        </div>
      </div>

      <!-- 兒童座椅 -->
      <div class="flex items-center justify-between border-b border-line py-4">
        <div>
          <span class="text-body-l text-ink">需要兒童座椅</span>
          <p class="mt-0.5 text-caption text-ink-300">
            適合 6 歲以下幼童
          </p>
        </div>
        <USwitch v-model="needChildSeat" data-testid="rsvp-child-seat" />
      </div>

      <UButton
        type="submit"
        data-testid="rsvp-submit"
        color="primary"
        size="xl"
        block
        :loading="isSubmitting"
        class="mt-2"
      >
        送出回覆
      </UButton>

      <!-- 回覆說明（靜態文案） -->
      <p class="text-center text-caption text-ink-300">
        回覆截止前 · 可隨時修改
      </p>
    </form>
  </div>
</template>
