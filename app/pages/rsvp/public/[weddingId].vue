<!-- app/pages/rsvp/public/[weddingId].vue — 公開自助 RSVP（無 auth，共用 RsvpForm，提交建立待確認賓客）
     版面走故事頁那一套（layout story ＋ 右上角 PublicMenu），不用 guest 版面的 GuestNav：
     GuestNav 的漢堡連到當日流程、祝福留言、祝福花田，那幾頁新人還沒定案、先不開（新人 09-17）；
     PublicMenu 只列故事、相簿、喜帖三個公開頁，跟賓客從故事頁點進來時看到的是同一顆選單。
     表單本身之後也會照故事頁的風格改，這裡先只換殼。 -->
<script setup lang="ts">
import type { SubmitRsvpBody } from '~/types/api/rsvp'
import { getLineOa, getRsvpFormConfig, getWedding, submitPublicRsvp } from '~/api'

definePageMeta({ layout: 'story' })

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
  <div class="flex min-h-screen flex-col bg-cream">
    <!-- pt-20：右上角的選單開關是 fixed（頂端 14～30px、高 53px），表單的眉標要落在它下面 -->
    <main class="flex flex-1 flex-col items-center px-4 pb-6 pt-20">
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
          require-name
          @submit="handleSubmit"
        />
      </div>
    </main>
    <!-- 底是奶油色、沒有區塊回報深色，開關維持墨色 -->
    <PublicMenu :wedding-id="weddingId" :blend="false" />
  </div>
</template>
