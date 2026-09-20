<!-- app/components/RsvpBannerCollage.vue — 回覆表單的大圖模板：可左右切換的照片拼貼
     參考 stockdutchdesign.com 的 banner（設計者 09-18 指定）。用 Playwright 逐幀拆過它的機制，
     照做的三件事：滑鼠跨過區塊中線就換（不用點）、底色跟著換而且慢一拍、照片隨游標輕微傾斜。

     一件刻意不照抄：它沒處理減少動態偏好（實測勾了照樣換），這裡有。
     視差幅度原本收得很小（位移 ≤5px），設計者 09-18 兩次指定加大，現在跟原站同一個量級，
     理由與數字見 style 區塊 .tilt 的註解。

     一組 = 一個底色 + 最多三張照片，賓客滑動時整組換掉。設計者指定海邊與都市兩組婚紗照，
     兩組色調差得夠遠，底色換了才看得出來。槽位固定不動，只有照片在交叉淡入——
     這是原站的做法，畫面不會因為一次切換就整個重排。 -->
<script setup lang="ts">
import type { RsvpBanner } from '~/types/api/rsvp-config'

import { RSVP_BANNER_PHOTO_MAX } from '~/types/api/rsvp-config'

const props = defineProps<{
  banners: RsvpBanner[]
  // 後台預覽是 448px 的卡片：滿寬要關掉，否則 100vw 會整個撐爆卡片、蓋住後台畫面
  // （RsvpForm.vue 的桌面裝飾層踩過同一個坑）
  preview?: boolean
}>()

// 現在是第幾組。切換只改這個數字，照片元素全程留在 DOM 裡各自淡入淡出。
// 用 defineModel 讓外層拿得到：壓在色帶上的 hero 文字要依這一組的底色決定用墨色還是紙色
const active = defineModel<number>('active', { default: 0 })

// 裝飾線的漸層要靠 id 引用；useId 在 SSR 與 client 會給同一個值，頁面上有兩個拼貼也不會撞名
const uid = useId()

const count = computed(() => props.banners.length)
const currentTone = computed(() => props.banners[active.value]?.tone ?? '')

// 槽位數＝各組之中最多的那一組的張數，上限三個（拼貼只有三個位置）
const slots = computed(() => {
  const most = Math.max(0, ...props.banners.map(b => b.photos.length))
  return Math.min(most, RSVP_BANNER_PHOTO_MAX)
})

function step(delta: number) {
  if (count.value < 2)
    return
  active.value = (active.value + delta + count.value) % count.value
}

/* ── 桌機：滑鼠跨過中線就換（原站的觸發方式）──
   記住上一次在哪一半，只有真的跨過去才切。原站沒做這件事，結果滑鼠第一次滑進區塊
   就會無故跳一組；這裡初次進入只記錄、不切換。滑出區塊後歸零，下次進來一樣只記錄 */
let half: 'left' | 'right' | null = null

function onEnterHalf(side: 'left' | 'right', event: PointerEvent) {
  if (event.pointerType !== 'mouse')
    return
  if (half && half !== side)
    step(side === 'right' ? 1 : -1)
  half = side
}

/* ── 手機：手指左右滑（沿用 story/VenueInfo.vue 的閾值與軸判斷）──
   容器掛 touch-action: pan-y，直向捲動仍交給瀏覽器、橫向的手勢才到這裡。
   橫移要超過 SWIPE_PX、而且橫向明顯多於縱向才算一次滑 */
const SWIPE_PX = 40
let swipeId: number | null = null
let swipeX = 0
let swipeY = 0

function onSwipeStart(event: PointerEvent) {
  if (event.pointerType === 'mouse')
    return
  swipeId = event.pointerId
  swipeX = event.clientX
  swipeY = event.clientY
}

function onSwipeEnd(event: PointerEvent) {
  if (swipeId === null || event.pointerId !== swipeId)
    return
  swipeId = null
  const dx = event.clientX - swipeX
  const dy = event.clientY - swipeY
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5)
    return
  // 往左滑＝下一組、往右滑＝上一組
  step(dx < 0 ? 1 : -1)
}

function onSwipeCancel() {
  swipeId = null
}

/* ── 游標視差 ──
   JS 只寫 CSS 變數、不碰 style.transform（同 useScrollProgress.ts 的慣例）。
   --px／--py 是游標在區塊內的位置，換算成 -1 ~ 1。

   不是把游標位置直接寫進去：那樣游標動一格照片就跳一格，看起來很生硬。
   改成每幀往目標靠 EASE 的比例（指數趨近），游標停下來之後照片還會再滑一小段才停，
   這就是參考站那種「很滑順」的來源。EASE 越小越黏手、拖尾越長 */
const EASE = 0.075
const root = ref<HTMLElement | null>(null)
let targetX = 0
let targetY = 0
let currentX = 0
let currentY = 0
let frame = 0

function tick() {
  currentX += (targetX - currentX) * EASE
  currentY += (targetY - currentY) * EASE
  root.value?.style.setProperty('--px', currentX.toFixed(4))
  root.value?.style.setProperty('--py', currentY.toFixed(4))
  // 夠接近目標就收工，不留一個空轉的迴圈
  frame = Math.abs(targetX - currentX) > 0.0008 || Math.abs(targetY - currentY) > 0.0008
    ? requestAnimationFrame(tick)
    : 0
}

function aimAt(x: number, y: number) {
  targetX = x
  targetY = y
  if (!frame)
    frame = requestAnimationFrame(tick)
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || !root.value)
    return
  const rect = root.value.getBoundingClientRect()
  if (!rect.width || !rect.height)
    return
  aimAt(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    ((event.clientY - rect.top) / rect.height) * 2 - 1,
  )
}

function onPointerLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse')
    return
  half = null
  // 滑鼠離開就讓照片自己滑回原位，不是瞬間歸零
  aimAt(0, 0)
}

onBeforeUnmount(() => {
  if (frame)
    cancelAnimationFrame(frame)
})

// 外層要知道色帶捲出畫面了沒（送出列那時才出現）。明確交出根元素，不讓外層去摸 $el：
// template 開頭有註解，開發模式下根節點是 fragment，$el 拿到的是一個文字節點、不是這個 div
defineExpose({ root })
</script>

<template>
  <!-- role="img" 加單一 aria-label：整塊在輔助技術裡合成一個圖，不會連唸好幾次「婚禮主視覺」。
       底色用 inline style 綁資料——這是新人挑的色，不是設計 token，不能寫死 -->
  <div
    ref="root"
    class="collage relative select-none overflow-hidden"
    :class="preview ? 'w-full rounded-sm' : 'is-bleed'"
    role="img"
    aria-label="婚禮主視覺"
    :style="{ backgroundColor: currentTone }"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @pointerdown="onSwipeStart"
    @pointerup="onSwipeEnd"
    @pointercancel="onSwipeCancel"
  >
    <!-- 照片區：往上倒扣掉頁面留給固定選單鈕的那條頂端留白（--bleed-top），
         底色因此填到畫面最頂端，照片本身仍然落在選單鈕下面 -->
    <div class="field absolute inset-x-0 bottom-0">
      <!-- 舞台：底色滿寬鋪到螢幕兩邊，照片本身收在一個上限寬度內置中，
           否則 2000px 的螢幕上三張照片會被拉到兩端、中間開一個大洞。
           內縮一圈，四周才留得住底色；槽位的百分比都相對這個內框 -->
      <div class="stage absolute">
        <!-- 背後那條裝飾線（設計者 09-19 版面圖，座標是從圖上描下來再換算的）：
             左緣中段進來 → 鑽到左邊照片後面 → 出來往上挑到標題上緣、折回一個尖 →
             另一筆從標題後面淡入 → 鑽過右上照片 → 往右繞一個弧勾進右下照片 → 從右緣出去。
             整條線是穿過構圖中段的，照片和大字都壓在線上面；
             第一版畫在色帶上緣的空白處，沒有東西壓到它，被設計者退回。

             放在舞台裡、用舞台的座標（1344×544）：照片的位置是相對舞台算的，
             線跟著同一個框才對得上照片；放在色帶上的話 2000px 螢幕的弧會飄在照片外面。
             舞台比 1344 窄的時候橫向會被壓扁一點（preserveAspectRatio none），
             對一條自由曲線來說看不出來，換到的是左右兩端永遠對得上各自那叢照片。
             沒有 z-index、照片槽有，所以線在照片底下；文字那層在更上面。
             兩端畫到舞台外很遠是為了超寬螢幕也能碰到螢幕邊，多的由頁面的 overflow-x: clip 收掉 -->
        <svg
          v-if="!preview"
          class="flourish pointer-events-none absolute inset-0 hidden size-full overflow-visible text-paper xl:block"
          viewBox="0 0 1344 544"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient :id="`${uid}-out`" gradientUnits="userSpaceOnUse" x1="560" y1="40" x2="508" y2="148">
              <stop offset="0" stop-color="currentColor" />
              <stop offset="1" stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
            <linearGradient :id="`${uid}-in`" gradientUnits="userSpaceOnUse" x1="690" y1="0" x2="800" y2="0">
              <stop offset="0" stop-color="currentColor" stop-opacity="0" />
              <stop offset="1" stop-color="currentColor" />
            </linearGradient>
          </defs>
          <!-- 透明度掛在 g 上、不掛在各條線上：兩筆在尖端相接，各自半透明的話接點會疊成一顆深點 -->
          <g opacity="0.6" stroke="currentColor" stroke-width="1.25" stroke-linecap="round">
            <path d="M -1400 345 C -500 330 -157 277 73 139 C 173 79 347 104 457 84 C 507 75 542 46 572 22" />
            <path d="M 572 22 C 556 46 520 96 506 152" :stroke="`url(#${uid}-out)`" />
            <path d="M 690 86 C 740 78 790 70 838 67 C 940 61 1040 58 1132 69 C 1200 77 1276 92 1276 132 C 1276 168 1215 235 1150 290" :stroke="`url(#${uid}-in)`" />
            <path d="M 1150 332 C 1200 314 1250 296 1291 281 C 1391 245 1900 120 2700 60" />
          </g>
        </svg>

        <div
          v-for="slot in slots"
          :key="slot"
          class="slot absolute left-0 top-0"
          :class="`slot-${slot - 1}`"
        >
          <!-- 兩層 transform：外層 slot 吃槽位（固定不動），內層 tilt 吃游標視差（即時跟，不過渡）。
               疊在同一個元素上會互相覆蓋。每個槽疊著各組的同一位照片，只有現在這組是不透明的 -->
          <div class="tilt size-full">
            <template v-for="(banner, i) in banners" :key="i">
              <img
                v-if="banner.photos[slot - 1]"
                :src="banner.photos[slot - 1]"
                alt=""
                decoding="async"
                :loading="i === 0 ? 'eager' : 'lazy'"
                class="photo absolute inset-0 block size-full object-cover"
                :class="{ 'is-on': i === active }"
                @dragstart.prevent
              >
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 左右感應區：純百分比定位，不算視窗寬度，所以 448px 的後台預覽卡裡也對。
         只有兩組以上才有東西可切 -->
    <template v-if="count > 1">
      <div class="absolute inset-y-0 left-0 z-10 w-1/2" @pointerenter="onEnterHalf('left', $event)" />
      <div class="absolute inset-y-0 right-0 z-10 w-1/2" @pointerenter="onEnterHalf('right', $event)" />
    </template>
  </div>
</template>

<style scoped>
/* 動效三條硬原則（creative-direction §4）：
   1. 減少動態偏好交給 main.css 的全域 guard（transition-duration 被歸零，切換直接跳位）
   2. 只動 opacity 與底色；沒有任何 layout 屬性參與過渡
   3. duration 只用內建三檔的值，easing 用 token */
.collage {
  /* 16:10 不是 16:9：主圖要維持直式，太扁的框會逼主圖縮成一條、右邊留一大塊空白 */
  aspect-ratio: 16 / 10;
  /* 直向捲動交給瀏覽器，只有橫向手勢進到 onSwipeEnd */
  touch-action: pan-y;
  /* 底色比照片慢一拍：原站實測是照片 250ms、底色 700ms，刻意不同步，
     整塊看起來會一直在變。這裡壓進三檔內，用 150ms 延遲做出同樣的層次 */
  transition: background-color 400ms var(--ease-standard) 150ms;
}

/* 滿寬：表單住在 max-w-2xl（672px）的欄裡，這一塊要掙脫出去鋪到螢幕兩邊。
   margin-inline 那式把自己往左右各推到視窗邊緣；100vw 含捲軸寬，會多出十幾 px 的
   水平捲動，所以公開頁與 guest layout 的最外層加了 overflow-x: clip 收掉。
   overflow-x 不會給 position: fixed 建立包含塊，固定送出列仍然貼齊視窗 */
.collage.is-bleed {
  width: 100vw;
  margin-inline: calc(50% - 50vw);
  /* 滿寬之後不能再用 aspect-ratio：1440 寬的 16:10 是 900px 高，整個首屏都被照片吃掉。
     改成隨寬度成長但封頂的高度 */
  aspect-ratio: auto;
  /* 往上倒扣掉頁面留給固定選單鈕的頂端留白，底色才會填到畫面最頂端。
     --bleed-top 由頁面自己設（跟它的 padding-top 寫在一起，兩個值要一致） */
  margin-top: calc(var(--bleed-top, 0px) * -1);
  /* 高度要撐得住中間那一整落文字：英文大字兩行就佔掉一半，
     再扣掉上下留白才不會讓最後一行貼著色帶下緣。
     用 vw 跟著螢幕長：窄螢幕配小一級的英文字，寬螢幕才放到最大級 */
  height: calc(clamp(22rem, 40vw, 44rem) + var(--bleed-top, 0px));
}

/* 照片區：把倒扣掉的那一條讓回來，照片不會跑到選單鈕底下 */
.is-bleed .field {
  top: var(--bleed-top, 0px);
}

.collage:not(.is-bleed) .field {
  top: 0;
}

/* 舞台寬度由高度推導（aspect-ratio），不是螢幕寬度的百分比：
   這樣它永遠剛好包住三張照片，left-1/2 置中才會真的置中。
   1.72 是下面三個槽加起來的總寬（2.28 個主圖寬 × 主圖的 0.75 寬高比） */
.stage {
  inset-block: 5%;
  left: 50%;
  translate: -50% 0;
  aspect-ratio: 1.72;
}

.slot {
  /* transform-origin 放左上：translate 與 scale 才好各自推算，不必再扣一次中心點 */
  transform-origin: 0 0;
  /* 主圖固定直式 3:4：寬度由高度推導，不用螢幕寬度的百分比。
     滿寬之後框會變得又寬又扁，用寬度百分比算主圖會被拉成橫的 */
  height: 100%;
  width: auto;
  aspect-ratio: 3 / 4;
  translate: var(--sx) var(--sy);
  scale: var(--ss);
  z-index: var(--sz);
}

/* 中小尺寸：三張由左往右依序錯落、各自疊住前一張一角。
   sx／sy 是主圖寬高的百分比，所以整組會跟著縮放一起走。
   --sd 是視差深度，比例沿用原站的 1 : 1.33 : 2 */
.slot-0 { --sx: 0%; --sy: 2%; --ss: 0.94; --sz: 2; --sd: 1; }
.slot-1 { --sx: 100%; --sy: -13%; --ss: 0.78; --sz: 3; --sd: 1.33; }
.slot-2 { --sx: 162%; --sy: 38%; --ss: 0.66; --sz: 1; --sd: 2; }

/* 桌機：照片分成左右兩叢、中間讓出一塊空白給 hero 文字（設計者指定照參考站的排法）。
   舞台改成撐滿可用寬度（有上限），右邊那兩張改從右緣往回推，中間的縫才會隨螢幕一起長。
   門檻是 xl（1280）不是 lg：1024 時中間的縫只剩 163px，文字整排壓到照片上。
   RsvpForm.vue 把 hero 壓上色帶用的是同一個門檻，兩邊要一起改 */
@media (width >= 80rem) {
  /* 照片往下跨出色帶一截，踩進底下的 cream 區。
     色帶和頁面底色是兩個中明度的顏色，全寬硬碰會看起來像被切一半；
     讓照片橫過那條線就把它打斷了（表單那邊用 lg:mt-24 讓開） */
  /* 色帶高度改由照片高度反推（設計者 09-19：物件離頂端太遠，整體要往上）。
     前一版是色帶跟著 40vw 長、照片封頂又貼底，螢幕越寬頂端空得越多（2000px 時空了 300px）。
     現在由上往下排：頂端留 2.5rem（右上那張的上緣剛好跟選單鈕同高）→ 照片 → 色帶下緣收在
     照片底往上 7% 的地方，照片因此仍然跨出色帶一截。
     --stage-h 是定值不跟螢幕長：照片寬度是由高度推導的，照片一長高就變寬、把中間留給文字的縫吃掉；
     但也不能再小——色帶高度由它反推，要裝得下中間那一落 96px 的英文大字 */
  .collage.is-bleed {
    --stage-h: 34rem;
    overflow: visible;
    /* 0.99 = 右上那張往上凸的 0.10 + 照片底緣 0.96 − 跨出色帶的 0.07 */
    height: calc(2.5rem + var(--stage-h) * 0.99);
  }

  /* 桌機不再把頂端那條讓出來：右上那張照片就是要升到選單鈕旁邊。
     選單鈕在螢幕最右上角，照片叢的右緣離它還有一段，量過各寬度都不會疊到 */
  .is-bleed .field {
    top: 0;
  }

  /* 以下全部只套在滿寬版（.is-bleed）：media query 看的是螢幕寬度，後台螢幕一寬，
     448px 的預覽卡也會中這個斷點，左右兩叢照片擠在一張小卡裡會疊成一團。預覽卡固定用上面的窄版排法 */
  .is-bleed .stage {
    inset-block: calc(2.5rem + var(--stage-h) * 0.1) auto;
    height: var(--stage-h);
    width: min(100% - 3rem, 84rem);
    aspect-ratio: auto;
  }

  /* 右側兩張換成靠右：原點跟著移到右上角，縮放才是往右緣收、不是往左漂 */
  .is-bleed .slot-1,
  .is-bleed .slot-2 {
    left: auto;
    right: 0;
    transform-origin: 100% 0;
  }

  /* 往中間收一點（設計者 09-18）：左邊那張右移、右邊兩張左移，兩側不再貼著螢幕邊緣。
     --sz 在這裡重排：最右邊那張要壓在最上層。
     左邊那張的內移量跟著螢幕收放：1280 時中間的縫最窄，照片右緣離邀請語只有 6px，
     視差一推就壓到字；所以窄的時候少移一點（1280 約 5%），到 1440 才回到設計者指定的 18% */
  .is-bleed .slot-0 { --sx: clamp(4%, (100vw - 76rem) * 0.3, 18%); --sy: 2%; --ss: 0.94; --sz: 1; }
  .is-bleed .slot-1 { --sx: -52%; --sy: -10%; --ss: 0.72; --sz: 2; }
  .is-bleed .slot-2 { --sx: -13%; --sy: 36%; --ss: 0.60; --sz: 3; }
}

/* 大螢幕：英文大字在這裡放到最大一級（132px），色帶要跟著高才裝得下那一落文字，
   所以照片放大一號；舞台同步放寬，不然照片變寬會把中間的縫擠掉 */
@media (width >= 96rem) {
  .collage.is-bleed {
    --stage-h: min(40vw, 40rem);
  }

  .is-bleed .stage {
    width: min(100% - 3rem, 108rem);
  }
}

/* 手機：框改直一點、主圖佔比拉大，三張才不會縮成三張郵票 */
@media (width < 40rem) {
  .collage { aspect-ratio: 4 / 3; }
  /* 不能只寫 aspect-ratio：那樣頂端補的那一條會從照片區裡扣掉，色帶越補照片越小。
     高度自己算，把補的那條加回去 */
  .collage.is-bleed {
    aspect-ratio: auto;
    height: calc(75vw + var(--bleed-top, 0px));
  }
  /* 三槽總寬 1.81 個主圖寬 × 主圖 0.75 的寬高比 = 1.36 */
  .stage { aspect-ratio: 1.36; }
  .slot-0 { --sx: 0%; --sy: 0%; --ss: 1; }
  .slot-1 { --sx: 96%; --sy: 44%; --ss: 0.54; }
  .slot-2 { --sx: 145%; --sy: 2%; --ss: 0.36; }
}

/* 窄版 banner 上方保留 12rem 給 RSVP 與英文標題，照片維持原本的高度。 */
@media (width < 80rem) {
  .collage.is-bleed {
    height: calc(clamp(22rem, 40vw, 44rem) + var(--bleed-top, 0px) + 12rem);
  }

  .is-bleed .field {
    top: calc(var(--bleed-top, 0px) + 12rem);
    bottom: 0;
  }
}

@media (width < 40rem) {
  .collage.is-bleed {
    height: calc(75vw + var(--bleed-top, 0px) + 12rem);
  }
}

/* 裝飾線：舞台被壓扁時線寬不跟著變，永遠是一條細線。
   vector-effect 不會繼承，所以不能只寫在 g 上 */
.flourish path {
  vector-effect: non-scaling-stroke;
}

/* 交叉淡入：離開的那組淡出、進來的那組淡入，槽位本身不動（原站就是這樣） */
.photo {
  opacity: 0;
  transition: opacity 250ms var(--ease-standard);
}

.photo.is-on {
  opacity: 1;
}

/* 游標視差。設計者 09-18 兩次指定加大，現在最深的那一層位移 ±76px、旋轉 ±5.4°，
   跟參考站的 ±100px／±7.7° 同一個量級。這已遠超 §4 舉例的「hover 微互動」幅度——
   是設計者對這一頁的指定，不是預設值，其他頁沿用前要再問。
   滑順度不是靠 transition（那會跟不上游標），是靠 JS 每幀的指數趨近，見 script 的 tick() */
.tilt {
  transform:
    perspective(900px)
    translate3d(
      calc(var(--px, 0) * var(--sd, 1) * 38px),
      calc(var(--py, 0) * var(--sd, 1) * 22px),
      0
    )
    rotateY(calc(var(--px, 0) * 5.4deg))
    rotateX(calc(var(--py, 0) * -3.6deg));
}

/* 視差沒有 transition，全域 guard 管不到，這裡自己關掉 */
@media (prefers-reduced-motion: reduce) {
  .tilt { transform: none; }
}
</style>
