<!-- app/pages/flowers/[weddingId].vue — 花田 landing（公開，RWD）：賓客手繪小花散佈牆 -->
<script setup lang="ts">
import { getWedding, listFlowers } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const { data: wedding } = await getWedding(weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

const { data: flowers } = await listFlowers(weddingId, { default: () => [] })
const flowerList = computed(() => flowers.value ?? [])
</script>

<template>
  <div data-testid="flower-field-page" class="flex flex-col">
    <!-- Hero -->
    <div class="py-8 text-center">
      <p class="text-overline uppercase text-gold-deep">
        Flower Field · 祝福花田
      </p>
      <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
        {{ groomName }} &amp; {{ brideName }}
      </h1>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />
      <p class="mt-4 text-body-l text-ink-500">
        每一朵小花，都是賓客親手畫下的祝福
      </p>
    </div>

    <!-- 花田 -->
    <FlowerField
      v-if="flowerList.length > 0"
      :flowers="flowerList"
      interactive
      class="mt-2"
    />
    <EmptyState
      v-else
      title="花田尚未綻放"
      description="當賓客在回覆時畫下小花，這片花田就會慢慢盛開"
    />

    <p v-if="flowerList.length > 0" class="mt-8 text-center text-caption text-ink-300">
      共 {{ flowerList.length }} 朵祝福
    </p>
  </div>
</template>
