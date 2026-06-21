<!-- app/pages/rsvp/[guestId].vue -->
<script setup lang="ts">
import type {
  AttendingStatus,
  RsvpSubmittedEvent,
  SubmitRsvpBody,
} from '~/types/api/rsvp'

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
    await $fetch<RsvpSubmittedEvent>(
      `/api/v1/weddings/${weddingId.value}/guests/${guestId.value}/rsvp`,
      { method: 'POST', body },
    )
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
    <div class="text-center">
      <UIcon name="i-heroicons-envelope-open" class="size-12 text-primary-500" />
      <h1 class="mt-4 text-xl font-bold text-neutral-900">
        出席回覆
      </h1>
      <p class="mt-2 text-neutral-500">
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
      class="mt-6"
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
      class="mt-6"
    />

    <form v-else class="mt-6 space-y-6" @submit.prevent="submitRsvp">
      <!-- 出席狀態 -->
      <div>
        <p class="mb-2 text-sm font-medium text-neutral-700">
          出席狀態
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            :color="attending === 'attending' ? 'primary' : 'neutral'"
            :variant="attending === 'attending' ? 'solid' : 'outline'"
            @click="attending = 'attending'"
          >
            出席
          </UButton>
          <UButton
            :color="attending === 'declined' ? 'primary' : 'neutral'"
            :variant="attending === 'declined' ? 'solid' : 'outline'"
            @click="attending = 'declined'"
          >
            不出席
          </UButton>
        </div>
      </div>

      <!-- 飲食 -->
      <div>
        <p class="mb-2 text-sm font-medium text-neutral-700">
          飲食
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            :color="diet === 'meat' ? 'primary' : 'neutral'"
            :variant="diet === 'meat' ? 'solid' : 'outline'"
            @click="diet = 'meat'"
          >
            葷食
          </UButton>
          <UButton
            :color="diet === 'vegetarian' ? 'primary' : 'neutral'"
            :variant="diet === 'vegetarian' ? 'solid' : 'outline'"
            @click="diet = 'vegetarian'"
          >
            素食
          </UButton>
        </div>
      </div>

      <!-- 加一人數 -->
      <UFormField label="加一人數" name="plusOneCount">
        <UInput
          v-model.number="plusOneCount"
          data-testid="rsvp-plus-one"
          type="number"
          min="0"
          class="w-full"
        />
      </UFormField>

      <!-- 兒童座椅 -->
      <UCheckbox
        v-model="needChildSeat"
        data-testid="rsvp-child-seat"
        label="需要兒童座椅"
      />

      <UButton
        type="submit"
        data-testid="rsvp-submit"
        color="primary"
        size="lg"
        block
        :loading="isSubmitting"
      >
        送出回覆
      </UButton>
    </form>
  </div>
</template>
