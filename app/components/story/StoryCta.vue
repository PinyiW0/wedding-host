<!-- app/components/story/StoryCta.vue — 導向既有功能頁的入口（出席回覆／祝福留言／流程表） -->
<script setup lang="ts">
defineProps<{
  entries: { key: string, label: string, to: string }[]
}>()
</script>

<template>
  <section class="bg-paper px-6 py-16 text-center lg:py-24">
    <p class="text-overline uppercase text-gold-deep">
      Join Us · 與我們同行
    </p>
    <h2 class="mt-3 font-display text-h2 font-semibold text-ink">
      期待與你相見
    </h2>

    <div class="mx-auto mt-8 flex max-w-md flex-col gap-3">
      <UButton
        v-for="(entry, i) in entries"
        :key="entry.key"
        :to="entry.to"
        size="xl"
        :color="i === 0 ? 'primary' : 'neutral'"
        :variant="i === 0 ? 'solid' : 'outline'"
        block
      >
        {{ entry.label }}
      </UButton>
    </div>
  </section>
</template>
