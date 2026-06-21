<!-- app/pages/weddings/[weddingId]/rsvp.vue -->
<script setup lang="ts">
import type { GuestListItem } from '~/types/api/guests'

import type {
  AttendingStatus,
  OverrideRsvpBody,
  RsvpChannel,
  RsvpInvitationSentEvent,
  RsvpOverriddenEvent,
  SendRsvpInvitationBody,
} from '~/types/api/rsvp'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 賓客名單（僅未移除者參與 RSVP 管理）
const { data: guests, refresh } = await useFetch<GuestListItem[]>(
  () => `/api/v1/weddings/${weddingId.value}/guests`,
  { default: () => [] },
)

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

// RSVP 狀態文字對照
function attendingLabel(status: AttendingStatus | null): string {
  switch (status) {
    case 'attending':
      return '出席'
    case 'declined':
      return '不出席'
    case 'absent':
      return '缺席'
    default:
      return '未提交'
  }
}

// === 發送 RSVP 邀請 ===
const isInviteOpen = ref(false)
const isInviting = ref(false)
const inviteError = ref('')
const inviteTarget = ref<GuestListItem | null>(null)
const inviteChannel = ref<RsvpChannel>('line')

const channelOptions = [
  { label: 'LINE', value: 'line' as RsvpChannel },
  { label: 'Email', value: 'email' as RsvpChannel },
]

function openInvite(guest: GuestListItem) {
  inviteTarget.value = guest
  inviteChannel.value = 'line'
  inviteError.value = ''
  isInviteOpen.value = true
}

async function confirmInvite() {
  if (!inviteTarget.value || isInviting.value)
    return
  isInviting.value = true
  inviteError.value = ''
  try {
    const body: SendRsvpInvitationBody = { channel: inviteChannel.value }
    await $fetch<RsvpInvitationSentEvent>(
      `/api/v1/weddings/${weddingId.value}/guests/${inviteTarget.value.guestId}/rsvp-invitation`,
      { method: 'POST', body },
    )
    toast.add({ title: '邀請已發送', color: 'success' })
    isInviteOpen.value = false
  }
  catch (error: any) {
    inviteError.value
      = error?.data?.message || error?.statusMessage || '發送失敗，請稍後再試'
  }
  finally {
    isInviting.value = false
  }
}

// === 覆寫 RSVP ===
const isOverrideOpen = ref(false)
const isOverriding = ref(false)
const overrideError = ref('')
const overrideTarget = ref<GuestListItem | null>(null)
const overrideAttending = ref<AttendingStatus>('attending')
const overrideReason = ref('')

const attendingOptions = [
  { label: '出席', value: 'attending' as AttendingStatus },
  { label: '不出席', value: 'declined' as AttendingStatus },
  { label: '缺席', value: 'absent' as AttendingStatus },
]

function openOverride(guest: GuestListItem) {
  overrideTarget.value = guest
  overrideAttending.value = 'attending'
  overrideReason.value = ''
  overrideError.value = ''
  isOverrideOpen.value = true
}

async function confirmOverride() {
  if (!overrideTarget.value || isOverriding.value)
    return
  isOverriding.value = true
  overrideError.value = ''
  try {
    const guestId = overrideTarget.value.guestId
    const body: OverrideRsvpBody = {
      attending: overrideAttending.value,
      reason: overrideReason.value,
    }
    await $fetch<RsvpOverriddenEvent>(
      `/api/v1/weddings/${weddingId.value}/guests/${guestId}/rsvp-override`,
      { method: 'POST', body },
    )
    // 覆寫成功後重抓，以 GET 的 rsvpAttending 為呈現真實來源（重整也靠 GET）
    await refresh()
    toast.add({ title: 'RSVP 已覆寫', color: 'success' })
    isOverrideOpen.value = false
  }
  catch (error: any) {
    overrideError.value
      = error?.data?.message || error?.statusMessage || '覆寫失敗，請稍後再試'
  }
  finally {
    isOverriding.value = false
  }
}
</script>

<template>
  <div data-testid="rsvp-page" class="flex h-full flex-col">
    <PageHeader title="RSVP 出席管理" description="發送出席邀請、查看與覆寫賓客回覆" />

    <div class="min-h-0 flex-1 overflow-auto">
      <table
        data-testid="rsvp-list"
        class="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        <thead class="bg-neutral-50 dark:bg-neutral-900">
          <tr class="text-left text-sm text-neutral-500 dark:text-neutral-400">
            <th class="px-4 py-3 font-medium">
              姓名
            </th>
            <th class="hidden px-4 py-3 font-medium sm:table-cell">
              出席狀態
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
            :data-testid="`rsvp-row-${guest.guestId}`"
            class="border-t border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <td class="px-4 py-3">
              <span class="font-medium text-neutral-900 dark:text-white">
                {{ guest.name }}
              </span>
            </td>
            <td class="hidden px-4 py-3 text-neutral-600 sm:table-cell dark:text-neutral-300">
              <span :data-testid="`rsvp-status-${guest.guestId}`">
                {{ attendingLabel(guest.rsvpAttending) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-1">
                <UButton
                  data-testid="rsvp-invite"
                  icon="i-heroicons-paper-airplane"
                  color="primary"
                  variant="ghost"
                  size="sm"
                  :aria-label="`發送 RSVP 邀請給 ${guest.name}`"
                  @click="openInvite(guest)"
                >
                  發送邀請
                </UButton>
                <UButton
                  data-testid="rsvp-override"
                  icon="i-heroicons-pencil-square"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :aria-label="`覆寫 ${guest.name} 的 RSVP`"
                  @click="openOverride(guest)"
                >
                  覆寫
                </UButton>
              </div>
            </td>
          </tr>
          <tr v-if="activeGuests.length === 0">
            <td colspan="3">
              <EmptyState
                title="目前沒有賓客"
                description="請先於賓客名單新增賓客後再管理 RSVP"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 發送 RSVP 邀請 Modal -->
    <UModal v-model:open="isInviteOpen">
      <template #content>
        <div data-testid="rsvp-invite-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            發送 RSVP 邀請
          </h3>
          <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            發送給賓客「{{ inviteTarget?.name ?? '' }}」
          </p>

          <UAlert
            v-if="inviteError"
            data-testid="rsvp-invite-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="inviteError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="發送管道" name="channel">
              <USelectMenu
                v-model="inviteChannel"
                data-testid="rsvp-invitation-channel"
                :items="channelOptions"
                value-key="value"
                placeholder="選擇發送管道"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isInviting"
                @click="isInviteOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="rsvp-invite-submit"
                color="primary"
                :loading="isInviting"
                @click="confirmInvite"
              >
                送出
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 覆寫 RSVP Modal -->
    <UModal v-model:open="isOverrideOpen">
      <template #content>
        <div data-testid="rsvp-override-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            覆寫 RSVP
          </h3>
          <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            覆寫賓客「{{ overrideTarget?.name ?? '' }}」的出席狀態
          </p>

          <UAlert
            v-if="overrideError"
            data-testid="rsvp-override-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="overrideError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="出席狀態" name="attending">
              <USelectMenu
                v-model="overrideAttending"
                data-testid="rsvp-override-attending"
                :items="attendingOptions"
                value-key="value"
                placeholder="選擇出席狀態"
                class="w-full"
              />
            </UFormField>

            <UFormField label="覆寫原因" name="reason">
              <UTextarea
                v-model="overrideReason"
                data-testid="rsvp-override-reason"
                placeholder="請輸入覆寫原因"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isOverriding"
                @click="isOverrideOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="rsvp-override-submit"
                color="primary"
                :loading="isOverriding"
                @click="confirmOverride"
              >
                送出
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
