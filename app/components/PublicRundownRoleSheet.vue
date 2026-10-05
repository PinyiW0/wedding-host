<!-- app/components/PublicRundownRoleSheet.vue — 公開當天流程表：角色版（issue #188）
     工作人員打開角色連結，只看自己參與的時段：時間 → 主要內容 → 地點 → 你要做的事 → 你要帶的 → 共用物品 → 備註 -->
<script setup lang="ts">
import { getRundownRoleView } from '~/api'

const props = defineProps<{ weddingId: string, roleId: string }>()

// 角色連結（r 簽名）只讀得到這支：伺服器已濾成該角色參與的時段，每段只帶該角色自己的事項
// 讀不到（角色已移除、連結失效）由下方空狀態說明，不另跳錯誤提示
const { data: view } = await getRundownRoleView(() => props.weddingId, () => props.roleId, { silent: true })

const coupleNames = computed(() =>
  `${view.value?.groomName || '新郎'} & ${view.value?.brideName || '新娘'}`,
)
</script>

<template>
  <div class="flex flex-col">
    <template v-if="view">
      <!-- Hero：角色名是這一頁唯一的大標，工作人員一眼確認自己拿對連結 -->
      <div class="py-8 text-center">
        <p class="text-overline uppercase text-gold-deep">
          Wedding Day Rundown · 工作人員流程
        </p>
        <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
          {{ view.roleName }}
        </h1>
        <div class="mx-auto mt-4 h-px w-10 bg-gold" />
        <p class="mt-4 text-body-l text-ink-500">
          {{ coupleNames }} 婚禮・「{{ view.roleName }}」的當日時段
        </p>
      </div>

      <div v-if="view.items.length > 0" class="flex flex-col gap-4">
        <article
          v-for="item in view.items"
          :key="item.rundownItemId"
          :aria-label="item.title"
          class="rounded-lg border bg-paper p-4"
          :class="item.highlight ? 'border-gold' : 'border-line'"
        >
          <!-- 時間段＋地點：到場前最先要確認的兩件事 -->
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p class="font-display text-h3 font-medium text-ink">
              <template v-if="item.time">
                {{ item.time }} – {{ addMinutes(item.time, item.durationMinutes) }}
              </template>
              <template v-else>
                事前準備
              </template>
            </p>
            <p v-if="item.location" class="flex items-center gap-1 text-body text-ink-500">
              <UIcon name="i-heroicons-map-pin" class="size-4 flex-none text-gold-deep" />
              {{ item.location }}
            </p>
          </div>

          <!-- 該時段的主要內容 -->
          <p class="mt-1 text-body-l font-semibold text-ink">
            {{ item.title }}
          </p>

          <!-- 你要做的事：整張卡最醒目的一塊，照後台輸入的換行顯示多步做法 -->
          <div class="mt-3 rounded-md bg-gold-light/25 px-3 py-2.5">
            <p class="text-overline uppercase text-gold-deep">
              你要做的事
            </p>
            <p v-if="item.task" class="mt-1 whitespace-pre-line text-body-l text-ink">
              {{ item.task }}
            </p>
            <p v-else class="mt-1 text-body text-ink-500">
              跟著流程到場參與，沒有個別事項
            </p>
          </div>

          <dl v-if="item.roleSupplies || item.sharedSupplies || item.note" class="mt-3 space-y-1">
            <!-- 自己要帶的排第一；整列共用的物品降一級 -->
            <div v-if="item.roleSupplies" class="flex gap-3 text-body">
              <dt class="flex-none text-ink-500">
                你要帶的
              </dt>
              <dd class="min-w-0 whitespace-pre-line text-ink">
                {{ item.roleSupplies }}
              </dd>
            </div>
            <div v-if="item.sharedSupplies" class="flex gap-3 text-caption">
              <dt class="flex-none text-ink-300">
                共用物品
              </dt>
              <dd class="min-w-0 whitespace-pre-line text-ink-500">
                {{ item.sharedSupplies }}
              </dd>
            </div>
            <div v-if="item.note" class="flex gap-3 text-caption">
              <dt class="flex-none text-ink-300">
                備註
              </dt>
              <dd class="min-w-0 whitespace-pre-line text-ink-300">
                {{ item.note }}
              </dd>
            </div>
          </dl>
        </article>
      </div>
      <EmptyState
        v-else
        title="尚無流程安排"
        description="此角色目前沒有參與的時段"
      />
    </template>
    <!-- 角色已被移除或連結失效：讀不到資料 -->
    <EmptyState
      v-else
      title="找不到這個角色的流程"
      description="連結可能已失效，請向新人索取新的連結"
    />
  </div>
</template>
