<!-- app/pages/weddings/[weddingId]/gifts.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateGiftItemBody,
  GiftCategory,
  GiftItemListItem,
  UpdateGiftItemBody,
} from '~/types/api/gifts'

import { z } from 'zod'
import {
  createGiftItem,
  deleteGiftItem,
  listGiftItems,
  listGuests,
  listTables,
  updateGiftItem,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))
const { uploadImage } = useImageUpload()

// 禮物品項清單
const { data: giftItems, refresh } = await listGiftItems(
  weddingId,
  { default: () => [] },
)

// 賓客與桌次（採買參考數來源）
const { data: guests } = await listGuests(
  weddingId,
  { default: () => [] },
)
const { data: tables } = await listTables(
  weddingId,
  { default: () => [] },
)

// === 六類固定區塊（中文 label map）===
const GIFT_CATEGORIES: { value: GiftCategory, label: string }[] = [
  { value: 'table', label: '桌上禮' },
  { value: 'second_entrance', label: '二進禮' },
  { value: 'game', label: '遊戲禮' },
  { value: 'send_off', label: '送客禮' },
  { value: 'room_visit', label: '探房禮' },
  { value: 'tea_ceremony', label: '喝茶禮' },
]
const categoryOptions = GIFT_CATEGORIES.map(c => ({ label: c.label, value: c.value }))

const itemsByCategory = computed(() => {
  const map = {} as Record<GiftCategory, GiftItemListItem[]>
  for (const c of GIFT_CATEGORIES)
    map[c.value] = []
  for (const item of giftItems.value ?? [])
    map[item.category].push(item)
  return map
})

// === 金額讀模型（前端計算不落庫）===
// 小計＝單價×數量；品項總計＝小計＋運費一＋運費二＋其他費用
function itemSubtotal(item: GiftItemListItem): number {
  return item.unitPrice * item.quantity
}
function itemTotal(item: GiftItemListItem): number {
  return itemSubtotal(item) + item.shippingFee1 + item.shippingFee2 + item.otherFee
}

const subtotalByCategory = computed(() => {
  const map = {} as Record<GiftCategory, number>
  for (const c of GIFT_CATEGORIES)
    map[c.value] = itemsByCategory.value[c.value].reduce((sum, item) => sum + itemTotal(item), 0)
  return map
})
const grandTotal = computed(() =>
  Object.values(subtotalByCategory.value).reduce((sum, n) => sum + n, 0),
)

function formatPrice(n: number): string {
  return `NT$ ${n.toLocaleString('zh-TW')}`
}

// === 採買參考數（與賓客/桌次資料一致）===
// 出席大人＝Σ(partySize−childChairCount)、兒童椅＝Σ childChairCount（出席且未刪除者）
const attendingGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt && g.rsvpAttending === 'attending'),
)
const refAdults = computed(() =>
  attendingGuests.value.reduce((sum, g) => sum + (g.partySize - g.childChairCount), 0),
)
const refChildren = computed(() =>
  attendingGuests.value.reduce((sum, g) => sum + g.childChairCount, 0),
)
const refTables = computed(() => (tables.value ?? []).length)

// === 新增 / 編輯品項表單 ===
const schema = z.object({
  description: z.string().trim().min(1, '請輸入款式說明'),
})

type Schema = z.output<typeof schema>

const isFormOpen = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const editingId = ref<string | null>(null)
const state = reactive<Schema>({ description: '' })
// 數字欄以文字暫存（UInput type=number 會在 runtime 回填數字），送出時 Number() 收斂；未填費用預設 0
const draft = reactive({
  category: 'table' as GiftCategory,
  unitPrice: '',
  quantity: '',
  shippingFee1: '',
  shippingFee2: '',
  otherFee: '',
  purchaseUrl: '',
  distributionTime: '',
  note: '',
  imageUrl: '',
})
// 隱藏的檔案 input，由 outline 上傳鈕觸發
const imageInputRef = ref<HTMLInputElement>()

function toNumber(value: string | number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function resetDraft() {
  state.description = ''
  draft.category = 'table'
  draft.unitPrice = ''
  draft.quantity = ''
  draft.shippingFee1 = ''
  draft.shippingFee2 = ''
  draft.otherFee = ''
  draft.purchaseUrl = ''
  draft.distributionTime = ''
  draft.note = ''
  draft.imageUrl = ''
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  resetDraft()
  isFormOpen.value = true
}

// 編輯以複製草稿呈現，不就地 mutate useFetch data（shallowRef）
function openEdit(item: GiftItemListItem) {
  editingId.value = item.giftItemId
  formError.value = ''
  state.description = item.description
  draft.category = item.category
  draft.unitPrice = String(item.unitPrice)
  draft.quantity = String(item.quantity)
  draft.shippingFee1 = String(item.shippingFee1)
  draft.shippingFee2 = String(item.shippingFee2)
  draft.otherFee = String(item.otherFee)
  draft.purchaseUrl = item.purchaseUrl ?? ''
  draft.distributionTime = item.distributionTime ?? ''
  draft.note = item.note ?? ''
  draft.imageUrl = item.imageUrl ?? ''
  isFormOpen.value = true
}

// 選檔縮圖：讀檔 → canvas 縮到最長邊 400px → 轉 jpeg data URL（避免大檔塞爆記憶體 mock）
function onPickImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 400 / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h)
        draft.imageUrl = canvas.toDataURL('image/jpeg', 0.8)
      }
      else {
        draft.imageUrl = String(reader.result)
      }
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(file)
  input.value = '' // 允許重選同一檔
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  formError.value = ''
  try {
    // R2 啟用時縮圖先直傳（已是 URL 則原樣返回）；本機模式維持 dataURL
    const imageUrl = draft.imageUrl
      ? await uploadImage(draft.imageUrl, weddingId.value, 'gift')
      : ''
    if (editingId.value) {
      const body: UpdateGiftItemBody = {
        category: draft.category,
        description: event.data.description,
        unitPrice: toNumber(draft.unitPrice),
        quantity: toNumber(draft.quantity),
        shippingFee1: toNumber(draft.shippingFee1),
        shippingFee2: toNumber(draft.shippingFee2),
        otherFee: toNumber(draft.otherFee),
        imageUrl,
        purchaseUrl: draft.purchaseUrl.trim(),
        distributionTime: draft.distributionTime.trim(),
        note: draft.note.trim(),
      }
      await updateGiftItem(weddingId.value, editingId.value, body)
      toast.add({ title: '禮物品項已更新', color: 'success' })
    }
    else {
      const body: CreateGiftItemBody = {
        category: draft.category,
        description: event.data.description,
        unitPrice: toNumber(draft.unitPrice),
        quantity: toNumber(draft.quantity),
        shippingFee1: toNumber(draft.shippingFee1),
        shippingFee2: toNumber(draft.shippingFee2),
        otherFee: toNumber(draft.otherFee),
        imageUrl: imageUrl || undefined,
        purchaseUrl: draft.purchaseUrl.trim() || undefined,
        distributionTime: draft.distributionTime.trim() || undefined,
        note: draft.note.trim() || undefined,
      }
      await createGiftItem(weddingId.value, body)
      toast.add({ title: '禮物品項新增成功', color: 'success' })
    }
    isFormOpen.value = false
    await refresh()
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複造成測試 strict mode violation）
    formError.value
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}

// === 移除品項（經確認彈窗）===
const isRemoveOpen = ref(false)
const isRemoving = ref(false)
const removeTarget = ref<GiftItemListItem | null>(null)

function openRemove(item: GiftItemListItem) {
  removeTarget.value = item
  isRemoveOpen.value = true
}

async function confirmRemove() {
  if (!removeTarget.value || isRemoving.value)
    return
  isRemoving.value = true
  try {
    await deleteGiftItem(weddingId.value, removeTarget.value.giftItemId)
    toast.add({ title: '禮物品項已移除', color: 'success' })
    isRemoveOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '移除失敗，請稍後再試'
    toast.add({ title: '移除失敗', description: message, color: 'error' })
  }
  finally {
    isRemoving.value = false
  }
}
</script>

<template>
  <div data-testid="gifts-page" class="flex h-full flex-col">
    <PageHeader
      title="婚禮小物"
      :eyebrow="`Wedding Favors · ${(giftItems ?? []).length} 項`"
      description="規劃六類婚禮小物品項與費用總覽"
    >
      <template #actions>
        <UButton
          data-testid="gift-create"
          icon="i-heroicons-plus"
          color="neutral"
          variant="solid"
          @click="openCreate"
        >
          新增禮物品項
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto pr-4">
      <!-- 採買參考：單一凹陷條，三個 inline 數字（testid 容器需含數字，勿拆離） -->
      <div class="mb-8 flex flex-wrap gap-y-3 divide-x divide-line rounded-lg bg-paper p-4 dark:divide-neutral-800 dark:bg-neutral-800/60">
        <div data-testid="gift-ref-adults" class="min-w-32 flex-1 px-5 first:pl-1">
          <p class="text-overline uppercase text-gold-deep">
            出席大人
          </p>
          <p class="mt-1 flex items-baseline gap-1">
            <span class="font-display text-h2 font-semibold text-ink dark:text-paper">{{ refAdults }}</span>
            <span class="text-caption text-ink-300">位（已扣兒童椅）</span>
          </p>
        </div>
        <div data-testid="gift-ref-children" class="min-w-32 flex-1 px-5">
          <p class="text-overline uppercase text-gold-deep">
            兒童椅
          </p>
          <p class="mt-1 flex items-baseline gap-1">
            <span class="font-display text-h2 font-semibold text-ink dark:text-paper">{{ refChildren }}</span>
            <span class="text-caption text-ink-300">位</span>
          </p>
        </div>
        <div data-testid="gift-ref-tables" class="min-w-32 flex-1 px-5">
          <p class="text-overline uppercase text-gold-deep">
            桌數
          </p>
          <p class="mt-1 flex items-baseline gap-1">
            <span class="font-display text-h2 font-semibold text-ink dark:text-paper">{{ refTables }}</span>
            <span class="text-caption text-ink-300">桌</span>
          </p>
        </div>
      </div>

      <!-- 六類固定區塊：類別為「章節」直接落在頁面底色上，品項才是卡片 -->
      <div class="space-y-8">
        <section
          v-for="cat in GIFT_CATEGORIES"
          :key="cat.value"
          :data-testid="`gift-category-${cat.value}`"
        >
          <div class="mb-4 flex items-baseline gap-3">
            <h2 class="text-body-l font-semibold text-ink dark:text-paper">
              {{ cat.label }}
            </h2>
            <span class="text-caption text-ink-400 dark:text-neutral-500">
              {{ itemsByCategory[cat.value].length }} 項
            </span>
            <span class="h-px flex-1 bg-line" />
          </div>

          <EmptyState
            v-if="itemsByCategory[cat.value].length === 0"
            :title="`尚無${cat.label}品項`"
            description="點擊右上「新增禮物品項」加入"
          />

          <div v-else class="space-y-3">
            <!-- 品項卡：aria-label 僅放款式說明（識別名，不含數值/狀態） -->
            <article
              v-for="item in itemsByCategory[cat.value]"
              :key="item.giftItemId"
              :aria-label="item.description"
              class="flex flex-wrap gap-4 rounded-lg border border-line bg-white p-4 shadow-sm transition-colors hover:bg-cream dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/40"
            >
              <!-- 縮圖（無圖以禮物 icon 佔位） -->
              <div class="size-16 shrink-0 overflow-hidden rounded-md border border-line bg-white dark:border-neutral-700 dark:bg-neutral-800">
                <img
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  :alt="item.description"
                  class="size-full object-cover"
                >
                <div v-else class="flex size-full items-center justify-center text-ink-300">
                  <UIcon name="i-heroicons-gift" class="size-6" />
                </div>
              </div>

              <!-- 主資訊：說明、金額明細、發放時間、備註 -->
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 class="text-body font-medium text-ink dark:text-paper">
                    {{ item.description }}
                  </h3>
                  <a
                    v-if="item.purchaseUrl"
                    :href="item.purchaseUrl"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 text-caption text-gold-deep underline underline-offset-2"
                  >
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="size-3.5" />
                    購買網址
                  </a>
                </div>
                <p class="mt-1 text-caption text-ink-500 dark:text-neutral-400">
                  {{ formatPrice(item.unitPrice) }} × {{ item.quantity }} ＝ 小計 {{ formatPrice(itemSubtotal(item)) }}
                </p>
                <p class="mt-0.5 text-caption text-ink-400 dark:text-neutral-500">
                  運費一 {{ formatPrice(item.shippingFee1) }} · 運費二 {{ formatPrice(item.shippingFee2) }} · 其他費用 {{ formatPrice(item.otherFee) }}
                </p>
                <p v-if="item.distributionTime" class="mt-0.5 text-caption text-ink-400 dark:text-neutral-500">
                  預計發放：{{ item.distributionTime }}
                </p>
                <p v-if="item.note" class="mt-0.5 text-caption text-ink-500 dark:text-neutral-400">
                  備註：{{ item.note }}
                </p>
              </div>

              <!-- 品項總計 + 動作 -->
              <div class="flex shrink-0 flex-col items-end justify-between gap-2">
                <div class="text-right">
                  <p class="text-overline uppercase text-ink-300">
                    品項總計
                  </p>
                  <p class="font-display text-body-l font-semibold text-gold-deep">
                    {{ formatPrice(itemTotal(item)) }}
                  </p>
                </div>
                <div class="flex items-center gap-1">
                  <UButton
                    data-testid="gift-edit"
                    icon="i-heroicons-pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="`編輯 ${item.description}`"
                    @click="openEdit(item)"
                  />
                  <UButton
                    data-testid="gift-remove"
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :aria-label="`移除 ${item.description}`"
                    @click="openRemove(item)"
                  />
                </div>
              </div>
            </article>
          </div>

          <!-- 類別小計 -->
          <div class="mt-4 flex items-baseline justify-end gap-2 border-t border-line/70 pt-3 dark:border-neutral-800">
            <span class="text-caption text-ink-500 dark:text-neutral-400">{{ cat.label }}小計</span>
            <span
              :data-testid="`gift-category-subtotal-${cat.value}`"
              class="font-display text-body-l font-semibold text-gold-deep"
            >
              {{ formatPrice(subtotalByCategory[cat.value]) }}
            </span>
          </div>
        </section>
      </div>

      <!-- 全部總額卡 -->
      <div class="my-6 rounded-xl bg-ink p-6 text-cream">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <span class="text-overline uppercase text-gold">全部總額</span>
          <span data-testid="gift-grand-total" class="font-display text-h2 font-semibold text-gold">
            {{ formatPrice(grandTotal) }}
          </span>
        </div>
        <p class="mt-2 text-caption text-ink-300">
          六類品項總計加總（含運費與其他費用）
        </p>
      </div>
    </div>

    <!-- 新增 / 編輯品項 Modal -->
    <!-- 攔 focusOutside：點縮圖上傳開啟系統檔案視窗會搶走焦點，預設會被當成「點外面」而關閉 modal -->
    <UModal
      v-model:open="isFormOpen"
      :content="{ onFocusOutside: (e) => e.preventDefault() }"
    >
      <template #content>
        <div data-testid="gift-form-modal" class="max-h-[85vh] overflow-y-auto p-6">
          <h3 class="mb-4 font-display text-body-l font-semibold text-ink dark:text-paper">
            {{ editingId ? '編輯禮物品項' : '新增禮物品項' }}
          </h3>

          <UAlert
            v-if="formError"
            data-testid="gift-form-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="formError"
            class="mb-4"
          />

          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField
              label="款式說明"
              name="description"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.description"
                data-testid="gift-description"
                placeholder="如：拉花小熊桌上禮"
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="單價" name="unitPrice">
                <UInput
                  v-model="draft.unitPrice"
                  data-testid="gift-unit-price"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full"
                >
                  <template #leading>
                    <span class="text-caption text-ink-400">NT$</span>
                  </template>
                </UInput>
              </UFormField>
              <UFormField label="數量" name="quantity">
                <UInput
                  v-model="draft.quantity"
                  data-testid="gift-quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <UFormField label="運費一" name="shippingFee1">
                <UInput
                  v-model="draft.shippingFee1"
                  data-testid="gift-shipping-fee-1"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="運費二" name="shippingFee2">
                <UInput
                  v-model="draft.shippingFee2"
                  data-testid="gift-shipping-fee-2"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="其他費用" name="otherFee">
                <UInput
                  v-model="draft.otherFee"
                  data-testid="gift-other-fee"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="購買網址" name="purchaseUrl">
              <UInput
                v-model="draft.purchaseUrl"
                data-testid="gift-purchase-url"
                type="url"
                placeholder="https://…（選填）"
                class="w-full"
              />
            </UFormField>

            <UFormField label="預計發放時間" name="distributionTime">
              <UInput
                v-model="draft.distributionTime"
                data-testid="gift-distribution-time"
                placeholder="如：二進後、18:30（選填）"
                class="w-full"
              />
            </UFormField>

            <UFormField label="備註" name="note">
              <UTextarea
                v-model="draft.note"
                data-testid="gift-note"
                :rows="2"
                placeholder="備註（選填）"
                class="w-full"
              />
            </UFormField>

            <UFormField label="縮圖" name="imageUrl">
              <div class="flex items-center gap-4">
                <div class="size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-white dark:border-neutral-800 dark:bg-neutral-800">
                  <img
                    v-if="draft.imageUrl"
                    :src="draft.imageUrl"
                    alt="縮圖預覽"
                    class="size-full object-cover"
                  >
                  <div v-else class="flex size-full items-center justify-center text-ink-300">
                    <UIcon name="i-heroicons-photo" class="size-6" />
                  </div>
                </div>
                <!-- 隱藏 input + outline 次要鈕 -->
                <div class="flex flex-col items-start gap-1.5">
                  <input
                    ref="imageInputRef"
                    type="file"
                    accept="image/*"
                    data-testid="gift-image"
                    class="hidden"
                    @change="onPickImage"
                  >
                  <UButton
                    type="button"
                    icon="i-heroicons-arrow-up-tray"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="imageInputRef?.click()"
                  >
                    {{ draft.imageUrl ? '更換圖片' : '上傳圖片' }}
                  </UButton>
                  <UButton
                    v-if="draft.imageUrl"
                    type="button"
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="xs"
                    @click="draft.imageUrl = ''"
                  >
                    移除圖片
                  </UButton>
                </div>
              </div>
            </UFormField>

            <!-- 類別下拉置於表單最後：文字/數字欄先填、下拉最後選的操作順序也順手 -->
            <UFormField label="類別" name="category">
              <USelectMenu
                v-model="draft.category"
                data-testid="gift-category-select"
                :items="categoryOptions"
                value-key="value"
                placeholder="選擇類別"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
                @click="isFormOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="gift-submit"
                color="neutral"
                variant="solid"
                :loading="isSubmitting"
              >
                {{ editingId ? '儲存' : '新增' }}
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 移除確認 -->
    <ConfirmModal
      v-model:open="isRemoveOpen"
      title="確認移除"
      :description="`確定要移除禮物品項「${removeTarget?.description ?? ''}」嗎？`"
      confirm-label="移除"
      confirm-color="error"
      :loading="isRemoving"
      @confirm="confirmRemove"
    />
  </div>
</template>
