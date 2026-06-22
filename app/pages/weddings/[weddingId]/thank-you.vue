<!-- app/pages/weddings/[weddingId]/thank-you.vue -->
<script setup lang="ts">
import type {
  CustomizeThankYouCardBody,
  SendThankYouFallbackBody,
  SetThankYouTemplateBody,
} from '~/types/api/thankyou'
import {
  batchSendThankYou,
  customizeThankYouCard,
  fallbackSendThankYou,
  getThankYouTemplate,
  listGuests,
  listThankYouCustomizations,
  setThankYouTemplate,
} from '~/api'

definePageMeta({ layout: 'default' })

// 謝卡預覽日期格式化用（避免每次呼叫重編譯 regex）
const DATE_SEPARATOR_RE = /-/g

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 婚禮資訊（顯示用）：謝卡預覽的新人名與日期
const { wedding } = useCurrentWedding()
const coupleName = computed(() => wedding.value?.title ?? '')
const weddingDate = computed(() => (wedding.value?.date ?? '').replace(DATE_SEPARATOR_RE, ' · '))

// 賓客清單（供客製 / 替代感謝選擇對象，濾除已軟刪賓客）
const { data: guests } = await listGuests(weddingId, { default: () => [] })
const guestOptions = computed(() =>
  (guests.value ?? [])
    .filter(g => !g.deletedAt)
    .map(g => ({ label: g.name, value: g.guestId })),
)

function guestName(guestId: string): string {
  return (guests.value ?? []).find(g => g.guestId === guestId)?.name ?? guestId
}

// === 謝卡範本（由 GET 讀回，重整仍能還原預覽） ===
const { data: template, refresh: refreshTemplate } = await getThankYouTemplate(weddingId, {
  default: () => null,
})
const templateContent = computed(() => template.value?.templateContent ?? '')

// === 設定謝卡範本 ===
const isTemplateOpen = ref(false)
const isTemplateSubmitting = ref(false)
const templateError = ref('')
const templateContentInput = ref('')
const templateImageUrl = ref<string | null>(null)

function openTemplate() {
  templateContentInput.value = templateContent.value
  templateError.value = ''
  isTemplateOpen.value = true
}

function onTemplateImageSelected(payload: { dataUrl: string }) {
  templateImageUrl.value = payload.dataUrl
}

async function submitTemplate() {
  if (isTemplateSubmitting.value)
    return
  if (!templateContentInput.value.trim()) {
    templateError.value = '請輸入範本內容'
    return
  }
  isTemplateSubmitting.value = true
  templateError.value = ''
  try {
    const body: SetThankYouTemplateBody = {
      templateContent: templateContentInput.value.trim(),
      ...(templateImageUrl.value ? { templateImageUrl: templateImageUrl.value } : {}),
    }
    await setThankYouTemplate(weddingId.value, body)
    await refreshTemplate()
    toast.add({ title: '謝卡範本已儲存', color: 'success' })
    isTemplateOpen.value = false
  }
  catch (error: any) {
    templateError.value
      = error?.data?.message || error?.statusMessage || '儲存失敗，請稍後再試'
  }
  finally {
    isTemplateSubmitting.value = false
  }
}

// === 客製謝卡 ===
const isCustomizeOpen = ref(false)
const isCustomizeSubmitting = ref(false)
const customizeError = ref('')
const customizeGuestId = ref('')
const customizeContent = ref('')
// 已客製賓客（由 GET 讀回，重整仍能還原清單）
const { data: customizations, refresh: refreshCustomizations } = await listThankYouCustomizations(
  weddingId,
  { default: () => [] },
)

function openCustomize() {
  customizeGuestId.value = ''
  customizeContent.value = ''
  customizeError.value = ''
  isCustomizeOpen.value = true
}

async function submitCustomize() {
  if (isCustomizeSubmitting.value)
    return
  if (!customizeGuestId.value) {
    customizeError.value = '請選擇賓客'
    return
  }
  if (!customizeContent.value.trim()) {
    customizeError.value = '請輸入客製內容'
    return
  }
  isCustomizeSubmitting.value = true
  customizeError.value = ''
  try {
    const body: CustomizeThankYouCardBody = {
      guestId: customizeGuestId.value,
      customContent: customizeContent.value.trim(),
    }
    await customizeThankYouCard(weddingId.value, body)
    await refreshCustomizations()
    toast.add({ title: '謝卡客製已儲存', color: 'success' })
    isCustomizeOpen.value = false
  }
  catch (error: any) {
    customizeError.value
      = error?.data?.message || error?.statusMessage || '儲存失敗，請稍後再試'
  }
  finally {
    isCustomizeSubmitting.value = false
  }
}

const customizationList = computed(() =>
  (customizations.value ?? []).map(c => ({
    guestId: c.guestId,
    name: guestName(c.guestId),
    content: c.customContent,
  })),
)

// === 群發感謝訊息 ===
const isBatchOpen = ref(false)
const isBatchSending = ref(false)
const batchError = ref('')
const batchResultCount = ref<number | null>(null)

function openBatch() {
  batchError.value = ''
  isBatchOpen.value = true
}

async function confirmBatch() {
  if (isBatchSending.value)
    return
  isBatchSending.value = true
  batchError.value = ''
  try {
    const res = await batchSendThankYou(weddingId.value)
    batchResultCount.value = res.recipientCount
    // 人數只放穩定的 inline 結果區，toast 不帶數字（避免 getByText(/50/) 觸發 strict mode，坑 #2）
    toast.add({ title: '感謝訊息已群發', color: 'success' })
    isBatchOpen.value = false
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複觸發 strict mode，坑 #2）
    batchError.value
      = error?.data?.message || error?.statusMessage || '群發失敗，請稍後再試'
  }
  finally {
    isBatchSending.value = false
  }
}

// === 發送替代感謝 ===
const CHANNEL_OPTIONS = [
  { label: 'Email', value: 'email' as const },
  { label: '連結', value: 'link' as const },
]
const isFallbackOpen = ref(false)
const isFallbackSending = ref(false)
const fallbackError = ref('')
const fallbackGuestId = ref('')
// 初始值設非目標選項（坑 #8）
const fallbackChannel = ref<'email' | 'link'>('link')

function openFallback() {
  fallbackGuestId.value = ''
  fallbackChannel.value = 'link'
  fallbackError.value = ''
  isFallbackOpen.value = true
}

async function submitFallback() {
  if (isFallbackSending.value)
    return
  if (!fallbackGuestId.value) {
    fallbackError.value = '請選擇賓客'
    return
  }
  isFallbackSending.value = true
  fallbackError.value = ''
  try {
    const body: SendThankYouFallbackBody = {
      guestId: fallbackGuestId.value,
      channel: fallbackChannel.value,
    }
    const res = await fallbackSendThankYou(weddingId.value, body)
    toast.add({
      title: `已透過${res.channel === 'email' ? 'Email' : '連結'}發送替代感謝`,
      color: 'success',
    })
    isFallbackOpen.value = false
  }
  catch (error: any) {
    fallbackError.value
      = error?.data?.message || error?.statusMessage || '發送失敗，請稍後再試'
  }
  finally {
    isFallbackSending.value = false
  }
}
</script>

<template>
  <div data-testid="thank-you-page" class="flex h-full flex-col">
    <PageHeader
      title="謝卡與感謝"
      eyebrow="With Gratitude"
      description="設定謝卡範本、客製個別謝卡，並群發或替代發送感謝訊息"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <UButton color="neutral" variant="outline" @click="openFallback">
            替代感謝
          </UButton>
          <UButton color="neutral" variant="solid" @click="openBatch">
            群發感謝訊息
          </UButton>
        </div>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_minmax(320px,400px)]">
        <!-- 左：編輯區 -->
        <div class="space-y-10">
          <!-- 謝卡範本 -->
          <section>
            <div class="mb-4 flex items-center gap-3">
              <span class="text-overline uppercase text-gold-deep">謝卡範本</span>
              <span class="h-px flex-1 bg-line" />
            </div>
            <div class="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <p
                    v-if="templateContent"
                    data-testid="template-preview"
                    class="whitespace-pre-line text-body-l leading-relaxed text-ink-700 dark:text-neutral-300"
                  >
                    {{ templateContent }}
                  </p>
                  <p v-else class="text-body text-ink-300">
                    尚未設定謝卡範本
                  </p>
                </div>
                <UButton
                  color="neutral"
                  variant="outline"
                  class="shrink-0"
                  @click="openTemplate"
                >
                  編輯謝卡範本
                </UButton>
              </div>
            </div>
          </section>

          <!-- 已群發結果 -->
          <section
            v-if="batchResultCount !== null"
            data-testid="batch-result"
            class="rounded-lg border border-line border-l-[3px] border-l-gold bg-paper p-5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p class="text-ink-700 dark:text-neutral-300">
              已發送給 {{ batchResultCount }} 位賓客
            </p>
          </section>

          <!-- 客製謝卡 -->
          <section>
            <div class="mb-4 flex items-center justify-between gap-4">
              <div class="flex flex-1 items-center gap-3">
                <span class="text-overline uppercase text-gold-deep">個別客製謝卡</span>
                <span class="h-px flex-1 bg-line" />
              </div>
              <UButton color="neutral" variant="outline" @click="openCustomize">
                客製謝卡
              </UButton>
            </div>

            <div v-if="customizationList.length === 0">
              <EmptyState title="尚無客製謝卡" description="可為個別賓客客製專屬謝卡內容" />
            </div>
            <ul v-else class="space-y-2.5">
              <li
                v-for="c in customizationList"
                :key="c.guestId"
                :aria-label="c.name"
                class="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p class="font-medium text-ink dark:text-paper">
                  {{ c.name }}
                </p>
                <p class="mt-1 text-body text-ink-500 dark:text-neutral-400">
                  {{ c.content }}
                </p>
              </li>
            </ul>
          </section>
        </div>

        <!-- 右：謝卡風即時預覽（With Gratitude / Cormorant italic / 金線 / 新人名 Cormorant） -->
        <aside class="lg:sticky lg:top-0">
          <div class="mb-4 flex items-center gap-3">
            <span class="text-overline uppercase text-gold-deep">即時預覽</span>
            <span class="h-px flex-1 bg-line" />
          </div>
          <div class="flex flex-col items-center rounded-lg border border-line bg-paper px-8 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p class="text-overline uppercase tracking-[0.32em] text-gold-deep">
              With Gratitude
            </p>
            <p class="mt-8 font-display text-3xl italic leading-snug text-gold">
              謝謝你，<br>來見證我們的開始
            </p>
            <span class="my-8 h-px w-10 bg-gold" />
            <p class="max-w-xs whitespace-pre-line text-body leading-loose text-ink-700 dark:text-neutral-300">
              {{ templateContent || '在此設定謝卡範本，賓客將收到這份感謝。' }}
            </p>
            <p
              v-if="coupleName"
              class="mt-10 font-display text-4xl font-semibold leading-none text-ink dark:text-paper"
            >
              {{ coupleName }}
            </p>
            <p v-if="weddingDate" class="mt-2 text-caption tracking-widest text-ink-500">
              {{ weddingDate }}
            </p>
            <span class="my-8 h-px w-full bg-line" />
            <span class="text-body text-gold-deep">
              為新人留下祝福 →
            </span>
          </div>
        </aside>
      </div>
    </div>

    <!-- 設定謝卡範本 Modal -->
    <UModal v-model:open="isTemplateOpen">
      <template #content>
        <div data-testid="template-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            設定謝卡範本
          </h3>

          <UAlert
            v-if="templateError"
            data-testid="template-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="templateError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="範本內容" name="templateContent">
              <UTextarea
                v-model="templateContentInput"
                data-testid="template-content-input"
                :rows="3"
                placeholder="請輸入謝卡範本內容"
                class="w-full"
              />
            </UFormField>

            <UFormField label="範本圖片" name="templateImageUrl">
              <FileUpload
                accept="image/*"
                label="點擊或拖放上傳謝卡圖片"
                @selected="onTemplateImageSelected"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isTemplateSubmitting"
                @click="isTemplateOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="template-submit"
                color="neutral"
                variant="solid"
                :loading="isTemplateSubmitting"
                @click="submitTemplate"
              >
                儲存範本
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 客製謝卡 Modal -->
    <UModal v-model:open="isCustomizeOpen">
      <template #content>
        <div data-testid="customize-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            客製謝卡
          </h3>

          <UAlert
            v-if="customizeError"
            data-testid="customize-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="customizeError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="客製內容" name="customContent">
              <UTextarea
                v-model="customizeContent"
                data-testid="customize-content-input"
                :rows="3"
                placeholder="請輸入客製謝卡內容"
                class="w-full"
              />
            </UFormField>

            <UFormField label="賓客" name="guestId">
              <USelectMenu
                v-model="customizeGuestId"
                data-testid="customize-guest-select"
                :items="guestOptions"
                value-key="value"
                placeholder="選擇賓客"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isCustomizeSubmitting"
                @click="isCustomizeOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="customize-submit"
                color="neutral"
                variant="solid"
                :loading="isCustomizeSubmitting"
                @click="submitCustomize"
              >
                儲存客製
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 群發感謝確認 -->
    <UModal v-model:open="isBatchOpen">
      <template #content>
        <div data-testid="batch-modal" class="p-6">
          <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
            群發感謝訊息
          </h3>
          <p class="mt-2 text-neutral-500 dark:text-neutral-400">
            將透過 LINE 群發感謝訊息給已綁定 LINE 的賓客，確定要發送嗎？
          </p>

          <UAlert
            v-if="batchError"
            data-testid="batch-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="batchError"
            class="mt-4"
          />

          <div class="mt-6 flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isBatchSending"
              @click="isBatchOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="batch-submit"
              color="neutral"
              variant="solid"
              :loading="isBatchSending"
              @click="confirmBatch"
            >
              確認發送
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 替代感謝 Modal -->
    <UModal v-model:open="isFallbackOpen">
      <template #content>
        <div data-testid="fallback-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            發送替代感謝
          </h3>

          <UAlert
            v-if="fallbackError"
            data-testid="fallback-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="fallbackError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="賓客" name="guestId">
              <USelectMenu
                v-model="fallbackGuestId"
                data-testid="fallback-guest-select"
                :items="guestOptions"
                value-key="value"
                placeholder="選擇賓客"
                class="w-full"
              />
            </UFormField>

            <UFormField label="發送管道" name="channel">
              <USelectMenu
                v-model="fallbackChannel"
                data-testid="fallback-channel-select"
                :items="CHANNEL_OPTIONS"
                value-key="value"
                placeholder="選擇發送管道"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isFallbackSending"
                @click="isFallbackOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="fallback-submit"
                color="neutral"
                variant="solid"
                :loading="isFallbackSending"
                @click="submitFallback"
              >
                確認發送
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
