<!-- app/pages/reception/index.vue -->
<script setup lang="ts">
import type { ReceptionStatusItem } from '~~/server/api/v1/weddings/[weddingId]/reception-status.get'

import type { CakeBoxTypeListItem } from '~/types/api/cakebox'
import type { GuestListItem } from '~/types/api/guests'
import type {
  CakeBoxDistributedEvent,
  DistributeCakeBoxBody,
  GiftMoneyRecordedEvent,
  GiftMoneyUpdatedEvent,
  GuestCheckedInEvent,
  RecordGiftMoneyBody,
  UpdateGiftMoneyBody,
} from '~/types/api/reception'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
// weddingId 由查詢字串帶入（沿用既有模式），預設 wedding-001
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

// 賓客清單
const { data: guests } = await useFetch<GuestListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/guests`,
  { default: () => [] },
)

// 喜餅款式（供發放選擇）
const { data: cakeBoxTypes } = await useFetch<CakeBoxTypeListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/cake-box-types`,
  { default: () => [] },
)

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

const cakeTypeOptions = computed(() =>
  (cakeBoxTypes.value ?? []).map(t => ({ label: t.name, value: t.cakeBoxTypeId })),
)

function cakeTypeName(typeId: string | null): string {
  if (!typeId)
    return ''
  return (cakeBoxTypes.value ?? []).find(t => t.cakeBoxTypeId === typeId)?.name ?? ''
}

// 接待狀態：報到 / 禮金 / 喜餅
// GuestListItem 不含接待狀態欄位，改由 reception-status 端點取得，操作後就地更新
type ReceptionStatus = Omit<ReceptionStatusItem, 'guestId'>
const status = reactive<Record<string, ReceptionStatus>>({})

const { data: receptionStatus } = await useFetch<ReceptionStatusItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/reception-status`,
  { default: () => [] },
)

watchEffect(() => {
  for (const item of receptionStatus.value ?? []) {
    status[item.guestId] = {
      checkedIn: item.checkedIn,
      giftAmount: item.giftAmount,
      cakeBoxTypeId: item.cakeBoxTypeId,
    }
  }
})

function ensureStatus(guestId: string): ReceptionStatus {
  if (!status[guestId])
    status[guestId] = { checkedIn: false, giftAmount: null, cakeBoxTypeId: null }
  return status[guestId]!
}

// === 報到 ===
const checkingInId = ref<string | null>(null)
async function checkIn(guest: GuestListItem) {
  if (checkingInId.value)
    return
  checkingInId.value = guest.guestId
  try {
    await $fetch<GuestCheckedInEvent>(
      `/api/v1/weddings/${weddingId.value}/guests/${guest.guestId}/check-in`,
      { method: 'POST' },
    )
    ensureStatus(guest.guestId).checkedIn = true
    toast.add({ title: `${guest.name} 報到成功`, color: 'success' })
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '報到失敗，請稍後再試'
    toast.add({ title: '報到失敗', description: message, color: 'error' })
  }
  finally {
    checkingInId.value = null
  }
}

// === 禮金登記 / 更正 ===
const isGiftOpen = ref(false)
const isGiftSubmitting = ref(false)
const giftError = ref('')
const giftTarget = ref<GuestListItem | null>(null)
const giftIsUpdate = ref(false)
const giftAmount = ref<number | null>(null)

function openGift(guest: GuestListItem) {
  giftTarget.value = guest
  giftError.value = ''
  const current = ensureStatus(guest.guestId).giftAmount
  giftIsUpdate.value = current !== null
  giftAmount.value = current
  isGiftOpen.value = true
}

async function submitGift() {
  if (!giftTarget.value || isGiftSubmitting.value)
    return
  const amount = Number(giftAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) {
    giftError.value = '請輸入禮金金額'
    return
  }
  isGiftSubmitting.value = true
  giftError.value = ''
  const guestId = giftTarget.value.guestId
  const url = `/api/v1/weddings/${weddingId.value}/guests/${guestId}/gift-money`
  try {
    if (giftIsUpdate.value) {
      const body: UpdateGiftMoneyBody = { amount }
      await $fetch<GiftMoneyUpdatedEvent>(url, { method: 'PATCH', body })
      toast.add({ title: '禮金已更正', color: 'success' })
    }
    else {
      const body: RecordGiftMoneyBody = { amount }
      await $fetch<GiftMoneyRecordedEvent>(url, { method: 'POST', body })
      toast.add({ title: '禮金登記成功', color: 'success' })
    }
    ensureStatus(guestId).giftAmount = amount
    isGiftOpen.value = false
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複觸發 strict mode）
    giftError.value
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isGiftSubmitting.value = false
  }
}

// === 喜餅發放 ===
const isCakeOpen = ref(false)
const isCakeSubmitting = ref(false)
const cakeError = ref('')
const cakeTarget = ref<GuestListItem | null>(null)
const cakeTypeId = ref('')

function openCake(guest: GuestListItem) {
  cakeTarget.value = guest
  cakeError.value = ''
  cakeTypeId.value = ''
  isCakeOpen.value = true
}

async function submitCake() {
  if (!cakeTarget.value || isCakeSubmitting.value)
    return
  if (!cakeTypeId.value) {
    cakeError.value = '請選擇喜餅款式'
    return
  }
  isCakeSubmitting.value = true
  cakeError.value = ''
  const guestId = cakeTarget.value.guestId
  try {
    const body: DistributeCakeBoxBody = { cakeBoxTypeId: cakeTypeId.value }
    await $fetch<CakeBoxDistributedEvent>(
      `/api/v1/weddings/${weddingId.value}/guests/${guestId}/cake-box-distribution`,
      { method: 'POST', body },
    )
    ensureStatus(guestId).cakeBoxTypeId = cakeTypeId.value
    toast.add({ title: '喜餅發放成功', color: 'success' })
    isCakeOpen.value = false
  }
  catch (error: any) {
    cakeError.value
      = error?.data?.message || error?.statusMessage || '發放失敗，請稍後再試'
  }
  finally {
    isCakeSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="reception-page" class="flex h-full flex-col">
    <PageHeader title="接待台" description="賓客報到、禮金登記與喜餅發放" />

    <div class="min-h-0 flex-1 overflow-auto">
      <table
        data-testid="reception-list"
        class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        <thead class="bg-neutral-50 dark:bg-neutral-900">
          <tr class="text-left text-sm text-neutral-500 dark:text-neutral-400">
            <th class="px-4 py-3 font-medium">
              賓客
            </th>
            <th class="px-4 py-3 font-medium">
              報到
            </th>
            <th class="px-4 py-3 font-medium">
              禮金
            </th>
            <th class="px-4 py-3 font-medium">
              喜餅
            </th>
            <th class="px-4 py-3 text-right font-medium">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="guest in activeGuests"
            :key="guest.guestId"
            :data-testid="`reception-row-${guest.guestId}`"
            :aria-label="guest.name"
            class="border-t border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <td class="px-4 py-3">
              <span class="font-medium text-neutral-900 dark:text-white">
                {{ guest.name }}
              </span>
            </td>

            <!-- 報到狀態 -->
            <td class="px-4 py-3">
              <UBadge
                v-if="status[guest.guestId]?.checkedIn"
                color="success"
                variant="soft"
                size="sm"
              >
                已報到
              </UBadge>
              <span v-else class="text-sm text-neutral-400">未報到</span>
            </td>

            <!-- 禮金狀態 -->
            <td class="px-4 py-3">
              <span
                v-if="status[guest.guestId]?.giftAmount != null"
                class="font-medium text-neutral-900 dark:text-white"
              >
                {{ status[guest.guestId]!.giftAmount!.toLocaleString('en-US') }}
              </span>
              <span v-else class="text-sm text-neutral-400">未登記</span>
            </td>

            <!-- 喜餅狀態 -->
            <td class="px-4 py-3">
              <UBadge
                v-if="status[guest.guestId]?.cakeBoxTypeId"
                color="primary"
                variant="soft"
                size="sm"
              >
                已發放（{{ cakeTypeName(status[guest.guestId]!.cakeBoxTypeId) }}）
              </UBadge>
              <span v-else class="text-sm text-neutral-400">未發放</span>
            </td>

            <!-- 操作 -->
            <td class="px-4 py-3 text-right">
              <div class="flex flex-wrap justify-end gap-1">
                <UButton
                  v-if="!status[guest.guestId]?.checkedIn"
                  :data-testid="`reception-checkin-${guest.guestId}`"
                  color="primary"
                  variant="soft"
                  size="sm"
                  :loading="checkingInId === guest.guestId"
                  :aria-label="`報到 ${guest.name}`"
                  @click="checkIn(guest)"
                >
                  報到
                </UButton>

                <UButton
                  :data-testid="`reception-gift-${guest.guestId}`"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="openGift(guest)"
                >
                  {{ status[guest.guestId]?.giftAmount != null ? '更正' : '登記禮金' }}
                </UButton>

                <UButton
                  v-if="!status[guest.guestId]?.cakeBoxTypeId"
                  :data-testid="`reception-cake-${guest.guestId}`"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="openCake(guest)"
                >
                  發放喜餅
                </UButton>
              </div>
            </td>
          </tr>

          <tr v-if="activeGuests.length === 0">
            <td colspan="5">
              <EmptyState title="目前沒有賓客" description="請先於賓客管理新增賓客" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 禮金登記 / 更正 Modal -->
    <UModal v-model:open="isGiftOpen">
      <template #content>
        <div data-testid="reception-gift-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            {{ giftIsUpdate ? '更正禮金' : '登記禮金' }}（{{ giftTarget?.name }}）
          </h3>

          <UAlert
            v-if="giftError"
            data-testid="reception-gift-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="giftError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="金額" name="amount">
              <UInput
                v-model.number="giftAmount"
                data-testid="reception-gift-amount"
                type="number"
                min="0"
                placeholder="請輸入禮金金額"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isGiftSubmitting"
                @click="isGiftOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="reception-gift-submit"
                color="primary"
                :loading="isGiftSubmitting"
                @click="submitGift"
              >
                {{ giftIsUpdate ? '確定更正' : '確定登記' }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 喜餅發放 Modal -->
    <UModal v-model:open="isCakeOpen">
      <template #content>
        <div data-testid="reception-cake-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            發放喜餅（{{ cakeTarget?.name }}）
          </h3>

          <UAlert
            v-if="cakeError"
            data-testid="reception-cake-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="cakeError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="喜餅款式" name="cakeBoxTypeId">
              <USelectMenu
                v-model="cakeTypeId"
                data-testid="distribute-cake-select"
                :items="cakeTypeOptions"
                value-key="value"
                placeholder="選擇喜餅款式"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isCakeSubmitting"
                @click="isCakeOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="reception-cake-submit"
                color="primary"
                :loading="isCakeSubmitting"
                @click="submitCake"
              >
                確定發放
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
