<!-- app/components/story/VenueInfo.vue — 婚宴資訊區塊。
     版面骨架參考 kevin-irene-wedding-invitation.vercel.app/info：桌機左「在哪裡＋地圖」、右「怎麼去」，
     區塊之間只用細線分隔不做卡片，每個小標題底下墊一行小寫英文回音。
     中文內文一律 Noto Serif TC，與故事段同一套；英文小標（When & Where、Getting There、日期／地址這類 dt）維持無襯線，它們是資料標籤。
     整區讀成四拍：場館名 → 場地照（外觀／廳內輪播，滿寬橫幅）→ 哪裡（時間地點＋地圖）與怎麼去（交通折疊）並排 → 穿什麼（色票）。
     場地照 2026-09-15 從左欄底下搬到標題正下方：留在左欄時左欄被照片拉到 y≈990、右欄折疊收合後 y≈660 就結束，右下空出 330px；
     改成橫幅之後兩欄都只剩文字，底部相差不到一行。桌機橫幅 2:1、手機維持 4:3（手機一欄，照片本來就不需要壓扁）。
     著裝建議以色票呈現（色碼是婚禮資料，不是介面色）。 -->
<script setup lang="ts">
import type { StoryVenue } from '~/types/story'

const props = defineProps<{
  venue: StoryVenue
}>()

// 交通四組全攤開在手機上超過三屏，改單開折疊：賓客只會用其中一種交通方式，找到自己那格點開就好。
// null＝全部收合；再點同一格會收回去。
const openKey = ref<string | null>(null)

function toggleGroup(key: string) {
  openKey.value = openKey.value === key ? null : key
}

// 場地照原地輪播：每 5 秒淡入下一張。自動變換的內容要能停（WCAG 2.2.2）——點下方的圓點就換到那張、之後不再自動換；
// 游標停在照片上暫停、照片不在畫面內不跑、reduced-motion 不自動換（只留圓點手動切）。
// 手機也可以左右滑（新人 09-17）：滑了跟點圓點一樣停掉自動輪播；手動切的那一下換得快一點（0.5 秒），自動輪播維持 1.2 秒
const PHOTO_MS = 5000
const QUICK_MS = 600
const photoIndex = ref(0)
const photoFrame = ref<HTMLElement | null>(null)
const quick = ref(false)
let quickTimer = 0
const currentPhoto = computed(() => props.venue.photos[photoIndex.value] ?? props.venue.photos[0])
/** 桌機橫幅把 4:3 的照片裁成 2:1，各張的裁切重心（object-position 的 y）依內容層的順序排：
 *  外觀照（大樓在上、階梯與入口在下）取偏下，把「晶宴」招牌與入口留在框內、只犧牲頂樓；廳內照取略偏上，吊燈與桌面都在。
 *  手機是 4:3 框放 4:3 照，重心不影響裁切 */
const PHOTO_FOCUS_Y = ['62%', '45%']
let photoTimer = 0
let photoInView = false
let photoHovered = false
let photoPicked = false
let photoObserver: IntersectionObserver | null = null

function syncPhotoTimer() {
  const run = props.venue.photos.length > 1 && photoInView && !photoHovered && !photoPicked
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (run && !photoTimer) {
    photoTimer = window.setInterval(() => {
      photoIndex.value = (photoIndex.value + 1) % props.venue.photos.length
    }, PHOTO_MS)
  }
  else if (!run && photoTimer) {
    clearInterval(photoTimer)
    photoTimer = 0
  }
}

function hoverPhoto(on: boolean) {
  photoHovered = on
  syncPhotoTimer()
}

function pickPhoto(i: number) {
  photoIndex.value = i
  photoPicked = true
  quick.value = true
  clearTimeout(quickTimer)
  quickTimer = window.setTimeout(() => {
    quick.value = false
  }, QUICK_MS)
  syncPhotoTimer()
}

/* 左右滑切換：frame 掛 touch-action: pan-y，直向捲動仍交給瀏覽器、橫向的手勢才到這裡。
   手指橫移超過 SWIPE_PX、而且橫向明顯多於縱向才算一次滑；往左滑＝下一張、往右滑＝上一張 */
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
  const n = props.venue.photos.length
  if (n < 2)
    return
  pickPhoto((photoIndex.value + (dx < 0 ? 1 : n - 1)) % n)
}

function onSwipeCancel() {
  swipeId = null
}

onMounted(() => {
  if (!photoFrame.value)
    return
  photoObserver = new IntersectionObserver(([entry]) => {
    photoInView = !!entry?.isIntersecting
    syncPhotoTimer()
  })
  photoObserver.observe(photoFrame.value)
})

onBeforeUnmount(() => {
  photoObserver?.disconnect()
  clearInterval(photoTimer)
  clearTimeout(quickTimer)
})
</script>

<template>
  <section id="wedding-info" aria-labelledby="story-venue-title" class="bg-cream px-6 py-20 lg:py-28">
    <div class="mx-auto max-w-4xl">
      <!-- 眉標（WEDDING INFO · 婚宴資訊）2026-09-15 拿掉：六個區塊都掛眉標是模板味，場地名本身就是這一區的標題 -->
      <h2 id="story-venue-title" class="text-center font-serif-tc text-h2 font-semibold text-ink">
        {{ venue.venueName }}
      </h2>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />

      <!-- 場地照：外觀與廳內疊在同一個框裡交替淡入（照片同為 4:3）。桌機框是 2:1 的橫幅、手機 4:3；
           沒有 JS 時停在第一張；看不見的那張 aria-hidden，讀屏只讀現在這張。手機在框上左右滑也能換 -->
      <figure v-if="currentPhoto" class="mt-12">
        <div
          ref="photoFrame"
          class="frame"
          :class="{ 'is-quick': quick }"
          @pointerenter="hoverPhoto(true)"
          @pointerleave="hoverPhoto(false)"
          @pointerdown="onSwipeStart"
          @pointerup="onSwipeEnd"
          @pointercancel="onSwipeCancel"
        >
          <div class="relative aspect-4/3 overflow-hidden lg:aspect-2/1">
            <img
              v-for="(photo, i) in venue.photos"
              :key="photo.src"
              :src="photo.src"
              :alt="photo.alt"
              width="1200"
              height="900"
              loading="lazy"
              class="venue-photo absolute inset-0 block size-full object-cover"
              :class="{ 'is-shown': i === photoIndex }"
              :style="{ '--focus-y': PHOTO_FOCUS_Y[i] ?? '50%' }"
              :aria-hidden="i === photoIndex ? undefined : 'true'"
            >
          </div>
        </div>
        <figcaption class="mt-3 text-center font-serif-tc text-caption tracking-wider text-ink-500">
          {{ currentPhoto.caption }}
        </figcaption>
        <!-- 圓點：看得出有幾張、現在第幾張，也是停止自動輪播的方式。點本身 6px，命中範圍 24px -->
        <div v-if="venue.photos.length > 1" class="mt-1 flex justify-center">
          <button
            v-for="(photo, i) in venue.photos"
            :key="photo.src"
            type="button"
            class="flex size-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
            :aria-label="`看場地照：${photo.caption}`"
            :aria-current="i === photoIndex ? 'true' : undefined"
            @click="pickPhoto(i)"
          >
            <span class="block size-1.5 rounded-full transition-colors duration-250" :class="i === photoIndex ? 'bg-gold-deep' : 'bg-line'" />
          </button>
        </div>
      </figure>

      <div class="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <!-- 左欄：在哪裡 -->
        <div>
          <h3 class="font-serif-tc text-h3 font-semibold text-ink">
            時間與地點
          </h3>
          <p class="mt-2 text-overline uppercase text-ink-300">
            When &amp; Where
          </p>

          <dl class="mt-8 space-y-6">
            <div>
              <!-- 只有日期：入席／建議到場／開席三個時間歸 StorySchedule，同一份資訊不在兩區各寫一次 -->
              <dt class="text-caption uppercase text-ink-300">
                日期
              </dt>
              <dd class="mt-1 font-serif-tc text-body-l text-ink">
                {{ venue.dateTime }}
              </dd>
            </div>
            <div>
              <dt class="text-caption uppercase text-ink-300">
                廳別
              </dt>
              <dd class="mt-1 font-serif-tc text-body-l text-ink">
                {{ venue.hallName }}
              </dd>
            </div>
            <div>
              <dt class="text-caption uppercase text-ink-300">
                地址
              </dt>
              <dd class="mt-1 font-serif-tc text-body-l text-ink">
                {{ venue.address }}
              </dd>
            </div>
          </dl>

          <a
            :href="venue.mapLink"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-6 inline-flex items-center gap-3 border-b border-gold pb-2 font-serif-tc text-body text-ink transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
          >
            開啟地圖與導航 <span aria-hidden="true">↗</span>
          </a>
        </div>

        <!-- 右欄：怎麼去、穿什麼 -->
        <div>
          <h3 class="font-serif-tc text-h3 font-semibold text-ink">
            交通方式
          </h3>
          <p class="mt-2 text-overline uppercase text-ink-300">
            Getting There
          </p>

          <!-- 共通下車點提到最上面說一次，各條路線就不必逐條重複 -->
          <p class="mt-6 font-serif-tc text-body text-ink-700">
            {{ venue.transport.dropOff }}
          </p>

          <div class="mt-6 border-t border-line">
            <div v-for="group in venue.transport.groups" :key="group.key" class="border-b border-line">
              <h4>
                <button
                  :id="`venue-transport-tab-${group.key}`"
                  type="button"
                  :aria-expanded="openKey === group.key"
                  :aria-controls="`venue-transport-panel-${group.key}`"
                  class="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors duration-150 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
                  @click="toggleGroup(group.key)"
                >
                  <span>
                    <span class="block font-serif-tc text-body-l font-semibold text-ink">{{ group.title }}</span>
                    <span class="mt-1 block text-overline uppercase text-ink-300">{{ group.titleEn }}</span>
                  </span>
                  <!-- 加號轉減號：直槓只縮不消失，動的是 transform／opacity，不碰 layout -->
                  <span class="relative block size-3 shrink-0" aria-hidden="true">
                    <span class="absolute inset-x-0 top-1/2 h-px bg-ink-500" />
                    <span
                      class="absolute inset-y-0 left-1/2 w-px bg-ink-500 transition duration-250 ease-standard"
                      :class="openKey === group.key ? 'scale-y-0 opacity-0' : 'scale-y-100 opacity-100'"
                    />
                  </span>
                </button>
              </h4>

              <Transition
                enter-active-class="transition duration-250 ease-standard"
                enter-from-class="opacity-0"
                leave-active-class="transition duration-150 ease-standard"
                leave-to-class="opacity-0"
              >
                <div
                  v-show="openKey === group.key"
                  :id="`venue-transport-panel-${group.key}`"
                  role="region"
                  :aria-labelledby="`venue-transport-tab-${group.key}`"
                  class="pb-6"
                >
                  <p v-if="group.note" class="font-serif-tc text-body text-ink-700">
                    {{ group.note }}
                  </p>
                  <dl :class="group.note ? 'mt-4 space-y-4' : 'space-y-4'">
                    <div v-for="route in group.routes" :key="route.label">
                      <dt class="text-caption uppercase text-ink-300">
                        {{ route.label }}
                      </dt>
                      <dd class="mt-1 font-serif-tc text-body text-ink-700">
                        {{ route.detail }}
                      </dd>
                    </div>
                  </dl>
                </div>
              </Transition>
            </div>
          </div>

          <a
            :href="venue.transport.lineUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-6 inline-block font-serif-tc text-body font-medium text-gold-deep underline decoration-gold-light underline-offset-4 transition-colors duration-150 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
          >
            {{ venue.transport.lineLabel }}
          </a>
        </div>
      </div>

      <!-- 穿搭獨立呈現；場地照片與導航留在上方婚宴資訊。 -->
      <div class="mt-14 border-t border-line pt-14">
        <!-- 標題 2026-09-15 改成「中文大標在上、英文回音在下」：原本是眉標→英文大標→中文副標，
             跟同區「時間與地點／When & Where」「當天流程／Wedding Day」反著走，全頁只有這裡與花田是英文大標。
             中文標「服裝建議」與上面兩個小標同級（text-h3 semibold）；英文回音用內容層的 eyebrow（Dress Code）。
             置中則是跟著這塊自己的內容走——色票、結語本來就置中，標題靠左會變成一行落單的字。 -->
        <h3 class="text-center font-serif-tc text-h3 font-semibold text-ink">
          服裝建議
        </h3>
        <p class="mt-2 text-center text-overline uppercase text-gold-deep">
          {{ venue.dressCode.eyebrow }}
        </p>
        <p class="mt-6 text-center font-serif-tc text-body-l text-ink-700">
          {{ venue.dressCode.subtitle }}
        </p>

        <!-- 白色花草：新人稿子裡就畫在副標與色票之間。它是一個標點不是一張圖，
             所以只有 72px 高——大到會變成第二個焦點，跟上面的標題互搶 -->
        <img
          v-if="venue.dressCode.flower"
          :src="venue.dressCode.flower.src"
          :alt="venue.dressCode.flower.alt"
          :width="venue.dressCode.flower.width"
          :height="venue.dressCode.flower.height"
          loading="lazy"
          class="mx-auto mt-6 block"
        >

        <!-- 手機四張排一列會擠到英文名逐字斷行；2×2 grid 讓每格拿到夠寬的字欄，
             也不會有第四張落單置中看起來像漏排。640px 以上回到一排四張。
             最寬的香檳飄帶是 142px，欄寬（手機 159／桌機 168）都容得下 -->
        <ul class="mx-auto mt-10 grid max-w-sm grid-cols-2 gap-x-6 gap-y-8 sm:max-w-3xl sm:grid-cols-4 sm:gap-x-8">
          <li v-for="swatch in venue.dressCode.swatches" :key="swatch.name" class="text-center">
            <!-- 四張插畫的長寬比是 2:1／3:2／1:1／1:1，畫布原本還有大片透明邊，
                 所以「用同一個外框對齊」會失真：香檳被壓扁、米白反而顯得最大。
                 轉檔時已先裁到 alpha 邊界，再讓四張的 √(寬×高) 相等（幾何平均）——
                 只對齊高度的話，2:1 的香檳會比 1:1 的米白寬一倍、看起來大一倍；
                 只對齊面積則相反，筆觸最疏的香檳會被放大到失控。
                 所以顯示尺寸四張各不相同（142×69／119×82／98×100／99×99），寫在內容層。
                 外層固定 104px 高、置中對齊，四行標籤才會落在同一條線上 -->
            <span class="swatch-art flex h-28 items-center justify-center">
              <img
                :src="swatch.image.src"
                :alt="swatch.image.alt"
                :width="swatch.image.width"
                :height="swatch.image.height"
                loading="lazy"
                class="block"
              >
            </span>
            <span class="mx-auto mt-4 block h-2 w-16 rounded-full border border-ink/10" :style="{ backgroundColor: swatch.hex }" aria-hidden="true" />
            <span class="mt-4 block font-serif-tc text-body font-medium text-ink">{{ swatch.name }}</span>
            <span class="mt-1 block text-caption uppercase tracking-widest text-ink-500">{{ swatch.nameEn }}</span>
          </li>
        </ul>

        <!-- 手繪人物：新人尚未提供，沒值就整組不渲染。版面已經留好位子，之後只補內容層的值 -->
        <ul
          v-if="venue.dressCode.figures?.length"
          class="mx-auto mt-12 flex max-w-xl flex-wrap items-end justify-center gap-x-12 gap-y-8"
        >
          <li v-for="figure in venue.dressCode.figures" :key="figure.src" class="text-center">
            <img
              :src="figure.src"
              :alt="figure.alt"
              :width="figure.width"
              :height="figure.height"
              loading="lazy"
              class="mx-auto block h-40 w-auto"
            >
            <span class="mt-3 block text-caption uppercase tracking-widest text-ink-500">{{ figure.caption }}</span>
          </li>
        </ul>

        <!-- 結語兩句沿用標題那一組的節奏（英文在上、中文在下），但音量降一階：
             收尾與開頭成一對書擋，中間的色票才是這一塊真正的主角 -->
        <p class="mx-auto mt-12 max-w-3xl text-center font-display text-body-l text-ink-700">
          {{ venue.dressCode.closingEn }}
        </p>
        <p class="mx-auto mt-2 max-w-3xl text-center font-serif-tc text-body text-ink-500">
          {{ venue.dressCode.closing }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 場地照交替：只動 opacity。1.2 秒比三檔長——照片換照片用 400ms 會像閃一下，
   比照時間軸金線（1.4s）這類「慢慢出現」的敘事動效；reduced-motion 由 main.css 的全域 guard 收成瞬間 */
.venue-photo {
  opacity: 0;
  /* 裁切重心：桌機 2:1 的框只放得下 4:3 照片的三分之二高，y 由 PHOTO_FOCUS_Y 逐張給 */
  object-position: 50% var(--focus-y, 50%);
  transition: opacity 1.2s var(--ease-standard);
}
.venue-photo.is-shown {
  opacity: 1;
}
/* 手動切（滑、點圓點）換得快一點：手指才剛放開就要看到回應 */
.is-quick .venue-photo {
  transition-duration: 0.5s;
}

.swatch-art {
  position: relative;
  isolation: isolate;
}

.swatch-art::before {
  content: '';
  position: absolute;
  z-index: -1;
  width: 144px;
  height: 112px;
  border-radius: 50%;
  background: radial-gradient(ellipse, #ded5c9 0%, #e9e1d7 48%, transparent 72%);
}

.swatch-art img {
  filter: drop-shadow(0 3px 3px rgb(92 73 49 / 18%));
}

/* 拍立得白框：語彙與投影量沿用 StorySlide.vue 的 .frame。
   實拍是這一區唯一的高飽和素材，白框把它框成一件擺在紙上的實物，不讓紅金糊進米金版面。
   scoped 不跨檔，全站只有這兩處用得到，抽共用元件是多一層。

   唯一改掉的是 padding：StorySlide 用 6%／14%，但 % 是對自身寬度算的，
   那邊的照片只有 150–190px 寬（襯邊實際 9–11px、下緣 21–26px，是一張真的拍立得）。
   同一組 % 套到這裡 768px 的橫幅上會膨脹成 46px／107px 的白邊，
   不再像相紙，而變成這一區明令不做的白色卡片。改成固定 px，
   讓襯邊維持同一個「實物尺寸」，兩張照片與桌機手機都一致。 */
.frame {
  background: #fff;
  padding: 8px 8px 20px;
  border-radius: 2px;
  box-shadow:
    0 1px 1px rgb(17 17 17 / 6%),
    0 8px 22px rgb(17 17 17 / 8%);
  /* 直向捲動交給瀏覽器，橫向的手勢留給左右滑換照片 */
  touch-action: pan-y pinch-zoom;
}
</style>
