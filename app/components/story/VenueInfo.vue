<!-- app/components/story/VenueInfo.vue — 婚宴資訊區塊 -->
<script setup lang="ts">
import type { StoryVenue } from '~/types/story'

defineProps<{
  venue: StoryVenue
}>()
</script>

<template>
  <section class="bg-cream px-6 py-16 lg:py-24">
    <div class="mx-auto max-w-2xl">
      <p class="text-center text-overline uppercase text-gold-deep">
        Wedding Info · 婚宴資訊
      </p>
      <h2 class="mt-3 text-center font-display text-h2 font-semibold text-ink">
        {{ venue.venueName }}
      </h2>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />

      <dl class="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <dt class="text-caption uppercase text-ink-300">
            日期時間
          </dt>
          <dd class="mt-1 text-body-l text-ink">
            {{ venue.dateTime }}
          </dd>
        </div>
        <div>
          <dt class="text-caption uppercase text-ink-300">
            廳別
          </dt>
          <dd class="mt-1 text-body-l text-ink">
            {{ venue.hallName }}
          </dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-caption uppercase text-ink-300">
            地址
          </dt>
          <dd class="mt-1 text-body-l text-ink">
            {{ venue.address }}
          </dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-caption uppercase text-ink-300">
            交通方式
          </dt>
          <dd class="mt-1 text-body text-ink-500">
            {{ venue.transportInfo }}
          </dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-caption uppercase text-ink-300">
            服裝建議
          </dt>
          <dd class="mt-1 text-body text-ink-500">
            {{ venue.dressCode }}
          </dd>
        </div>
      </dl>

      <a
        :href="venue.mapLink"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-10 inline-flex items-center gap-2 text-body font-medium text-gold-deep underline decoration-gold-light underline-offset-4 transition-colors duration-150 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
      >
        在 Google 地圖開啟
      </a>

      <!-- 目前無實拍場地照，安靜留白不放裝飾佔位（EmptyState 精神：低調無 icon） -->
      <p class="mt-10 text-center text-caption text-ink-300">
        場地照片準備中
      </p>
    </div>
  </section>
</template>
