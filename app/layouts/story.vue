<!-- app/layouts/story.vue — 公開故事首頁專用：全寬沉浸式版面，不套用 GuestNav
     （GuestNav 依連結簽名等級導覽個人化頁面，與本頁「任何人拿到婚禮連結都可看」的公開敘事性質不同）。 -->
<template>
  <!-- story-page：整頁的中文段落套不留孤字（main.css @layer base），單字與單標點不會被擠成一行 -->
  <div class="story-page bg-paper">
    <slot />
    <!-- 點擊火花＋小愛心：只掛在賓客面向的版面（本檔與 guest.vue），
         後台版面不掛——creative-direction §4「後台幾乎不動」 -->
    <ClickSpark />
  </div>
</template>
