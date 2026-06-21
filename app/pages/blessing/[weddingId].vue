<!-- app/pages/blessing/[weddingId].vue -->
<script setup lang="ts">
import type {
  BlessingSubmittedEvent,
  SubmitBlessingBody,
} from '~/types/api/blessings'

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
    await $fetch<BlessingSubmittedEvent>(
      `/api/v1/weddings/${weddingId.value}/blessings`,
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
  <div data-testid="blessing-submit-page" class="flex flex-col">
    <div class="text-center">
      <UIcon name="i-heroicons-heart" class="size-12 text-primary-500" />
      <h1 class="mt-4 text-xl font-bold text-neutral-900">
        獻上祝福
      </h1>
      <p class="mt-2 text-neutral-500">
        留下您對新人的祝福留言與照片
      </p>
    </div>

    <UAlert
      v-if="submitError"
      data-testid="blessing-submit-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="submitError"
      class="mt-6"
    />

    <!-- 提交成功反饋 -->
    <UAlert
      v-if="isSubmitted"
      data-testid="blessing-submit-success"
      icon="i-heroicons-check-circle"
      color="success"
      variant="soft"
      title="祝福已送出"
      description="感謝您的祝福，我們已收到您的留言。"
      class="mt-6"
    />

    <form v-else class="mt-6 space-y-6" @submit.prevent="submitBlessing">
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
