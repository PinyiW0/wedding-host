<!-- app/pages/guest/[guestId]/bind.vue -->
<script setup lang="ts">
import type { BindGuestLineBody, GuestLineBoundEvent } from '~/types/api/guests'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const guestId = computed(() => String(route.params.guestId))
// weddingId 由專屬連結帶入（query），對應綁定端點所需
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

const isBinding = ref(false)
const isBound = ref(false)
const bindError = ref('')

async function bindLine() {
  if (isBinding.value || isBound.value)
    return
  isBinding.value = true
  bindError.value = ''
  try {
    // 模擬完成 LINE 授權回傳的 lineUserId
    const body: BindGuestLineBody = {
      lineUserId: `line-u-${guestId.value}-${Date.now()}`,
    }
    await $fetch<GuestLineBoundEvent>(
      `/api/v1/weddings/${weddingId.value}/guests/${guestId.value}/line-binding`,
      { method: 'POST', body },
    )
    isBound.value = true
  }
  catch (error: any) {
    bindError.value
      = error?.data?.message || error?.statusMessage || '綁定失敗，請稍後再試'
  }
  finally {
    isBinding.value = false
  }
}
</script>

<template>
  <div data-testid="guest-bind-page" class="flex flex-col items-center text-center">
    <UIcon name="i-heroicons-chat-bubble-left-right" class="size-12 text-primary-500" />
    <h1 class="mt-4 text-xl font-bold text-neutral-900">
      綁定您的 LINE
    </h1>
    <p class="mt-2 text-neutral-500">
      綁定後即可接收婚禮通知與專屬訊息
    </p>

    <UAlert
      v-if="bindError"
      data-testid="guest-bind-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="bindError"
      class="mt-6 text-left"
    />

    <!-- 綁定成功反饋 -->
    <UAlert
      v-if="isBound"
      data-testid="guest-bind-success"
      icon="i-heroicons-check-circle"
      color="success"
      variant="soft"
      title="綁定成功"
      description="您已成功綁定 LINE，將會收到婚禮的最新消息。"
      class="mt-6 text-left"
    />

    <UButton
      v-else
      data-testid="guest-bind-submit"
      icon="i-heroicons-chat-bubble-left-right"
      color="success"
      size="lg"
      :loading="isBinding"
      class="mt-6"
      @click="bindLine"
    >
      綁定 LINE
    </UButton>
  </div>
</template>
