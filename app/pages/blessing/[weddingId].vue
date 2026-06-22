<!-- app/pages/blessing/[weddingId].vue -->
<script setup lang="ts">
import type {
  SubmitBlessingBody,
} from '~/types/api/blessings'
import { submitBlessing as submitBlessingApi } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
// 賓客透過專屬連結進入，連結帶 guestId
const guestId = computed(() => String(route.query.guestId ?? ''))

const message = ref('')
const photoUrl = ref('')
const photoName = ref('')

const isSubmitting = ref(false)
const isSubmitted = ref(false)
const submitError = ref('')

function onPhotoSelected(payload: { name: string, dataUrl: string }) {
  photoUrl.value = payload.dataUrl
  photoName.value = payload.name
  submitError.value = ''
}

async function submitBlessing() {
  if (isSubmitting.value || isSubmitted.value)
    return
  if (!message.value.trim()) {
    submitError.value = '請輸入祝福留言'
    return
  }
  isSubmitting.value = true
  submitError.value = ''
  try {
    const body: SubmitBlessingBody = {
      guestId: guestId.value,
      message: message.value.trim(),
      ...(photoUrl.value ? { photoUrl: photoUrl.value } : {}),
    }
    await submitBlessingApi(weddingId.value, body)
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
  <div data-testid="blessing-submit-page" class="flex flex-col">
    <!-- 沉浸式標題：Guest Blessings overline + Cormorant 大標 + italic 引言 -->
    <div class="text-center">
      <div class="mb-4 flex items-center justify-center gap-3">
        <span class="h-px w-8 bg-gold" />
        <span class="text-overline uppercase tracking-widest text-gold-deep">Guest Blessings</span>
        <span class="h-px w-8 bg-gold" />
      </div>
      <h1 class="font-display text-display-l font-semibold leading-none text-ink">
        獻上祝福
      </h1>
      <p class="mx-auto mt-4 max-w-sm font-display text-body-l italic leading-relaxed text-ink-500">
        留下您對新人的祝福留言與照片，<br>讓今晚的喜悅被永遠收藏。
      </p>
    </div>

    <UAlert
      v-if="submitError"
      data-testid="blessing-submit-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="submitError"
      class="mt-8"
    />

    <!-- 提交成功反饋 -->
    <div
      v-if="isSubmitted"
      data-testid="blessing-submit-success"
      class="mt-8 rounded-lg border border-line bg-paper p-8 text-center"
    >
      <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-light text-gold-deep">
        <UIcon name="i-heroicons-check" class="size-7" />
      </div>
      <h2 class="mt-4 font-display text-h2 font-semibold text-ink">
        祝福已送出
      </h2>
      <p class="mt-2 text-body text-ink-500">
        感謝您的祝福，我們已收到您的留言。
      </p>
    </div>

    <!-- 留言輸入卡：bg-paper 插入式淺面板 -->
    <form
      v-else
      class="mt-8 space-y-6 rounded-lg border border-line bg-paper p-6 sm:p-8"
      @submit.prevent="submitBlessing"
    >
      <UFormField label="祝福留言" name="message">
        <UTextarea
          v-model="message"
          data-testid="blessing-message"
          :rows="4"
          placeholder="寫下您的祝福..."
          class="w-full"
        />
      </UFormField>

      <UFormField label="祝福照片" name="photo">
        <FileUpload
          accept="image/*"
          label="點擊或拖放照片上傳"
          @selected="onPhotoSelected"
          @error="submitError = $event"
        />
      </UFormField>

      <UButton
        type="submit"
        data-testid="blessing-submit"
        color="primary"
        size="lg"
        block
        :loading="isSubmitting"
      >
        送出祝福
      </UButton>
    </form>
  </div>
</template>
