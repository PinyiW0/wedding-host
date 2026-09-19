<!-- app/pages/story/[weddingId].vue — 公開婚禮故事首頁：以「距離」敘事。
     首屏之後七頁故事（201 → 111 → 65 公里到距離歸零）由 StoryDeck 排成桌機橫向翻頁／手機直式，
     一條時間軸從首屏的愛心一路接到第七頁；之後是一本會翻的書（五個跨頁：求婚、泡泡、新郎、新娘、海邊），翻完才往下捲。
     其後排成一條漏斗：認識我們（三隻貓）→ 當天流程 → 婚宴資訊 → 祝福花田與出席回覆 → 其餘出口。
     流程與婚宴資訊都是「當天的事」所以相鄰；花田含 RSVP，移到後面收尾。
     相鄰區塊底色一律交錯（paper／cream 輪流），不讓兩塊黏成一大塊，見 docs/public-landing-assets.md §27。
     內容為單一婚禮的靜態資料（useStoryContent）；唯一打的 API 是賓客畫的花（listFlowers，長在祝福花田上方）。 -->
<script setup lang="ts">
import { listFlowers } from '~/api'

definePageMeta({ layout: 'story' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
// 內容只屬於新人自己那一場，別的婚禮 ID 一律 404（見 usePublicWeddingGuard）
usePublicWeddingGuard(weddingId.value)

const content = useStoryContent()

/** 賓客回覆出席時畫的花，長在祝福花田上方（新人 2026-09-16 決定）。
 *  只在 client 抓：每朵花是一段 dataURL、幾十朵就上 MB，不塞進 SSR payload；那一區在很下面，晚一點長出來看不出來。
 *  正式站要帶簽章才讀得到（useHttp 自動帶上 ?sig=）；沒簽章就靜靜留白，不跳「資料載入失敗」 */
const { data: guestFlowers } = await listFlowers(weddingId, { server: false, default: () => [], silent: true })

/** 分享連結上的婚禮簽章（後台「故事頁連結」附的 ?sig=）：往 RSVP 與其他公開頁的連結都要帶下去，
 *  賓客點「回覆我們的邀請」才過得了正式站的 enforced 模式（見 useSignedLink） */
const { withSig, rsvpPath } = useSignedLink()

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
    <!-- 出席回覆的字：09-17 從「告訴我們你會來」改成跟「看我們的婚紗照」同一個句式（新人要換個詞、樣式也統一） -->
    <StoryFlowers
      :field="content.flowerField"
      :guest-flowers="guestFlowers ?? []"
      :rsvp-to="withSig(rsvpPath(weddingId))"
      rsvp-label="回覆我們的邀請"
    />
    <StoryCta :date="content.venue.dateTime" :names="content.hero.namesZh" :entries="entries" :photo-drive="content.photoDrive" :trail="content.trail" />
    <!-- 選單開關不用混色翻色：由書的深色跨頁與當天流程回報底色（usePublicChrome），深色時換紙白 -->
    <PublicMenu :wedding-id="weddingId" :blend="false" />
    <MusicToggle :src="content.music.src" :title="content.music.title" />
    <PublicBackToTop hide-on-desktop />
  </div>
</template>
