<!-- app/pages/rsvp/[guestId].vue — 賓客專屬 RSVP（後台「專屬連結」發出，回覆寫回該賓客那一筆）
     版面跟公開表單（rsvp/public/[weddingId].vue）同一套：layout story ＋ 右上角 PublicMenu，
     不用 guest 版面的 GuestNav——GuestNav 會列出當日流程、祝福留言、祝福花田、感謝卡、LINE 通知，
     那幾頁新人還沒定案、先不開（新人 09-17；專屬頁 09-19 跟上）。
     PublicMenu 回到「出席回覆」時認得賓客級簽章、會回到這一頁，不會掉去公開表單（見 useSignedLink 的 rsvpPath） -->
<script setup lang="ts">
import type { SubmitRsvpBody } from '~/types/api/rsvp'
import { getLineOa, getRsvpFormConfig, getWedding, submitRsvp as submitRsvpApi } from '~/api'

definePageMeta({ layout: 'story' })

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
  <!-- 外殼的每個數值都跟公開表單同值（overflow-x-clip、pt-20、--bleed-top），理由見 rsvp/public/[weddingId].vue -->
  <div class="flex min-h-screen flex-col overflow-x-clip bg-cream">
    <main class="flex flex-1 flex-col items-center px-4 pb-6 pt-20 [--bleed-top:5rem]">
      <div class="w-full max-w-2xl">
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
      </div>
    </main>
    <!-- 底是奶油色、沒有區塊回報深色，開關維持墨色 -->
    <PublicMenu :wedding-id="weddingId" :blend="false" />
  </div>
</template>
