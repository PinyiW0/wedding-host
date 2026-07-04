<!-- app/pages/guest/[guestId]/bind.vue -->
<script setup lang="ts">
import type { BindGuestLineBody } from '~/types/api/guests'
import { bindGuestLine } from '~/api'

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
    await bindGuestLine(weddingId.value, guestId.value, body)
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
  <div
    data-testid="guest-bind-page"
    class="flex flex-col items-center rounded-lg border border-line bg-paper px-6 py-12 text-center"
  >
    <div class="flex size-16 items-center justify-center rounded-full border border-gold bg-white">
      <UIcon name="i-heroicons-chat-bubble-left-right" class="size-7 text-gold" />
    </div>

    <p class="mt-6 text-overline uppercase text-gold-deep">
      LINE Binding
    </p>
    <h1 class="mt-3 font-display text-h1 font-semibold leading-none text-ink">
      綁定您的 LINE
    </h1>
    <div class="mx-auto mt-4 h-px w-10 bg-gold" />
    <p class="mt-4 text-body-l text-ink-500">
      綁定後即可接收婚禮通知與專屬訊息
    </p>

    <UAlert
      v-if="bindError"
      data-testid="guest-bind-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="bindError"
      class="mt-8 text-left"
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
      class="mt-8 text-left"
    />

    <UButton
      v-else
      data-testid="guest-bind-submit"
      icon="i-heroicons-chat-bubble-left-right"
      color="success"
      size="xl"
      :loading="isBinding"
      class="mt-8"
      @click="bindLine"
    >
      綁定 LINE
    </UButton>
  </div>
</template>
