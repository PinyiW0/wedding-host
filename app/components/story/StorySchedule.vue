<!-- app/components/story/StorySchedule.vue — 當天流程：入席、建議到場、開席三個時間點。
     沿用故事那條金線：一條直線往下接三顆愛心（與 StorySlide 手機版同一套語彙），
     所以這一區讀起來是同一條線走到婚禮當天，而不是另外插進來的一張表。
     直式而且靠右：底圖是兩個人在畫面中間的照片，橫排會壓在人身上（新人 09-15）。
     三個時間裡只有「建議到場」要賓客行動，另外兩個是背景資訊——只放大這一個（字級、字重、愛心大小與心跳），
     不靠顏色分主次。
     底是一張日落海邊的婚紗照（新人 09-14 指定），捲動時照片比頁面慢一點往上帶（視差）：
     照片層比區塊高 24%，useScrollProgress 的 travel 進度寫進 --sp，CSS 只動 transform；
     reduced-motion 時引擎不啟動、--sp 停在 0.5，照片就是靜止的中性構圖。
     照片下半是暗的沙灘與剪影、上半是亮的天空，文字改紙白，再鋪一層由上往下變深的墨色薄紗，兩邊都讀得清。
     照片滿版、上下緣直接切齊（新人 09-15 兩輪後定案）：用 cream 漸層淡進淡出時，深色照片混進奶油色會混出一段灰帶（突兀）；
     改成四邊留白的大圖後新人覺得滿版比較好看。所以回到滿版，但不加任何漸層——乾淨的直線邊就是分段。
     日期不再在這裡出現（婚宴資訊那一區有）。標題是「當天流程」，底下一行英文回音，與婚宴資訊區「中文在上、英文在下」同一套。 -->
<script setup lang="ts">
import type { StoryScheduleContent } from '~/types/story'

defineProps<{
  schedule: StoryScheduleContent
}>()

const { register } = useScrollProgress()

// live：JS 接管後才把線與愛心藏起來。SSR／無 JS 直接是終態，沒有東西被藏死（同 StorySlide）
const live = ref(false)
// drawn：捲到才畫線，一次性不重播
const drawn = ref(false)
const root = ref<HTMLElement | null>(null)

// 這一區是全頁唯一深色滿版：捲到它蓋住右上角時，選單開關換紙白
usePublicChrome().watchCorner('story-schedule', root, () => true)

let observer: IntersectionObserver | null = null

function stopObserving() {
  observer?.disconnect()
  observer = null
}

onMounted(() => {
  live.value = true
  if (!root.value)
    return
  // 視差：整區通過視窗的行程寫進 --sp（0 還在下面、0.5 正對中心、1 已捲上去）
  register(root.value, { varName: '--sp', mode: 'travel' })
  // 底部收 15%：整區已進來一小截才開始畫，線不會在畫面外就跑完
  observer = new IntersectionObserver((records) => {
    if (!records.some(record => record.isIntersecting))
      return
    drawn.value = true
    stopObserving()
  }, { rootMargin: '0px 0px -15% 0px' })
  observer.observe(root.value)
})

onBeforeUnmount(stopObserving)
</script>

<template>
  <section
    ref="root"
    aria-labelledby="story-schedule-title"
    class="schedule bg-ink"
    :class="{ 'is-live': live, 'is-drawn': drawn }"
  >
    <!-- 滿版照片框：overflow-hidden 把比框高的視差照片裁在框裡，bg-ink 是照片載入前的底 -->
    <div class="photo-frame relative overflow-hidden px-6 py-20 lg:py-28">
      <!-- 底圖與薄紗：照片層比框高，捲動時依 --sp 上下平移；薄紗由上往下變深，天空亮、沙灘暗都壓得住 -->
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          src="/images/story/schedule-bg.webp"
          alt=""
          loading="lazy"
          width="2048"
          height="1365"
          class="bg-photo"
        >
        <span class="scrim absolute inset-0" />
      </div>

      <!-- 直式時間軸靠右（新人 09-15：橫排會壓在照片中間的兩個人身上）：
           桌機收在右半邊、手機靠右對齊，兩個人留在左邊；做法與 StorySlide 手機版相同——左緣一條直線往下接，三個時間點排在線旁。
           愛心在流內置中，不用 translate，所以不會跟 StoryHeart 的任何位移打架 -->
      <div class="relative mx-auto max-w-5xl">
        <!-- 手機 w-48：時間軸從 174px 起（原本 w-60 從 126px 起），配合底圖往左挪，兩個人連新娘伸出去的捧花都留在左邊（新人 09-17）；
             最寬的「12:15」（text-h1）在 132px 的字欄裡放得下 -->
        <div class="ml-auto w-48 lg:mr-24 lg:w-72">
          <div class="pl-15">
            <h2 id="story-schedule-title" class="font-serif-tc text-h3 font-semibold tracking-wider text-paper">
              當天流程
            </h2>
            <p class="mt-2 text-overline uppercase text-paper/75">
              Wedding Day
            </p>
          </div>
          <div class="relative mt-10">
            <span class="rail-v absolute inset-y-0 w-0.5 bg-paper/25" aria-hidden="true">
              <span class="fill fill-v absolute inset-0 origin-top bg-gold-light" />
            </span>
            <ul class="space-y-10">
              <li
                v-for="(stop, i) in schedule.stops"
                :key="stop.key"
                class="flex items-center gap-5"
                :style="{ '--i': i }"
              >
                <span class="flex w-10 shrink-0 justify-center text-gold-light" aria-hidden="true">
                  <StoryHeart class="heart" :class="stop.highlight ? 'beat size-9' : 'size-6'" />
                </span>
                <div class="reveal">
                  <p :class="stop.highlight ? 'font-serif-tc text-body-l font-semibold tracking-wider text-paper' : 'font-serif-tc text-body tracking-wider text-paper/75'">
                    {{ stop.label }}
                  </p>
                  <p :class="stop.highlight ? 'font-display text-h1 font-semibold leading-none text-paper' : 'font-display text-h3 font-normal leading-none text-paper/75'">
                    {{ stop.time }}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 底圖：比區塊高 24%（上下各多 12%），捲動時最多平移自己的 9%（＝區塊的 11%），不會露出邊。
   構圖重心放在 55%：可見的那一截要同時有日落的地平線與兩個人的剪影。
   --sp 0.5 是正對視窗中心；區塊還在下面（sp < 0.5）時照片先往上縮、捲上去時再往下放——
   相對於區塊是往下走，所以在畫面上比頁面慢，這才是「背景」的視差（符號跟 GalleryInterlude 那種往前跑的相反） */
.bg-photo {
  position: absolute;
  inset: -12% 0;
  width: 100%;
  height: 124%;
  object-fit: cover;
  object-position: 50% 55%;
  transform: translate3d(0, calc((var(--sp, 0.5) - 0.5) * 18%), 0);
  will-change: transform;
}
/* 手機：畫面窄，兩個人要留在左緣給右邊的時間軸讓位。
   390 寬的視窗只看得到 cover 後約 780 寬裡的一截：兩個人在原圖的 38～46%，新娘伸出去的捧花到 24%。
   原本 object-position 58% 讓捧花那隻手切在畫面左緣外（新人 09-17）；改 45% 時視窗從 174px 起算，
   捧花落在左緣 12px、兩個人在 120～185px，時間軸（w-48）從 174px 起、直線在 194px，人與線不疊 */
@media (width < 64rem) {
  .bg-photo {
    object-position: 45% 55%;
  }
}
/* 薄紗兩層：
   ①整張由上往下 20% → 40% 的墨（2026-09-15 從 35%→55% 降淡，左邊兩個人不再壓得發黑）；
   ②只在右邊時間軸那一欄再疊 40%：從畫面 30% 處開始變深、58% 以後持平。
   只降第①層時，入席／開席那兩行 75% 紙白落在亮雲上，對比掉到 1.8（實測第 5 百分位）；加上第②層回到 3.5 以上，
   比原本 35%→55% 的整片薄紗（2.5）還清楚，照片左半卻是亮的 */
.scrim {
  background:
    linear-gradient(to right, transparent 30%, rgb(17 17 17 / 40%) 58%, rgb(17 17 17 / 40%)),
    linear-gradient(to bottom, rgb(17 17 17 / 20%), rgb(17 17 17 / 40%));
}
/* 直線落在愛心欄（w-10）的正中：2.5rem 的一半再退回線寬的一半 */
.rail-v {
  left: calc(1.25rem - 1px);
}

/* ── 出場：只有 JS 接管後（is-live）才先藏，捲到（is-drawn）再依 --i 逐個浮出 ──
   線與愛心只動 transform；文字動 opacity 與 transform。全部是 composite 屬性，不碰 layout */
.is-live:not(.is-drawn) .fill-v {
  transform: scaleY(0);
}
.is-live:not(.is-drawn) .heart {
  transform: scale(0);
}
.is-drawn .fill {
  transition: transform 1.2s var(--ease-standard);
}
.is-drawn .heart {
  transition: transform 0.35s var(--ease-standard) calc(0.4s + var(--i, 0) * 0.28s);
}

.reveal {
  transition:
    opacity 0.4s var(--ease-standard),
    transform 0.4s var(--ease-standard);
  transition-delay: calc(0.5s + var(--i, 0) * 0.28s);
}
.is-live:not(.is-drawn) .reveal {
  opacity: 0;
  transform: translateY(10px);
}

/* 建議到場那顆愛心一直跳：節拍沿用 StorySlide 收尾那顆（2.4 秒一拍），
   讓「該記哪一個時間」不只靠字級，也有一個會動的記號。
   **跳動寫在 scale、出場寫在 transform**——同一個屬性上 animation 一律蓋掉 transition，
   分成兩個屬性才不會把出場那段吃掉。reduced-motion 由 main.css 的全域 guard 收成靜止。 */
.is-drawn .beat,
.schedule:not(.is-live) .beat {
  animation: stop-beat 2.4s var(--ease-standard) 1.4s infinite;
}
@keyframes stop-beat {
  0%,
  30%,
  100% {
    scale: 1;
  }
  10% {
    scale: 1.12;
  }
  20% {
    scale: 1.04;
  }
}
</style>
