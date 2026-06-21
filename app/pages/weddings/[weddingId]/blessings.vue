<!-- app/pages/weddings/[weddingId]/blessings.vue -->
<script setup lang="ts">
import type {
  BlessingApprovedEvent,
  BlessingListItem,
  BlessingRejectedEvent,
  BlessingStatus,
  RejectBlessingBody,
} from '~/types/api/blessings'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

const { data: blessings } = await useFetch<BlessingListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/blessings`,
  { default: () => [] },
)

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
    const res = await $fetch<BlessingApprovedEvent>(
      `/api/v1/weddings/${weddingId.value}/blessings/${blessingId}/approve`,
      { method: 'POST' },
    )
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
    const res = await $fetch<BlessingRejectedEvent>(
      `/api/v1/weddings/${weddingId.value}/blessings/${blessingId}/reject`,
      { method: 'POST', body },
    )
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
    <PageHeader title="祝福審核" description="審核賓客提交的祝福留言（通過 / 拒絕）" />

    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="items.length === 0">
        <EmptyState title="目前沒有祝福" description="賓客提交祝福後會顯示於此" />
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="blessing in items"
          :key="blessing.blessingId"
          :data-testid="`blessing-row-${blessing.blessingId}`"
          :aria-label="blessing.message"
          class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="font-medium text-neutral-900 dark:text-white">
                {{ blessing.message }}
              </p>
              <img
                v-if="blessing.photoUrl"
                :src="blessing.photoUrl"
                alt="祝福照片"
                class="mt-2 max-h-32 rounded-md object-cover"
              >
              <p
                v-if="blessing.rejectReason"
                class="mt-1 text-sm text-neutral-400"
              >
                拒絕原因：{{ blessing.rejectReason }}
              </p>
            </div>

            <div class="flex shrink-0 flex-col items-end gap-2">
              <UBadge
                :color="STATUS_COLOR[blessing.status]"
                variant="soft"
                size="sm"
              >
                {{ STATUS_LABEL[blessing.status] }}
              </UBadge>

              <div v-if="blessing.status === 'submitted'" class="flex gap-1">
                <UButton
                  :data-testid="`blessing-approve-${blessing.blessingId}`"
                  color="success"
                  variant="soft"
                  size="sm"
                  @click="openApprove(blessing)"
                >
                  通過
                </UButton>
                <UButton
                  :data-testid="`blessing-reject-${blessing.blessingId}`"
                  color="error"
                  variant="soft"
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
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
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
