<!-- app/pages/weddings/[weddingId]/rsvp.vue -->
<script setup lang="ts">
import type { GuestListItem } from '~/types/api/guests'

import type {
  AttendingStatus,
  OverrideRsvpBody,
  RsvpChannel,
  SendRsvpInvitationBody,
} from '~/types/api/rsvp'
import { listGuests, overrideRsvp, sendRsvpInvitation } from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 賓客名單（僅未移除者參與 RSVP 管理）
const { data: guests, refresh } = await listGuests(weddingId, { default: () => [] })

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

// 狀態語意色（對齊 Nuxt UI 語意：出席=success、缺席/不出席=error、未提交=warning）
function attendingColor(status: AttendingStatus | null): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'attending':
      return 'success'
    case 'declined':
    case 'absent':
      return 'error'
    default:
      return 'warning'
  }
}

// === 出席統計（顯示用，僅彙總既有名單資料） ===
const stats = computed(() => {
  const list = activeGuests.value
  const attending = list.filter(g => g.rsvpAttending === 'attending')
  const declined = list.filter(g => g.rsvpAttending === 'declined').length
  const absent = list.filter(g => g.rsvpAttending === 'absent').length
  const pending = list.filter(g => g.rsvpAttending === null).length
  // 葷素僅計入確認出席者
  const meat = attending.filter(g => g.diet === 'meat').length
  const vegetarian = attending.filter(g => g.diet === 'vegetarian').length
  return {
    total: list.length,
    attending: attending.length,
    declined,
    absent,
    pending,
    meat,
    vegetarian,
  }
})

// 出席統計堆疊長條（出席 / 缺席+不出席 / 待回覆 三段百分比）
const attendBar = computed(() => {
  const total = stats.value.total || 1
  const notAttending = stats.value.declined + stats.value.absent
  return {
    attending: (stats.value.attending / total) * 100,
    notAttending: (notAttending / total) * 100,
    pending: (stats.value.pending / total) * 100,
  }
})

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
    await sendRsvpInvitation(weddingId.value, inviteTarget.value.guestId, body)
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
    await overrideRsvp(weddingId.value, guestId, body)
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
    <PageHeader
      title="RSVP 出席管理"
      :eyebrow="`RSVP · ${stats.total} 份`"
      description="發送出席邀請、查看與覆寫賓客回覆"
    />

    <div class="min-h-0 flex-1 space-y-10 overflow-auto">
      <!-- 出席統計（StatCard grid + 堆疊長條 + 葷素分項，僅彙總既有名單資料） -->
      <section class="space-y-6">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            eyebrow="確認出席"
            :value="stats.attending"
            feature
            :progress="attendBar.attending"
            :caption="`共 ${stats.total} 位賓客`"
          />
          <StatCard eyebrow="不出席" :value="stats.declined" caption="婉謝出席" />
          <StatCard eyebrow="缺席" :value="stats.absent" caption="當日未到" />
          <StatCard eyebrow="待回覆" :value="stats.pending" caption="尚未提交回覆" />
        </div>

        <div class="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="mb-5 flex items-baseline justify-between">
            <div class="flex items-center gap-3">
              <span class="h-px w-8 bg-gold" />
              <span class="text-overline uppercase text-gold-deep">出席統計</span>
            </div>
            <span class="text-caption text-ink-300">RSVP {{ stats.total }} 份</span>
          </div>

          <!-- 堆疊長條：出席 / 不出席+缺席 / 待回覆 -->
          <div class="mb-5 flex h-3.5 overflow-hidden rounded-full bg-line">
            <div class="bg-success-600" :style="{ width: `${attendBar.attending}%` }" />
            <div class="bg-error-700" :style="{ width: `${attendBar.notAttending}%` }" />
            <div class="bg-line" :style="{ width: `${attendBar.pending}%` }" />
          </div>

          <div class="flex flex-col gap-3.5">
            <div class="flex items-center justify-between text-body">
              <span class="flex items-center gap-2.5 text-ink-700 dark:text-neutral-300">
                <span class="size-2.5 rounded-sm bg-success-600" /> 出席
              </span>
              <span class="font-display text-2xl text-ink dark:text-paper">{{ stats.attending }}</span>
            </div>
            <div class="flex items-center justify-between text-body">
              <span class="flex items-center gap-2.5 text-ink-700 dark:text-neutral-300">
                <span class="size-2.5 rounded-sm bg-error-700" /> 不出席 / 缺席
              </span>
              <span class="font-display text-2xl text-ink dark:text-paper">{{ stats.declined + stats.absent }}</span>
            </div>
            <div class="flex items-center justify-between text-body">
              <span class="flex items-center gap-2.5 text-ink-700 dark:text-neutral-300">
                <span class="size-2.5 rounded-sm bg-line" /> 待回覆
              </span>
              <span class="font-display text-2xl text-ink dark:text-paper">{{ stats.pending }}</span>
            </div>
          </div>

          <!-- 葷素分項（僅計確認出席者） -->
          <div class="my-6 h-px bg-line" />
          <div class="flex gap-10">
            <div>
              <p class="text-caption text-gold-deep">
                葷食
              </p>
              <p class="font-display text-3xl text-ink dark:text-paper">
                {{ stats.meat }}
              </p>
            </div>
            <div>
              <p class="text-caption text-gold-deep">
                素食
              </p>
              <p class="font-display text-3xl text-ink dark:text-paper">
                {{ stats.vegetarian }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 賓客回覆清單 — 編輯式表格 -->
      <section>
        <div class="mb-3 flex items-center gap-3">
          <span class="text-overline uppercase text-gold-deep">賓客回覆</span>
          <span class="h-px flex-1 bg-line" />
        </div>
        <table
          data-testid="rsvp-list"
          class="w-full border-collapse text-body"
        >
          <thead>
            <tr class="text-left text-overline uppercase text-gold-deep">
              <th class="border-b border-line px-3 py-3.5 font-medium">
                姓名
              </th>
              <th class="hidden border-b border-line px-3 py-3.5 font-medium sm:table-cell">
                出席狀態
              </th>
              <th class="border-b border-line px-3 py-3.5 text-right font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="text-ink-700 dark:text-neutral-300">
            <tr
              v-for="guest in activeGuests"
              :key="guest.guestId"
              :data-testid="`rsvp-row-${guest.guestId}`"
              class="transition-colors hover:bg-paper dark:hover:bg-neutral-900"
            >
              <td class="border-b border-line px-3 py-4 dark:border-neutral-800">
                <span class="font-medium text-ink dark:text-paper">
                  {{ guest.name }}
                </span>
              </td>
              <td class="hidden border-b border-line px-3 py-4 sm:table-cell dark:border-neutral-800">
                <UBadge
                  :data-testid="`rsvp-status-${guest.guestId}`"
                  :color="attendingColor(guest.rsvpAttending)"
                  variant="soft"
                  size="sm"
                >
                  {{ attendingLabel(guest.rsvpAttending) }}
                </UBadge>
              </td>
              <td class="border-b border-line px-3 py-4 text-right dark:border-neutral-800">
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
      </section>
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
