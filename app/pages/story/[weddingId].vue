<!-- app/pages/story/[weddingId].vue — 公開婚禮故事首頁：以「距離」敘事。
     首屏之後七頁故事（201 → 111 → 65 公里到距離歸零）由 StoryDeck 排成桌機橫向翻頁／手機直式，
     一條時間軸從首屏的愛心一路接到第七頁；之後是一本會翻的書（五個跨頁：求婚、泡泡、新郎、新娘、海邊），翻完才往下捲。
     其後排成一條漏斗：認識我們（三隻貓）→ 當天流程 → 婚宴資訊 → 祝福花田與出席回覆 → 其餘出口。
     流程與婚宴資訊都是「當天的事」所以相鄰；花田含 RSVP，移到後面收尾。
     相鄰區塊底色一律交錯（paper／cream 輪流），不讓兩塊黏成一大塊，見 docs/public-landing-assets.md §27。
     內容為單一婚禮的靜態資料（useStoryContent）；「看整片花田」拿掉後這一頁不再打任何 API。 -->
<script setup lang="ts">
definePageMeta({ layout: 'story' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))

const content = useStoryContent()

/** 分享連結上的婚禮簽章（後台「故事頁連結」附的 ?sig=）。
 *  正式站是 enforced 模式，公開 RSVP 的 API 要憑這個簽章放行；這一頁自己不打 API，
 *  但往 RSVP 與其他公開頁的連結都要把它帶下去，賓客點「告訴我們你會來」才進得去。本機 open 模式沒有也照常 */
const sig = computed(() => (typeof route.query.sig === 'string' && route.query.sig ? route.query.sig : ''))
function withSig(path: string) {
  return sig.value ? `${path}?sig=${encodeURIComponent(sig.value)}` : path
}

// 出口只剩婚紗照：「留下你的祝福」與「看完整流程表」新人 09-15 拿掉（祝福有花田那區的 RSVP，流程表對賓客是多餘的）
const entries = computed(() => [
  { key: 'gallery', label: '看我們的婚紗照', to: withSig(`/gallery/${weddingId.value}`) },
])
</script>

<template>
  <div>
    <StoryDeck :hero="content.hero" :slides="content.slides" :spreads="content.spreads" />
    <StoryCats :cats="content.cats" :scene="content.catScene" />
    <StorySchedule :schedule="content.schedule" />
    <VenueInfo :venue="content.venue" />
    <StoryFlowers
      :field="content.flowerField"
      :rsvp-to="withSig(`/rsvp/public/${weddingId}`)"
      rsvp-label="告訴我們你會來"
    />
    <StoryCta :date="content.venue.dateTime" :names="content.hero.namesZh" :entries="entries" :photo-drive="content.photoDrive" :trail="content.trail" />
    <!-- 選單開關不用混色翻色：由書的深色跨頁與當天流程回報底色（usePublicChrome），深色時換紙白 -->
    <PublicMenu :wedding-id="weddingId" :blend="false" />
    <MusicToggle :src="content.music.src" :title="content.music.title" />
    <PublicBackToTop hide-on-desktop />
  </div>
</template>
