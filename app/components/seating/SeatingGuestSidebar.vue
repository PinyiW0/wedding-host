<!-- app/components/seating/SeatingGuestSidebar.vue -->
<script setup lang="ts">
import type { GuestListItem } from '~/types/api/guests'
import { guestMeta, nameColorClass } from '~/composables/useSeatingMath'

defineProps<{
  /** 待排席賓客（已依男女方→尊卑→分類排序） */
  guests: GuestListItem[]
  seatedCount: number
  /** 可排席賓客數（不含 RSVP 婉拒者，決定空狀態文案） */
  activeCount: number
  isAutoSeating: boolean
  isClearing: boolean
  /** tap-to-assign 待放置中的賓客（點選視覺提示） */
  pendingGuestId: string | null
}>()

const emit = defineEmits<{
  seatForm: []
  clearAll: []
  autoSeat: []
  guestDragStart: [event: DragEvent, guestId: string]
  guestDragEnd: []
  /** 點選賓客切換待放置（觸控備援；再點一次取消） */
  guestTap: [guestId: string]
}>()
</script>

<template>
  <aside class="flex min-h-0 flex-col lg:w-[320px] lg:shrink-0">
    <div class="mb-3 flex shrink-0 items-end justify-between gap-3">
      <div>
        <h2 class="font-display text-body-l font-semibold leading-none text-ink dark:text-paper">
          賓客名單
        </h2>
        <p class="mt-1.5 text-caption text-ink-500 dark:text-neutral-400">
          待排席 {{ guests.length }} 位 · 已排席 {{ seatedCount }} 位
        </p>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-2">
        <!-- 安排座位（表單入口）：置於推薦排序上方 -->
        <UButton
          data-testid="seat-guest"
          icon="i-heroicons-user-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="emit('seatForm')"
        >
          安排座位
        </UButton>
        <div class="flex items-center gap-2">
          <UButton
            data-testid="vibe-seating-clear"
            icon="i-heroicons-arrow-uturn-left"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="isClearing || seatedCount === 0"
            @click="emit('clearAll')"
          >
            一鍵取消
          </UButton>
          <UButton
            data-testid="vibe-seating-recommend"
            icon="i-heroicons-sparkles"
            color="primary"
            variant="solid"
            size="sm"
            :loading="isAutoSeating"
            @click="emit('autoSeat')"
          >
            推薦排序
          </UButton>
        </div>
      </div>
    </div>

    <p class="mb-3 shrink-0 text-caption text-ink-300">
      點「推薦排序」依「主桌帶入新人與雙親、男左女右、長輩近主桌」自動帶位，或直接拖曳賓客到圓桌座位；座位上的賓客可互相拖曳交換位置。平板／觸控可點選賓客後再點桌上空位入座
    </p>

    <!-- 待排席賓客（純 div，避免 list/article role 與桌次實體定位衝突） -->
    <div data-testid="vibe-seating-guest-list" class="flex min-h-0 flex-1 flex-col space-y-2 overflow-auto pr-1">
      <EmptyState
        v-if="guests.length === 0"
        bordered
        class="flex-1"
        :title="seatedCount > 0 ? '賓客皆已排席' : '目前沒有賓客'"
        :description="seatedCount > 0 ? '' : '請先於賓客管理新增賓客'"
      />
      <div
        v-for="guest in guests"
        :key="guest.guestId"
        draggable="true"
        :data-testid="`vibe-seating-guest-${guest.guestId}`"
        class="group flex cursor-grab items-center gap-2 rounded-md border border-line bg-white px-3 py-2 transition-shadow hover:shadow active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-900"
        :class="pendingGuestId === guest.guestId && 'border-gold ring-2 ring-gold'"
        @click="emit('guestTap', guest.guestId)"
        @dragstart="emit('guestDragStart', $event, guest.guestId)"
        @dragend="emit('guestDragEnd')"
      >
        <!-- 姓名（顏色標示男方／女方／兒童）+ 哪一方·關係·葷素 同一排 -->
        <span class="shrink-0 text-body font-medium" :class="nameColorClass(guest)">{{ guest.name }}</span>
        <span class="min-w-0 flex-1 truncate text-caption text-ink-500 dark:text-neutral-400">{{ guestMeta(guest) }}</span>
        <UIcon
          v-if="guest.childChairCount > 0"
          name="i-heroicons-sparkles"
          class="size-4 shrink-0 text-gold-deep"
          title="需兒童椅"
        />
        <UIcon
          name="i-heroicons-bars-3"
          class="size-4 shrink-0 text-ink-300 transition-colors group-hover:text-gold-deep"
        />
      </div>

      <!-- 名單空狀態：小字、不放 icon -->
      <div v-if="guests.length === 0" class="px-1 py-6 text-center">
        <p class="text-caption font-medium text-ink-500 dark:text-neutral-400">
          {{ activeCount === 0 ? '目前沒有賓客' : '所有賓客都已排席' }}
        </p>
        <p class="mt-1 text-caption text-ink-300">
          {{ activeCount === 0 ? '請先於賓客管理新增賓客' : '可點選圓桌上的賓客取消座位' }}
        </p>
      </div>
    </div>
  </aside>
</template>
