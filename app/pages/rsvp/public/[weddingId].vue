<!-- app/pages/rsvp/public/[weddingId].vue — 公開自助 RSVP（無 auth，共用 RsvpForm，提交建立待確認賓客） -->
<script setup lang="ts">
import type { SubmitRsvpBody } from '~/types/api/rsvp'
import { getLineOa, getRsvpFormConfig, getWedding, submitPublicRsvp } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

// 新人 LINE 加好友連結（未設定則不顯示）
const { data: lineOa } = await getLineOa(weddingId, { default: () => null })
const lineAddUrl = computed(() => lineOa.value?.addFriendUrl ?? '')

const { data: wedding } = await getWedding(weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

// RSVP 表單設定（與邀請頁共用設定）
const { data: formConfig } = await getRsvpFormConfig(weddingId)

const isSubmitting = ref(false)
const isSubmitted = ref(false)
const submitError = ref('')

async function handleSubmit(body: SubmitRsvpBody) {
  if (isSubmitting.value || isSubmitted.value)
    return
  isSubmitting.value = true
  submitError.value = ''
  try {
    await submitPublicRsvp(weddingId.value, body)
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
  <RsvpForm
    v-if="formConfig"
    :config="formConfig"
    :groom-name="groomName"
    :bride-name="brideName"
    :wedding-date="wedding?.date"
    :venue="wedding?.venue"
    :line-add-url="lineAddUrl"
    :submitting="isSubmitting"
    :submitted="isSubmitted"
    :error-message="submitError"
    require-name
    @submit="handleSubmit"
  />
</template>
