<!-- app/pages/weddings/[weddingId]/blessings.vue -->
<script setup lang="ts">
import type {
  BlessingListItem,
  BlessingStatus,
  RejectBlessingBody,
} from '~/types/api/blessings'
import { approveBlessing, listBlessings, rejectBlessing } from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

const { data: blessings } = await listBlessings(weddingId, { default: () => [] })

const items = computed(() => blessings.value ?? [])

const STATUS_LABEL: Record<BlessingStatus, string> = {
  submitted: '待審',
  approved: '已通過',
  rejected: '已拒絕',
}
const STATUS_COLOR: Record<BlessingStatus, 'warning' | 'success' | 'error'> = {
  submitted: 'warning',
  approved: 'success',
  rejected: 'error',
}

// 頭像金圓首字：取留言內容首字作為編輯式裝飾（無姓名欄位時的視覺替代）
function initialOf(blessing: BlessingListItem) {
  return blessing.message.trim().charAt(0) || '祝'
}

function setStatus(blessingId: string, status: BlessingStatus, reason: string | null = null) {
  // useFetch 的 data 為 shallowRef，深層 mutate 不觸發響應；以重新賦值整個陣列觸發更新
  blessings.value = (blessings.value ?? []).map(b =>
    b.blessingId === blessingId ? { ...b, status, rejectReason: reason } : b,
  )
}

// === 審核通過 ===
const isApproveOpen = ref(false)
const isApproving = ref(false)
const approveTarget = ref<BlessingListItem | null>(null)

function openApprove(blessing: BlessingListItem) {
  approveTarget.value = blessing
  isApproveOpen.value = true
}

async function confirmApprove() {
  if (!approveTarget.value || isApproving.value)
    return
  isApproving.value = true
  const blessingId = approveTarget.value.blessingId
  try {
    const res = await approveBlessing(weddingId.value, blessingId)
    setStatus(blessingId, res.status)
    toast.add({ title: '祝福已通過', color: 'success' })
    isApproveOpen.value = false
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '審核失敗，請稍後再試'
    toast.add({ title: '審核失敗', description: message, color: 'error' })
  }
  finally {
    isApproving.value = false
  }
}

// === 審核拒絕 ===
const isRejectOpen = ref(false)
const isRejecting = ref(false)
const rejectError = ref('')
const rejectTarget = ref<BlessingListItem | null>(null)
const rejectReason = ref('')

function openReject(blessing: BlessingListItem) {
  rejectTarget.value = blessing
  rejectReason.value = ''
  rejectError.value = ''
  isRejectOpen.value = true
}

async function submitReject() {
  if (!rejectTarget.value || isRejecting.value)
    return
  if (!rejectReason.value.trim()) {
    rejectError.value = '請輸入拒絕原因'
    return
  }
  isRejecting.value = true
  rejectError.value = ''
  const blessingId = rejectTarget.value.blessingId
  try {
    const body: RejectBlessingBody = { reason: rejectReason.value.trim() }
    const res = await rejectBlessing(weddingId.value, blessingId, body)
    setStatus(blessingId, res.status, res.reason)
    toast.add({ title: '祝福已拒絕', color: 'success' })
    isRejectOpen.value = false
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複觸發 strict mode）
    rejectError.value
      = error?.data?.message || error?.statusMessage || '審核失敗，請稍後再試'
  }
  finally {
    isRejecting.value = false
  }
}
</script>

<template>
  <div data-testid="blessings-page" class="flex h-full flex-col">
    <PageHeader
      title="祝福審核"
      eyebrow="Guest Blessings"
      description="審核賓客提交的祝福留言（通過 / 拒絕）"
    />

    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="items.length === 0">
        <EmptyState title="目前沒有祝福" description="賓客提交祝福後會顯示於此" />
      </div>

      <ul v-else class="space-y-4">
        <li
          v-for="blessing in items"
          :key="blessing.blessingId"
          :data-testid="`blessing-row-${blessing.blessingId}`"
          :aria-label="blessing.message"
          class="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div class="flex items-start gap-5">
            <!-- 頭像金圓 + Cormorant 首字 -->
            <div
              class="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-light font-display text-2xl text-gold-deep"
              aria-hidden="true"
            >
              {{ initialOf(blessing) }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <p class="text-caption uppercase tracking-wide text-ink-500">
                  賓客 · {{ blessing.guestId }}
                </p>
                <div class="flex shrink-0 items-center gap-2">
                  <UBadge
                    :color="STATUS_COLOR[blessing.status]"
                    variant="soft"
                    size="sm"
                  >
                    {{ STATUS_LABEL[blessing.status] }}
                  </UBadge>
                </div>
              </div>

              <p class="mt-2 text-body-l leading-relaxed text-ink-700 dark:text-neutral-200">
                {{ blessing.message }}
              </p>

              <img
                v-if="blessing.photoUrl"
                :src="blessing.photoUrl"
                alt="祝福照片"
                class="mt-3 max-h-32 rounded-lg border border-line object-cover"
              >
              <p
                v-if="blessing.rejectReason"
                class="mt-2 border-l-[3px] border-gold pl-3 text-body text-ink-500"
              >
                拒絕原因：{{ blessing.rejectReason }}
              </p>

              <div
                v-if="blessing.status === 'submitted'"
                class="mt-4 flex gap-2 border-t border-line pt-4"
              >
                <UButton
                  :data-testid="`blessing-approve-${blessing.blessingId}`"
                  color="neutral"
                  variant="solid"
                  size="sm"
                  @click="openApprove(blessing)"
                >
                  通過
                </UButton>
                <UButton
                  :data-testid="`blessing-reject-${blessing.blessingId}`"
                  color="error"
                  variant="outline"
                  size="sm"
                  @click="openReject(blessing)"
                >
                  拒絕
                </UButton>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- 審核通過確認 -->
    <ConfirmModal
      v-model:open="isApproveOpen"
      title="審核通過祝福"
      :description="`確定要通過此祝福嗎？「${approveTarget?.message ?? ''}」`"
      confirm-label="確認通過"
      confirm-color="success"
      :loading="isApproving"
      @confirm="confirmApprove"
    />

    <!-- 審核拒絕 Modal -->
    <UModal v-model:open="isRejectOpen">
      <template #content>
        <div data-testid="blessing-reject-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            Review
          </p>
          <h3 class="mb-4 mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
            審核拒絕祝福
          </h3>

          <UAlert
            v-if="rejectError"
            data-testid="blessing-reject-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="rejectError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="拒絕原因" name="reason">
              <UTextarea
                v-model="rejectReason"
                data-testid="blessing-reject-reason"
                :rows="3"
                placeholder="請輸入拒絕原因"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isRejecting"
                @click="isRejectOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="blessing-reject-submit"
                color="error"
                :loading="isRejecting"
                @click="submitReject"
              >
                送出拒絕
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
