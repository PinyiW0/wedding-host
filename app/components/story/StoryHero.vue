<!-- app/components/story/StoryHero.vue — 公開故事首頁 Hero：主視覺 + 進場 CTA -->
<script setup lang="ts">
import type { StoryHeroContent } from '~/types/story'

defineProps<{
  hero: StoryHeroContent
}>()
</script>

<template>
  <section class="relative flex min-h-[85vh] flex-col items-center justify-end overflow-hidden bg-ink px-6 pb-16 pt-24 text-center sm:min-h-screen">
    <img
      :src="hero.heroImage"
      alt=""
      loading="eager"
      class="absolute inset-0 size-full object-cover opacity-70"
    >
    <div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />

    <div class="relative flex flex-col items-center gap-3">
      <p class="text-overline uppercase tracking-[0.28em] text-gold-light">
        {{ hero.date }}
      </p>
      <h1 class="font-display text-h1 font-semibold leading-none text-paper sm:text-display-l">
        {{ hero.namesEn }}
      </h1>
      <p class="text-body-l text-paper/80">
        {{ hero.namesZh }}
      </p>
      <p v-if="hero.tagline" class="mt-2 max-w-md text-body text-paper/70">
        {{ hero.tagline }}
      </p>
      <a
        href="#story-wall"
        class="mt-8 inline-flex items-center gap-2 rounded-sm border border-paper/40 px-6 py-3 text-body font-medium text-paper transition-colors duration-150 hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
      >
        {{ hero.ctaLabel }}
      </a>
    </div>
  </section>
</template>
