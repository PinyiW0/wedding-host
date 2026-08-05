<!-- app/pages/schedule/[weddingId].vue — 賓客版當日流程（免登入；只呈現後台勾選「賓客可見」的時段） -->
<script setup lang="ts">
import { getWedding, listRundownItems } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const { data: wedding } = await getWedding(weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

// 與工作人員版 /rundown 讀同一份資料，差別在此頁只取賓客可見的時段，
// 且不呈現物品／備註／角色個別事項（那些是給工作人員照表執行用的）
// items GET 已排序：time null 置頂、其餘依 time 升冪
const { data: items } = await listRundownItems(weddingId, { default: () => [] })

const visibleItems = computed(() => (items.value ?? []).filter(item => item.guestVisible))
</script>

<template>
  <div data-testid="public-schedule" class="flex flex-col">
    <!-- Hero -->
    <div class="py-8 text-center">
      <p class="text-overline uppercase text-gold-deep">
        Wedding Schedule · 當日流程
      </p>
      <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
        {{ groomName }} &amp; {{ brideName }}
      </h1>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />
      <p class="mt-4 text-body-l text-ink-500">
        婚禮當天的時間安排
      </p>
    </div>

    <!-- 流程時間軸：只有時間、事項與場地 -->
    <div v-if="visibleItems.length > 0" class="flex flex-col">
      <div
        v-for="item in visibleItems"
        :key="item.rundownItemId"
        role="article"
        :aria-label="item.title"
        class="flex gap-4 border-b border-line py-5 last:border-b-0"
        :class="item.highlight && 'rounded-md bg-gold-light/20 px-3'"
      >
        <div class="w-20 flex-none pt-0.5 text-right">
          <div v-if="item.time" class="font-display text-lg font-semibold text-ink">
            {{ item.time }}
          </div>
          <div v-else class="pt-1 font-display text-body font-semibold text-ink-500">
            時間未定
          </div>
        </div>
        <!-- 時間軸金點與豎線 -->
        <div class="flex flex-none flex-col items-center pt-2.5">
          <span class="size-2 rounded-full bg-gold" />
          <span class="mt-1.5 w-px flex-1 bg-line" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-body-l font-medium text-ink">
            {{ item.title }}
          </div>
          <p v-if="item.location" class="mt-1 text-caption text-ink-500">
            {{ item.location }}
          </p>
        </div>
      </div>
    </div>
    <EmptyState
      v-else
      title="流程準備中"
      description="新人還在安排當天的時間，請稍後再來看看"
    />
  </div>
</template>
