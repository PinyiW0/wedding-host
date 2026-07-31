<!-- app/pages/rsvp/[guestId].vue -->
<script setup lang="ts">
import type { SubmitRsvpBody } from '~/types/api/rsvp'
import { getLineOa, getRsvpFormConfig, getWedding, submitRsvp as submitRsvpApi } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const guestId = computed(() => String(route.params.guestId))
// weddingId 由專屬連結帶入（query），對應提交端點所需
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

// 新人 LINE 官方帳號加好友連結：改讀後台連結的 OA；未連結或未設定連結則不顯示入口
const { data: lineOa } = await getLineOa(weddingId, { default: () => null })
const lineAddUrl = computed(() => lineOa.value?.addFriendUrl ?? '')

// 新人姓名由後台維護，訪客頁讀取顯示與帶入「與新人的關係」選項
const { data: wedding } = await getWedding(weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

// RSVP 表單設定（題目組成 / 模板 / banner）；未設定過後端回預設範本
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
    @submit="handleSubmit"
  />
</template>
