<!-- app/pages/story/[weddingId].vue — 公開婚禮故事首頁（issue #158）
     以敘事方式介紹新人故事，導流到既有的出席回覆／祝福留言／流程表頁。
     內容目前為單一婚禮的靜態資料（見 useStoryContent），非後台可編輯的實體。 -->
<script setup lang="ts">
definePageMeta({ layout: 'story' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const content = useStoryContent()

const entries = computed(() => [
  { key: 'rsvp', label: '告訴我們你會來', to: `/rsvp/public/${weddingId.value}` },
  { key: 'gallery', label: '看我們的婚紗照', to: `/gallery/${weddingId.value}` },
  { key: 'blessing', label: '留下你的祝福', to: `/blessing/${weddingId.value}` },
  { key: 'schedule', label: '看看當天流程', to: `/schedule/${weddingId.value}` },
])
</script>

<template>
  <div>
    <StoryHero :hero="content.hero" />
    <PhotoWall :sections="content.sections" :notes="content.notes" />
    <GuestMessage :message="content.guestMessage" />
    <VenueInfo :venue="content.venue" />
    <StoryCta :entries="entries" />
    <MusicToggle :src="content.music.src" />
  </div>
</template>
