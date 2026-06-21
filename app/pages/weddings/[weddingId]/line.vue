<!-- app/pages/weddings/[weddingId]/line.vue -->
<script setup lang="ts">
import type { ConnectLineOaBody, LineOaConnectedEvent, LineOaDetail } from '~/types/api/line'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// === 已連結的官方帳號（由 GET 讀回，重整後仍能還原顯示） ===
const { data: connectedOa, refresh } = await useFetch<LineOaDetail | null>(
  () => `/api/v1/weddings/${weddingId.value}/line-oa`,
  { default: () => null },
)

// === 連結表單 ===
const isOpen = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const oaName = ref('')
const channelId = ref('')

function openConnect() {
  oaName.value = connectedOa.value?.oaName ?? ''
  channelId.value = connectedOa.value?.channelId ?? ''
  formError.value = ''
  isOpen.value = true
}

async function submitConnect() {
  if (isSubmitting.value)
    return
  if (!oaName.value.trim()) {
    formError.value = '請輸入 OA 名稱'
    return
  }
  if (!channelId.value.trim()) {
    formError.value = '請輸入 Channel ID'
    return
  }
  isSubmitting.value = true
  formError.value = ''
  try {
    const body: ConnectLineOaBody = {
      oaName: oaName.value.trim(),
      channelId: channelId.value.trim(),
    }
    await $fetch<LineOaConnectedEvent>(
      `/api/v1/weddings/${weddingId.value}/line-oa`,
      { method: 'POST', body },
    )
    // 寫入成功後重抓，以 GET 為呈現真實來源（重整也靠 GET）
    await refresh()
    toast.add({ title: 'LINE 官方帳號連結成功', color: 'success' })
    isOpen.value = false
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複觸發 strict mode，坑 #2）
    formError.value
      = error?.data?.message || error?.statusMessage || '連結失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="line-page" class="flex h-full flex-col">
    <PageHeader title="LINE 官方帳號" description="將 LINE 官方帳號連結至婚禮，用於發送通知與感謝訊息">
      <template #actions>
        <UButton color="primary" variant="solid" @click="openConnect">
          連結 LINE 官方帳號
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <section class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 class="font-semibold text-neutral-900 dark:text-white">
          連結狀態
        </h2>

        <div v-if="connectedOa" data-testid="line-oa-status" class="mt-3 space-y-1">
          <div class="flex items-center gap-2">
            <UBadge color="success" variant="subtle">
              已連結
            </UBadge>
            <span class="font-medium text-neutral-900 dark:text-white">
              {{ connectedOa.oaName }}
            </span>
          </div>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            Channel ID：{{ connectedOa.channelId }}
          </p>
        </div>
        <p v-else class="mt-3 text-sm text-neutral-400">
          尚未連結 LINE 官方帳號
        </p>
      </section>
    </div>

    <!-- 連結 LINE 官方帳號 Modal -->
    <UModal v-model:open="isOpen">
      <template #content>
        <div data-testid="line-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            連結 LINE 官方帳號
          </h3>

          <UAlert
            v-if="formError"
            data-testid="line-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="formError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="OA 名稱" name="oaName">
              <UInput
                v-model="oaName"
                data-testid="oa-name-input"
                placeholder="請輸入 LINE 官方帳號名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Channel ID" name="channelId">
              <UInput
                v-model="channelId"
                data-testid="channel-id-input"
                placeholder="請輸入 Channel ID"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
                @click="isOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="line-submit"
                color="primary"
                :loading="isSubmitting"
                @click="submitConnect"
              >
                確定儲存
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
