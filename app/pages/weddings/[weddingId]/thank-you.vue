<!-- app/pages/weddings/[weddingId]/thank-you.vue -->
<script setup lang="ts">
import type {
  CustomizeThankYouCardBody,
  SendThankYouFallbackBody,
  SetThankYouTemplateBody,
  ThankYouFailedGuest,
} from '~/types/api/thankyou'
import {
  batchSendThankYou,
  customizeThankYouCard,
  fallbackSendThankYou,
  getSignedLink,
  getThankYouTemplate,
  listGuests,
  listThankYouCustomizations,
  resendThankYou,
  setThankYouTemplate,
} from '~/api'

definePageMeta({ layout: 'default' })

// 謝卡預覽格式化用（regex 提至 module scope 避免重編譯）
const DATE_SEPARATOR_RE = /-/g
const COUPLE_SUFFIX_RE = /的婚禮$/

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))
const { uploadImage } = useImageUpload()

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

// === 設定謝卡範本（inline 編輯，右欄即時預覽）===
const isTemplateEditing = ref(false)
const isCustomizeEditing = ref(false) // 客製 inline 編輯（可與範本同時展開）
const isTemplateSubmitting = ref(false)
const templateError = ref('')
const templateContentInput = ref('')
const templateImageUrl = ref<string | null>(null)
// 信箋文字覆寫緩衝（留空＝沿用婚禮資料自動帶入）
const greetingInput = ref('')
const signatureInput = ref('')
const signatureDateInput = ref('')

// 右欄信箋即時預覽：編輯中顯示輸入值，否則顯示 GET 還原的已存值
const previewContent = computed(() =>
  isTemplateEditing.value ? templateContentInput.value : templateContent.value,
)
// 編輯中：完全反映編輯緩衝（含上傳 / 移除，移除後即時隱藏）；非編輯：顯示 GET 還原值
const previewImageUrl = computed(() =>
  isTemplateEditing.value ? templateImageUrl.value : (template.value?.templateImageUrl ?? null),
)
// 信箋署名預設：去除「的婚禮」後綴，僅以新人名落款（較短、避免窄欄斷行）
const coupleSignature = computed(() =>
  coupleName.value.replace(COUPLE_SUFFIX_RE, '') || coupleName.value,
)
// 信箋三段文字：編輯中顯示緩衝、否則 GET 還原值；皆留空時自動帶入婚禮資料當預設
const previewGreeting = computed(() => {
  const v = isTemplateEditing.value ? greetingInput.value : (template.value?.greeting ?? '')
  return v.trim() || 'With Gratitude'
})
const previewSignature = computed(() => {
  const v = isTemplateEditing.value ? signatureInput.value : (template.value?.signature ?? '')
  return v.trim() || coupleSignature.value
})
const previewDate = computed(() => {
  const v = isTemplateEditing.value ? signatureDateInput.value : (template.value?.signatureDate ?? '')
  return v.trim() || weddingDate.value
})
// 金箔圓印：取署名前兩字
const coupleInitials = computed(() => previewSignature.value.slice(0, 2) || '囍')

function openTemplateEdit() {
  templateContentInput.value = templateContent.value
  // 回填已存圖片：避免重新編輯時誤判圖片消失，也避免未重傳就再存被後端覆寫為 null
  templateImageUrl.value = template.value?.templateImageUrl ?? null
  // 回填信箋文字覆寫（同上：避免再存時被後端覆寫為 null）
  greetingInput.value = template.value?.greeting ?? ''
  signatureInput.value = template.value?.signature ?? ''
  signatureDateInput.value = template.value?.signatureDate ?? ''
  templateError.value = ''
  isTemplateEditing.value = true
}

function cancelTemplateEdit() {
  isTemplateEditing.value = false
  templateError.value = ''
}

function onTemplateImageSelected(payload: { dataUrl: string }) {
  templateImageUrl.value = payload.dataUrl
}

function removeTemplateImage() {
  templateImageUrl.value = null
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
    // R2 啟用時範本圖先直傳（已是 URL 則原樣返回）；本機模式維持 dataURL
    const uploadedTemplateImageUrl = templateImageUrl.value
      ? await uploadImage(templateImageUrl.value, weddingId.value, 'thank-you')
      : null
    const body: SetThankYouTemplateBody = {
      templateContent: templateContentInput.value.trim(),
      ...(uploadedTemplateImageUrl ? { templateImageUrl: uploadedTemplateImageUrl } : {}),
      ...(greetingInput.value.trim() ? { greeting: greetingInput.value.trim() } : {}),
      ...(signatureInput.value.trim() ? { signature: signatureInput.value.trim() } : {}),
      ...(signatureDateInput.value.trim() ? { signatureDate: signatureDateInput.value.trim() } : {}),
    }
    await setThankYouTemplate(weddingId.value, body)
    await refreshTemplate()
    toast.add({ title: '謝卡範本已儲存', color: 'success' })
    isTemplateEditing.value = false
  }
  catch (error: any) {
    templateError.value
      = error?.data?.message || error?.statusMessage || '儲存失敗，請稍後再試'
  }
  finally {
    isTemplateSubmitting.value = false
  }
}

// === 客製謝卡（inline 編輯）===
const isCustomizeSubmitting = ref(false)
const customizeError = ref('')
const customizeGuestId = ref('')
const customizeContent = ref('')
// 已客製賓客（由 GET 讀回，重整仍能還原清單）
const { data: customizations, refresh: refreshCustomizations } = await listThankYouCustomizations(
  weddingId,
  { default: () => [] },
)

function openCustomizeEdit() {
  customizeGuestId.value = ''
  customizeContent.value = ''
  customizeError.value = ''
  isCustomizeEditing.value = true
}

function cancelCustomizeEdit() {
  isCustomizeEditing.value = false
  customizeError.value = ''
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
    isCustomizeEditing.value = false
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
// 發送失敗的賓客清單（可見、可單獨重發，issue #72）；mock 模式恆為空
const batchFailedGuests = ref<ThankYouFailedGuest[]>([])
const resendingGuestId = ref('')

// 已綁定 LINE 的賓客數（群發前確認提示用，與後端 batch-send 同一篩選條件）
const boundGuestCount = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt && g.lineUserId).length,
)

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
    batchFailedGuests.value = res.failedGuests
    // 人數只放穩定的 inline 結果區，toast 不帶數字（避免 getByText(/50/) 觸發 strict mode，坑 #2）
    if (res.recipientCount > 0)
      toast.add({ title: '感謝訊息已群發', color: 'success' })
    else
      toast.add({ title: '群發失敗，請查看失敗清單', color: 'error' })
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

// 對單一失敗賓客重發：成功即自清單移除並計入已發送人數
async function resendToGuest(guest: ThankYouFailedGuest) {
  if (resendingGuestId.value)
    return
  resendingGuestId.value = guest.guestId
  try {
    await resendThankYou(weddingId.value, { guestId: guest.guestId })
    batchFailedGuests.value = batchFailedGuests.value.filter(g => g.guestId !== guest.guestId)
    batchResultCount.value = (batchResultCount.value ?? 0) + 1
    toast.add({ title: `已重發給 ${guest.name}`, color: 'success' })
  }
  catch (error: any) {
    toast.add({
      title: error?.data?.message || error?.statusMessage || '重發失敗，請稍後再試',
      color: 'error',
    })
  }
  finally {
    resendingGuestId.value = ''
  }
}

// === 複製賓客專屬謝卡連結（取代 email、可分享）===
const linkGuestId = ref('')
async function copyThankYouLink(guestId: string) {
  if (!guestId) {
    toast.add({ title: '請先選擇賓客', color: 'error' })
    return
  }
  const base = `${window.location.origin}/thankyou/${weddingId.value}/${guestId}`
  try {
    // 連結附 HMAC 簽名：enforced 模式下公開頁憑此放行
    const { sig } = await getSignedLink(weddingId.value, guestId)
    const url = `${base}?sig=${sig}`
    await navigator.clipboard.writeText(url)
    toast.add({ title: '已複製謝卡連結', description: url, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: base, color: 'error' })
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

// 從客製卡「寄這張謝卡」進入：預填該賓客
function openFallbackFor(guestId: string) {
  fallbackGuestId.value = guestId
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
      title="電子謝卡"
      eyebrow="With Gratitude"
      description="寫一封謝卡、為個別賓客客製，再群發或替代寄出感謝"
    />

    <div class="min-h-0 flex-1 overflow-auto">
      <div class="mx-auto max-w-5xl space-y-12 pb-8">
        <!-- ═══ Step 01 · 寫一封謝卡 ═══ -->
        <section>
          <div class="mb-4 flex items-center gap-3">
            <span class="text-overline uppercase text-gold-deep">Step 01 · 寫一封謝卡</span>
            <span class="h-px flex-1 bg-line" />
          </div>
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(320px,380px)]">
            <!-- 左：範本 inline 編輯 -->
            <div>
              <!-- 摺疊態 -->
              <div
                v-if="!isTemplateEditing"
                class="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p
                  v-if="templateContent"
                  class="whitespace-pre-line text-body-l leading-relaxed text-ink-700 dark:text-neutral-300"
                >
                  {{ templateContent }}
                </p>
                <p v-else class="text-body text-ink-300">
                  點擊下方按鈕，開始撰寫您的謝卡。
                </p>
                <UButton
                  class="mt-4"
                  color="neutral"
                  variant="outline"
                  @click="openTemplateEdit"
                >
                  編輯謝卡範本
                </UButton>
              </div>
              <!-- 展開態（inline，右欄即時預覽） -->
              <div
                v-else
                class="space-y-4 rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <UAlert
                  v-if="templateError"
                  data-testid="template-error"
                  icon="i-heroicons-exclamation-triangle"
                  color="error"
                  variant="soft"
                  :title="templateError"
                />
                <UFormField label="致謝詞" name="greeting">
                  <UInput
                    v-model="greetingInput"
                    placeholder="With Gratitude"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="範本內容" name="templateContent">
                  <UTextarea
                    v-model="templateContentInput"
                    data-testid="template-content-input"
                    :rows="4"
                    placeholder="請輸入謝卡範本內容"
                    class="w-full"
                  />
                </UFormField>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <UFormField label="新人署名" name="signature">
                    <UInput
                      v-model="signatureInput"
                      :placeholder="coupleSignature"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="信箋日期" name="signatureDate">
                    <UInput
                      v-model="signatureDateInput"
                      :placeholder="weddingDate"
                      class="w-full"
                    />
                  </UFormField>
                </div>
                <p class="text-caption text-ink-500">
                  致謝詞、署名與日期留空時，將自動帶入婚禮基本資料。
                </p>
                <UFormField label="範本圖片" name="templateImageUrl">
                  <!-- 目前已套用的圖片：讓使用者明確看到圖片仍在、可替換或移除 -->
                  <div
                    v-if="templateImageUrl"
                    class="mb-3 flex items-center gap-3 rounded-lg border border-line bg-paper p-3 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <img
                      :src="templateImageUrl"
                      alt="目前謝卡圖片"
                      loading="lazy"
                      class="h-16 w-24 shrink-0 rounded border border-line object-cover"
                    >
                    <span class="flex-1 text-caption text-ink-500">
                      目前已套用此圖片，重新上傳可替換。
                    </span>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-heroicons-trash"
                      @click="removeTemplateImage"
                    >
                      移除
                    </UButton>
                  </div>
                  <FileUpload
                    accept="image/*"
                    :label="templateImageUrl ? '點擊或拖放上傳新圖片以替換' : '點擊或拖放上傳謝卡圖片'"
                    @selected="onTemplateImageSelected"
                  />
                </UFormField>
                <div class="flex justify-end gap-3">
                  <UButton
                    color="neutral"
                    variant="outline"
                    :disabled="isTemplateSubmitting"
                    @click="cancelTemplateEdit"
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

            <!-- 右：精緻信箋即時預覽 -->
            <aside class="lg:sticky lg:top-4">
              <div class="mb-3 flex items-center justify-center gap-3">
                <span class="h-px w-8 bg-gold" />
                <span class="text-overline uppercase text-gold-deep">Live Preview</span>
                <span class="h-px w-8 bg-gold" />
              </div>
              <!-- 與公開謝卡共用同一信箋元件，兩處永遠同步；template-preview testid 由 prop 傳入（凍結 toHaveText） -->
              <ThankYouCardPreview
                :greeting="previewGreeting"
                :content="previewContent"
                placeholder="尚未設定謝卡範本"
                :signature="previewSignature"
                :signature-date="previewDate"
                :image-url="previewImageUrl"
                :seal="coupleInitials"
                content-testid="template-preview"
              />
            </aside>
          </div>
        </section>

        <!-- ═══ Step 02 · 為個別賓客客製 ═══ -->
        <section>
          <div class="mb-4 flex items-center justify-between gap-4">
            <div class="flex flex-1 items-center gap-3">
              <span class="text-overline uppercase text-gold-deep">Step 02 · 個別客製</span>
              <span class="h-px flex-1 bg-line" />
            </div>
            <UButton
              v-if="!isCustomizeEditing"
              color="neutral"
              variant="outline"
              @click="openCustomizeEdit"
            >
              客製謝卡
            </UButton>
          </div>
          <p class="mb-4 text-caption text-ink-500">
            為特定賓客覆蓋專屬內容；寄送時將以客製內容取代範本。
          </p>
          <!-- 客製 inline 編輯 -->
          <div
            v-if="isCustomizeEditing"
            class="mb-6 space-y-4 rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <UAlert
              v-if="customizeError"
              data-testid="customize-error"
              icon="i-heroicons-exclamation-triangle"
              color="error"
              variant="soft"
              :title="customizeError"
            />
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
            <div class="flex justify-end gap-3">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isCustomizeSubmitting"
                @click="cancelCustomizeEdit"
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
          <!-- 客製清單：mini 信箋卡 -->
          <div v-if="customizationList.length === 0">
            <EmptyState title="尚無客製謝卡" description="可為個別賓客客製專屬謝卡內容" />
          </div>
          <ul v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <li
              v-for="c in customizationList"
              :key="c.guestId"
              :aria-label="c.name"
              class="rounded-lg bg-paper p-5 shadow-sm ring-1 ring-gold/20 dark:bg-neutral-900"
            >
              <div class="flex items-center gap-2.5">
                <span class="flex size-8 items-center justify-center rounded-full bg-gold-light text-caption font-medium text-gold-deep">
                  {{ c.name.slice(0, 1) }}
                </span>
                <p class="font-display text-body-l font-medium text-ink dark:text-paper">
                  {{ c.name }}
                </p>
              </div>
              <span class="my-3 block h-px w-8 bg-gold" />
              <p class="whitespace-pre-line text-body leading-relaxed text-ink-700 dark:text-neutral-300">
                {{ c.content }}
              </p>
              <div class="mt-3 flex justify-end gap-3">
                <UButton color="neutral" variant="link" icon="i-heroicons-link" @click="copyThankYouLink(c.guestId)">
                  複製連結
                </UButton>
                <UButton color="primary" variant="link" @click="openFallbackFor(c.guestId)">
                  寄這張謝卡 →
                </UButton>
              </div>
            </li>
          </ul>
        </section>

        <!-- ═══ Step 03 · 寄出感謝 ═══ -->
        <section>
          <div class="mb-4 flex items-center gap-3">
            <span class="text-overline uppercase text-gold-deep">Step 03 · 寄出感謝</span>
            <span class="h-px flex-1 bg-line" />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <!-- A 群發 LINE -->
            <div class="flex flex-col rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex items-center gap-2 text-gold-deep">
                <UIcon name="i-heroicons-chat-bubble-left-right" class="size-5" />
                <p class="font-display text-body-l font-medium text-ink dark:text-paper">
                  群發感謝（LINE）
                </p>
              </div>
              <p class="mt-2 flex-1 text-body text-ink-500 dark:text-neutral-400">
                一鍵送給所有<span class="text-ink dark:text-paper">已綁定 LINE</span> 的賓客。
              </p>
              <UButton class="mt-4" color="neutral" variant="solid" block @click="openBatch">
                群發感謝訊息
              </UButton>
            </div>
            <!-- B 替代感謝 -->
            <div class="flex flex-col rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex items-center gap-2 text-gold-deep">
                <UIcon name="i-heroicons-envelope" class="size-5" />
                <p class="font-display text-body-l font-medium text-ink dark:text-paper">
                  替代感謝（Email／連結）
                </p>
              </div>
              <p class="mt-2 flex-1 text-body text-ink-500 dark:text-neutral-400">
                給<span class="text-ink dark:text-paper">未加 LINE 好友</span>的賓客，改用 Email 或專屬連結逐一送達。
              </p>
              <UButton class="mt-4" color="neutral" variant="outline" block @click="openFallback">
                替代感謝
              </UButton>
            </div>
            <!-- C 複製專屬謝卡連結 -->
            <div class="flex flex-col rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex items-center gap-2 text-gold-deep">
                <UIcon name="i-heroicons-link" class="size-5" />
                <p class="font-display text-body-l font-medium text-ink dark:text-paper">
                  賓客專屬連結
                </p>
              </div>
              <p class="mt-2 flex-1 text-body text-ink-500 dark:text-neutral-400">
                為任一賓客複製<span class="text-ink dark:text-paper">專屬謝卡連結</span>，可自行分享（賓客開啟即見信封與謝卡）。
              </p>
              <USelectMenu
                v-model="linkGuestId"
                data-testid="thankyou-link-guest-select"
                :items="guestOptions"
                value-key="value"
                placeholder="選擇賓客"
                class="mt-4 w-full"
              />
              <UButton
                data-testid="thankyou-copy-link"
                class="mt-3"
                color="neutral"
                variant="solid"
                icon="i-heroicons-clipboard-document"
                block
                @click="copyThankYouLink(linkGuestId)"
              >
                複製謝卡連結
              </UButton>
            </div>
          </div>
          <!-- 群發結果 -->
          <section
            v-if="batchResultCount !== null"
            data-testid="batch-result"
            class="mt-4 rounded-lg border border-line border-l-[3px] border-l-gold bg-paper p-5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p class="text-ink-700 dark:text-neutral-300">
              已發送給 {{ batchResultCount }} 位賓客
            </p>
            <!-- 發送失敗清單（issue #72）：可見、可單獨重發，不靜默吞掉 -->
            <div
              v-if="batchFailedGuests.length > 0"
              data-testid="batch-failed-list"
              class="mt-4 border-t border-line pt-4 dark:border-neutral-800"
            >
              <p class="text-body font-medium text-error">
                發送失敗 {{ batchFailedGuests.length }} 位，可逐一重發：
              </p>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="g in batchFailedGuests"
                  :key="g.guestId"
                  class="flex items-center justify-between gap-3"
                >
                  <span class="text-body text-ink-700 dark:text-neutral-300">{{ g.name }}</span>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    :loading="resendingGuestId === g.guestId"
                    :disabled="!!resendingGuestId && resendingGuestId !== g.guestId"
                    @click="resendToGuest(g)"
                  >
                    重發
                  </UButton>
                </li>
              </ul>
            </div>
          </section>
        </section>
      </div>
    </div>

    <!-- 群發感謝確認 -->
    <UModal v-model:open="isBatchOpen">
      <template #content>
        <div data-testid="batch-modal" class="p-6">
          <h3 class="text-body-l font-semibold text-ink dark:text-paper">
            群發感謝訊息
          </h3>
          <p class="mt-2 text-neutral-500 dark:text-neutral-400">
            將透過 LINE 群發感謝訊息給已綁定 LINE 的賓客，確定要發送嗎？
          </p>

          <!-- 配額確認提示（issue #72）：告知則數，額度由使用者自行判斷 -->
          <div
            data-testid="batch-send-count"
            class="mt-4 rounded-lg bg-paper p-4 dark:bg-neutral-800"
          >
            <p class="text-body font-medium text-ink dark:text-paper">
              本次將發送 {{ boundGuestCount }} 則／本月剩餘額度不明
            </p>
            <p class="mt-1 text-caption text-ink-500 dark:text-neutral-400">
              LINE 免費方案每月上限 200 則且不可加購，請自行評估本月用量後再發送。
            </p>
          </div>

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
          <h3 class="mb-4 text-body-l font-semibold text-ink dark:text-paper">
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
