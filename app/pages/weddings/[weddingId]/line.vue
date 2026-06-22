<!-- app/pages/weddings/[weddingId]/line.vue -->
<script setup lang="ts">
import type { ConnectLineOaBody } from '~/types/api/line'
import { connectLineOa, getLineOa } from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// === 已連結的官方帳號（由 GET 讀回，重整後仍能還原顯示） ===
const { data: connectedOa, refresh } = await getLineOa(weddingId, { default: () => null })

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
    await connectLineOa(weddingId.value, body)
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
    <PageHeader
      title="LINE 官方帳號"
      eyebrow="LINE"
      description="將 LINE 官方帳號連結至婚禮，用於發送通知與感謝訊息"
    >
      <template #actions>
        <UButton color="neutral" variant="solid" @click="openConnect">
          連結 LINE 官方帳號
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <div class="max-w-2xl space-y-8">
        <!-- 連結狀態 -->
        <section>
          <p class="text-overline mb-4 uppercase text-gold-deep">
            連結狀態
          </p>

          <div class="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div v-if="connectedOa" data-testid="line-oa-status" class="space-y-4">
              <div class="flex items-center gap-3">
                <UBadge color="success" variant="subtle">
                  已連結
                </UBadge>
                <span class="font-display text-h2 font-semibold text-ink dark:text-paper">
                  {{ connectedOa.oaName }}
                </span>
              </div>
              <div>
                <p class="text-caption text-ink-500 dark:text-neutral-400">
                  Channel ID
                </p>
                <p class="mt-1 text-body text-ink-700 dark:text-neutral-300">
                  {{ connectedOa.channelId }}
                </p>
              </div>
            </div>
            <p v-else class="text-body text-ink-300 dark:text-neutral-500">
              尚未連結 LINE 官方帳號
            </p>
          </div>
        </section>

        <!-- LINE 群發提醒（金左框淺面板） -->
        <section>
          <p class="text-overline mb-4 uppercase text-gold-deep">
            群發提醒
          </p>

          <div class="rounded-lg border border-line border-l-[3px] border-l-gold bg-paper p-6 dark:border-neutral-800">
            <h3 class="font-medium text-ink dark:text-paper">
              LINE 群發提醒
            </h3>
            <p class="mt-1.5 text-body text-ink-500 dark:text-neutral-400">
              連結官方帳號後，即可向賓客發送邀請與感謝訊息。
            </p>
            <UButton
              class="mt-4"
              color="neutral"
              variant="solid"
              :disabled="!connectedOa"
              @click="openConnect"
            >
              設定群發訊息
            </UButton>
          </div>
        </section>
      </div>
    </div>

    <!-- 連結 LINE 官方帳號 Modal -->
    <UModal v-model:open="isOpen">
      <template #content>
        <div data-testid="line-modal" class="p-6">
          <h3 class="mb-4 font-display text-h2 font-semibold text-ink dark:text-paper">
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
                color="neutral"
                variant="solid"
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
