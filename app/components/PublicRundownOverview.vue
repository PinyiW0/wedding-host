<!-- app/components/PublicRundownOverview.vue — 公開當天流程表：全部角色總覽（婚禮分享簽名的連結） -->
<script setup lang="ts">
import type { RundownItemListItem } from '~/types/api/rundown'

import { getWedding, listRundownItems, listRundownRoles } from '~/api'

const props = defineProps<{ weddingId: string }>()

const { data: wedding } = await getWedding(() => props.weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

// items GET 已排序：time null（事前準備）置頂、其餘依 time 升冪
const { data: roles } = await listRundownRoles(() => props.weddingId, { default: () => [] })
const { data: items } = await listRundownItems(() => props.weddingId, { default: () => [] })

// roleId → 角色名（角色事項列顯示）
const roleNameMap = computed(() => new Map((roles.value ?? []).map(r => [r.roleId, r.name])))

function visibleTasks(item: RundownItemListItem): { name: string, task: string, supplies: string }[] {
  return item.roleTasks
    .map(rt => ({ name: roleNameMap.value.get(rt.roleId) ?? '', task: rt.task, supplies: rt.supplies ?? '' }))
    .filter(entry => entry.name !== '')
}
</script>

<template>
  <div class="flex flex-col">
    <!-- Hero -->
    <div class="py-8 text-center">
      <p class="text-overline uppercase text-gold-deep">
        Wedding Day Rundown · 當天流程表
      </p>
      <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
        {{ groomName }} &amp; {{ brideName }}
      </h1>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />
      <p class="mt-4 text-body-l text-ink-500">
        婚禮當天流程總覽
      </p>
    </div>

    <!-- 流程時間軸（time null 的事前準備列由 GET 排序置頂） -->
    <div v-if="(items?.length ?? 0) > 0" class="flex flex-col">
      <div
        v-for="item in items"
        :key="item.rundownItemId"
        role="article"
        :aria-label="item.title"
        class="flex gap-4 border-b border-line py-4 last:border-b-0"
        :class="item.highlight && 'rounded-md bg-gold-light/20 px-3'"
      >
        <!-- 時間欄：起訖（訖＝起＋時長）；未定時段顯示「事前準備」 -->
        <div class="w-20 flex-none pt-0.5 text-right">
          <template v-if="item.time">
            <div class="font-display text-lg font-semibold text-ink">
              {{ item.time }}
            </div>
            <div class="text-caption text-ink-300">
              – {{ addMinutes(item.time, item.durationMinutes) }}
            </div>
          </template>
          <div v-else class="pt-1 font-display text-body font-semibold text-ink-500">
            事前準備
          </div>
        </div>
        <!-- 時間軸金點與豎線 -->
        <div class="flex flex-none flex-col items-center pt-2.5">
          <span class="size-2 rounded-full bg-gold" />
          <span class="mt-1.5 w-px flex-1 bg-line" />
        </div>
        <!-- 內容：標題 + 場地 + 各角色個別事項 -->
        <div class="min-w-0 flex-1">
          <div class="font-medium text-ink">
            {{ item.title }}
          </div>
          <p v-if="item.location" class="mt-1 text-caption text-ink-500">
            場地：{{ item.location }}
          </p>
          <div v-if="visibleTasks(item).length > 0" class="mt-1.5 space-y-1">
            <p
              v-for="entry in visibleTasks(item)"
              :key="entry.name"
              class="whitespace-pre-line text-caption text-ink-500"
            >
              <span class="font-medium text-gold-deep">{{ entry.name }}</span>
              <template v-if="entry.task">
                ：{{ entry.task }}
              </template>
              <span v-if="entry.supplies" class="text-ink-300">（物品：{{ entry.supplies }}）</span>
            </p>
          </div>
          <p v-if="item.supplies" class="mt-1.5 text-caption text-ink-500">
            共用物品：{{ item.supplies }}
          </p>
          <p v-if="item.note" class="mt-1 text-caption text-ink-300">
            {{ item.note }}
          </p>
        </div>
      </div>
    </div>
    <EmptyState
      v-else
      title="尚無流程安排"
      description="新人尚未安排當天流程，請稍後再來"
    />
  </div>
</template>
