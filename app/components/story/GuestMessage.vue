<!-- app/components/story/GuestMessage.vue — 深色定格段：給賓客的話 -->
<script setup lang="ts">
import type { StoryGuestMessage } from '~/types/story'

defineProps<{
  message: StoryGuestMessage
}>()
</script>

<template>
  <section class="bg-ink px-6 py-16 text-center text-paper lg:py-24">
    <div class="mx-auto max-w-2xl">
      <p class="text-body-l leading-relaxed text-paper/90">
        {{ message.body }}
      </p>
      <p class="mt-6 font-display text-h2 text-gold-light">
        {{ message.signature }}
      </p>
    </div>
  </section>
</template>
