<!-- app/pages/invite/[weddingId].vue — 婚紗入口頁（喜帖桌面）
     對外分享的第一站：一張會動的喜帖桌面，三個出口——
     蕾絲愛心卡 → /story/[weddingId]（婚禮故事頁）、拍立得 → /gallery/[weddingId]（婚紗照）、
     「我要參加！」日期卡 → /rsvp/public/[weddingId]（出席回覆，新人 09-17）。
     進到桌面之後右上角才出現選單開關（PublicMenu，與故事頁、相簿同一顆）：開場那張封蠟信封只有「打開」一個動作，不放選單。
     內容為單一婚禮的靜態資料（見 useInviteScene），非後台可編輯的實體。 -->
<script setup lang="ts">
definePageMeta({ layout: 'story' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
// 內容只屬於新人自己那一場，別的婚禮 ID 一律 404（見 usePublicWeddingGuard）
usePublicWeddingGuard(weddingId.value)

// 出口（愛心卡、拍立得）帶著網址上的婚禮簽章，從喜帖點到故事再回出席回覆才不會掉
const { withSig } = useSignedLink()
const scene = computed(() => useInviteScene(weddingId.value, withSig))
/** 信封離場、桌面開始演了沒：選單開關等這一刻才出現 */
const inScene = ref(false)

useSeoMeta({
  title: 'Alex & Lele 婚禮邀請',
  description: '兩個獨立運行的星球，在漫長時光裡找到彼此的軌道。2026.11.22，婚禮見！',
  ogTitle: 'Alex & Lele 婚禮邀請',
  ogDescription: '兩個獨立運行的星球，在漫長時光裡找到彼此的軌道。2026.11.22，婚禮見！',
  ogImage: '/og-image.png',
})
</script>

<template>
  <!-- 單一根元素：舞台＋進到桌面後才出現的選單 -->
  <div>
    <InviteStage
      :background="scene.background"
      :intro="scene.intro"
      :cats="scene.cats"
      :cat-trail="scene.catTrail"
      :items="scene.items"
      :music="scene.music"
      :cat-hint="scene.catHint"
      @scene="inScene = true"
    >
      <!-- 主標下方的引言：桌機稿才有，手機稿留給信封主體 -->
      <div class="invite-tagline">
        <p v-for="line in scene.tagline" :key="line" class="tagline-line tracking-wide text-ink-700">
          {{ line }}
        </p>
        <p class="mt-1 flex items-center gap-3 font-display text-body-l tracking-widest text-gold-deep">
          <span class="h-px w-28 bg-line" aria-hidden="true" />
          {{ scene.taglineEn }}
        </p>
      </div>
    </InviteStage>
    <!-- 桌面是紙色底，開關用墨色（不 blend）；v-if 到這一刻才掛，配一段淡入 -->
    <div v-if="inScene" class="invite-menu">
      <PublicMenu :wedding-id="weddingId" :blend="false" />
    </div>
  </div>
</template>

<style scoped>
/* left 對齊的是「Alex」那個 A 的左緣（x≈196px @1440）——這是設計稿的排法：
   稿子裡引言左緣 253px、Alex 的 A 在 258px，兩者同一條垂直線
   （而 Invitation 的花體 I 在 315px，反而比引言更右，不是對齊基準）。 */
.invite-tagline {
  position: absolute;
  left: 29.5%;
  top: 58.2%;
  z-index: 40;
  display: none;
  width: 32%;
  /* 純文字區塊，但 z-index 40 蓋在海邊拍立得（z 24）上，會擋掉它左半邊的 hover 與點擊 */
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: tagline-in 400ms var(--ease-emphasized) both;
  /* 接在標題組（order 9）後面出現，見 useInviteScene 的 order 說明：第三幕 900ms ＋ 9 階 × 120ms ＋ 520ms 落定 ≈ 2500ms */
  animation-delay: 2400ms;
}

/* 引言兩行的排版由使用者指定：Noto Serif TC 16px / Light / 行高 200%。
   16px 與 300 字重都沒有對應的 @theme token（最近的 text-body 是 15px/1.7），
   這是這一頁的編輯性排版，寫在 scoped CSS 就地解決，不另開全域字級 token 污染層級表。 */
.tagline-line {
  font-family: var(--font-serif-tc);
  font-size: 16px;
  font-weight: 300;
  line-height: 2;
}

/* 選單開關：桌上的東西差不多擺好（第三幕約 2.4 秒落定）才淡進來，不跟進場搶 */
.invite-menu {
  animation: menu-in 400ms var(--ease-standard) 1800ms both;
}

@keyframes menu-in {
  from {
    opacity: 0;
  }
}

@keyframes tagline-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px));
  }
}

@media (min-width: 1024px) {
  .invite-tagline {
    display: block;
  }
}
</style>
