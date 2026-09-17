<!-- app/components/story/StorySlide.vue — 故事的一頁：頁碼、標題、幾行文字、兩張拍立得（＋插畫），與時間軸。
     時間軸：桌機是一條橫線貼在畫面下方 --rail-y 處、跨越整頁寬度，與前後頁接成同一條。
     有「兩地相隔」的頁在線上用兩顆愛心框出公里數（站）；沒有距離變化的頁線直接穿過、中間一顆小一點的愛心（片刻）；
     最後一頁距離歸零：金線從兩邊往中間畫，兩顆愛心從兩端走向中央、合成一顆。
     手機改成左緣一條直線往下接，愛心與公里數排在直線旁；順序是文字 → 站（愛心＋公里數）→ 照片，
     站排在照片之前，一屏就看得到，不必在頁內再捲一次。
     slide.visual 有值的那一頁（歸零）不排照片，改放程式畫的視覺（一對粒子婚戒 StoryRings）；
     那一站合起來的愛心也換成網點版（StoryHeartDots），跟戒指同一套灰金圓點。
     出場分兩段：這一頁被走到時（drawn）標題先浮出、內文一句接一句跟上、線分段畫、愛心浮出、數字從上一段的公里數走到這一段；
     軌道停穩後（settled）拼貼件才照疊放順序一件一件落下（每件隔 90ms），不跟翻頁的平移疊在一起。
     全部是 transform／opacity／scale／translate 的 transition，順序用 transition-delay 排（--at、--i）。
     SSR／無 JS（live=false）直接是終態：線畫滿、愛心在位、文字照片都在，沒有東西被藏死。 -->
<script setup lang="ts">
import type { StoryObject, StorySlide } from '~/types/story'

const props = defineProps<{
  slide: StorySlide
  /** 在整組面板裡的序號（首屏是 0），也是頁碼 */
  index: number
  /** 使用者已走到這一頁（到過就不收回） */
  drawn: boolean
  /** 軌道已停在這一頁（停過就不收回）：拼貼件等這個才出場 */
  settled: boolean
  /** JS 已接管；false 時不藏任何東西 */
  live: boolean
  /** 上一個標記的公里數，數字從這裡走到本頁 */
  prevKm: number
}>()

/** 佔位照片的傾角（新人給的素材自帶白框與傾角，不再轉） */
const ROTATIONS = [-3, 4]

const marker = computed(() => props.slide.marker)
const km = computed(() => (marker.value?.kind === 'span' ? marker.value.km : 0))
// 數字等左段畫到、第一顆愛心浮出才開始走（兩地那段金線同步）；歸零那頁等兩顆愛心開始往中間走
const { shown } = useCountUp(() => props.drawn, () => props.prevKm, km, {
  delay: marker.value?.kind === 'zero' ? 500 : 150,
  duration: 700,
})

/** 壓在照片下面的先畫，其餘的後畫——層次靠 DOM 順序，不動 z-index */
const objectsBehind = computed(() => props.slide.objects?.filter(o => o.behind) ?? [])
const objectsFront = computed(() => props.slide.objects?.filter(o => !o.behind) ?? [])

/** 拼貼件的出場序（--i）照疊放順序排：墊底的小物 → 照片 → 插畫 → 壓在最上面的小物，
 *  跟實際把東西一件一件擺上桌的順序一樣，下面的先落、蓋在上面的後落 */
const photoOrder = computed(() => objectsBehind.value.length)
const artOrder = computed(() => photoOrder.value + props.slide.photos.length)
const frontOrder = computed(() => artOrder.value + 1)

/** 照片的 inline 變數：出場序、傾角，與拼貼台座標（--x/--y/--w 只有桌機的 @media 會用到） */
function photoStyle(photo: StorySlide['photos'][number], i: number) {
  const rot = photo.tilt ?? (photo.framed ? 0 : ROTATIONS[i] ?? 0)
  return {
    '--i': photoOrder.value + i,
    '--rot': `${rot}deg`,
    ...(photo.at ? { '--x': photo.at.x, '--y': photo.at.y, '--w': photo.at.w } : {}),
  }
}

/** 小物的 inline 變數（出場序、座標與傾角）；高度沒指定就交給素材原比例 */
function objectStyle(o: StoryObject, order: number) {
  return {
    '--i': order,
    '--rot': `${o.tilt ?? 0}deg`,
    '--x': o.at.x,
    '--y': o.at.y,
    '--w': o.at.w,
    ...(o.at.h ? { '--h': o.at.h } : {}),
  }
}

/** 插畫的座標：桌機拼貼台用 at，手機沿用 collage 內的預設位置 */
const artStyle = computed(() => {
  const at = props.slide.illustration?.at
  return { '--i': artOrder.value, ...(at ? { '--x': at.x, '--y': at.y, '--w': at.w } : {}) }
})

/** 這一頁文字塊的位置（沒給就用預設：置中偏右，第一頁的量法），與桌機整頁往下推的量 */
const copyVars = computed(() => {
  const at = props.slide.copyAt
  return {
    ...(at ? { '--copy-l': `${at.left}%`, '--copy-r': `${at.right}%`, '--copy-t': `${at.top}%` } : {}),
    ...(props.slide.shift ? { '--shift': `${props.slide.shift}vh` } : {}),
  }
})

// 標題裡的數字（201／111／65）換成襯線展示字體，中文維持 Noto Serif TC
const titleRuns = computed(() => splitDigits(props.slide.title))
const titleId = computed(() => `slide-${props.slide.key}-title`)
const srText = computed(() => {
  const m = marker.value
  if (!m)
    return ''
  return m.kind === 'span' ? `${m.from}到${m.to}，直線距離 ${m.km} 公里` : '婚禮當天，距離 0 公里'
})
</script>

<template>
  <section
    :id="`slide-${slide.key}`"
    :aria-labelledby="titleId"
    class="slide relative flex flex-col overflow-hidden bg-paper"
    :class="{ 'is-live': live, 'is-drawn': drawn, 'is-settled': settled }"
    :data-panel="index"
  >
    <!-- 手機的上內距 pt-20：標題要落在右上唱片與漢堡（下緣 y 64）之下。原本 pt-10 上面還有一行頁碼（28px＋間距 16px），
         頁碼拿掉後改成 pt-20，標題的位置與內容下緣跟原本只差 4px，一屏的算法不變（桌機 lg:pt-0 不受影響） -->
    <!-- 手機：貫穿整頁的直線（淡灰底，金線從上往下畫），與 px-6 同一個 x。
         掛在 section 這一層、不掛在內層容器：內層容器不含底部 3rem 的內距，線會在每頁底下斷一截、
         接不到下一頁的線（新人 09-17 截圖）；掛在 section 上 inset-y-0 就是整頁高，頁與頁的線才連成一條 -->
    <div class="absolute inset-y-0 left-6 w-0.5 bg-line lg:hidden" aria-hidden="true">
      <span class="rail-fill absolute inset-0 origin-top bg-gold" />
    </div>
    <div class="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pt-20 lg:justify-center lg:pb-[30vh] lg:pt-0">
      <!-- 手機是單欄：文字 →「站」（愛心與公里數）→ 照片。站排在照片之前，一屏就看得到，不必在頁內再捲一次。
           桌機維持左文右圖，站由下方的橫向時間軸負責，所以站這一塊 lg:hidden。
           左內距 pl-10 改掛在各欄上（不掛 grid）：站才能退回直線的 x，與線同一個起點。
           手機的欄距收成 gap-4：兩道間隙各省 8px，一屏多出 16px 留給照片（桌機 lg:gap-16 不受影響） -->
      <div
        class="slide-body grid gap-4 lg:grid-cols-12 lg:items-center lg:gap-16"
        :class="{ 'collage-stage': slide.layout === 'stage' }"
        :style="copyVars"
      >
        <!-- 頁碼（01 ——）09-15 拿掉（新人裁示）：標題就是這一頁的開頭 -->
        <div class="copy pl-10 lg:col-span-5 lg:pl-6">
          <h2 :id="titleId" class="reveal font-serif-tc text-body-l font-semibold tracking-wider text-ink sm:text-h3" style="--i: 0">
            <template v-for="(run, i) in titleRuns" :key="i">
              <span v-if="run.digit" class="digit font-display font-semibold text-gold-deep">{{ run.text }}</span>
              <template v-else>
                {{ run.text }}
              </template>
            </template>
          </h2>
          <!-- 手機收一階行高：leading-loose 在窄欄會多換幾行，一屏放不下站；桌機維持原本的鬆。
               內文一句一句浮出（新人 09-17）：每行各自掛 reveal、序號接在標題後面，每句隔 60ms，
               八行的頁最後一句在到頁後約 0.9 秒出來，讀的速度剛好跟得上 -->
          <div class="mt-4 space-y-1 font-serif-tc text-body leading-relaxed tracking-wider text-ink-500 lg:leading-loose">
            <!-- 空字串是段落間距（斷行照新人給的，段與段之間空一行） -->
            <template v-for="(line, i) in slide.lines" :key="i">
              <p v-if="line === ''" class="h-4" aria-hidden="true" />
              <p v-else class="reveal" :style="{ '--i': i + 1 }">
                {{ line }}
              </p>
            </template>
          </div>
        </div>

        <!-- 手機：距離段（這一頁的「站」）。愛心欄與直線同一個起點，兩顆愛心框出這一段、公里數在旁邊；歸零只剩一顆愛心。
             年份跟著站走，收在同一格裡，不另外多佔一列。
             整格也掛 reveal、序號排在最後一句之後：手機往下滑會先看到它、說明文字才浮出來，順序反了（新人 09-17）；
             跟著文字由下往上進場，就是讀完最後一句才看到這一段的距離 -->
        <div v-if="marker" class="reveal relative py-2 pl-10 lg:hidden" :style="{ '--i': slide.lines.length + 1 }" aria-hidden="true">
          <StoryHeart class="absolute -left-3 top-4 size-6 text-gold" />
          <div class="flex items-center justify-between gap-4 border-y border-line py-3">
            <div>
              <p v-if="marker.kind === 'span'" class="font-serif-tc text-body text-ink-700">
                {{ marker.from }} <span class="mx-1 text-gold-deep">→</span> {{ marker.to }}
              </p>
              <p v-else class="font-serif-tc text-body text-ink-700">
                我們的距離
              </p>
              <p v-if="slide.years" class="mt-1 font-display text-caption tracking-widest text-ink-500">
                {{ slide.years }}
              </p>
            </div>
            <p class="shrink-0 font-display text-h2 font-semibold leading-none text-ink">
              {{ shown }}<span class="ml-1 text-body font-normal text-ink-500">km</span>
            </p>
          </div>
        </div>
        <!-- 手機：片刻（愛心＋日期）；沒有日期的頁就只讓線穿過。進場順序同上 -->
        <div v-else-if="slide.years" class="reveal flex items-center lg:hidden" :style="{ '--i': slide.lines.length + 1 }" aria-hidden="true">
          <div class="relative h-6 w-10 shrink-0 text-gold">
            <StoryHeart class="heart m-heart m-heart-end absolute top-1/2 size-5" />
          </div>
          <p class="font-display text-body-l tracking-widest text-ink-300">
            {{ slide.years }}
          </p>
        </div>

        <!-- 拼貼：手機是一疊（第一張左上、第二張右下壓上去、插畫在下方）；
             桌機把同一批元素攤到整個 stage 上，照設計稿散開（見下方 @media 的座標） -->
        <div class="art-area pl-10 lg:col-span-7 lg:pl-0">
          <!-- 程式畫的視覺（歸零頁的一對婚戒）：不掛 .reveal——散沙本身就是「還沒走到」的樣子，
               再蓋一層淡入延遲會跟聚合打架，就像灰底線等金線畫上去一樣。
               底下墊一坨暖色光池，戒指是落在一小塊光裡，不是貼在平紙上；isolate 讓 -z-10 留在這個盒子裡 -->
          <div v-if="slide.visual === 'rings'" class="relative isolate mx-auto w-full lg:mx-0 lg:max-w-xl">
            <div class="pointer-events-none absolute inset-0 -z-10 bg-radial from-gold-light/20 to-transparent to-65%" aria-hidden="true" />
            <StoryRings :live="live" :drawn="drawn" />
          </div>
          <div v-else class="collage relative mx-auto w-full lg:mx-0 lg:max-w-sm" :class="{ 'no-art': !slide.illustration, 'art-only': !slide.photos.length && !!slide.illustration, 'solo': slide.photos.length === 1 && !slide.illustration }">
            <!-- 壓在照片下面的小物（布膠帶、滿天星）：排在照片前面，讓照片蓋住它們 -->
            <img
              v-for="(o, j) in objectsBehind"
              :key="o.src"
              :src="o.src"
              :alt="o.alt"
              loading="lazy"
              decoding="async"
              class="reveal prop absolute hidden lg:block"
              :style="objectStyle(o, j)"
            >
            <figure
              v-for="(photo, i) in slide.photos"
              :key="photo.src"
              class="reveal photo absolute m-0"
              :class="[i === 0 ? 'photo-a' : 'photo-b', i > 1 ? 'photo-extra' : '', photo.framed ? '' : 'frame']"
              :style="photoStyle(photo, i)"
            >
              <img
                :src="photo.src"
                :alt="photo.alt"
                :loading="photo.eager ? 'eager' : 'lazy'"
                decoding="async"
                class="block w-full"
                :class="photo.framed ? '' : 'aspect-[5/6] object-cover'"
              >
              <!-- 紙膠帶貼在上緣：放在 figure 裡才會跟著這張一起歪 -->
              <img
                v-if="photo.tape"
                src="/images/story/tape.webp"
                alt=""
                loading="lazy"
                class="tape absolute"
                aria-hidden="true"
              >
            </figure>
            <img
              v-if="slide.illustration"
              :src="slide.illustration.src"
              :alt="slide.illustration.alt"
              loading="lazy"
              decoding="async"
              class="reveal art absolute block w-full"
              :style="artStyle"
            >
            <!-- 佔位框只是提醒新人「這裡還缺插畫」，手機一屏寸土寸金，收掉不顯示 -->
            <div
              v-else
              class="reveal art art-empty absolute hidden items-center justify-center rounded-sm border border-dashed border-line text-caption text-ink-300 lg:flex"
              :style="{ '--i': artOrder }"
              aria-hidden="true"
            >
              插畫待提供
            </div>
            <!-- 壓在最上面的小物（車票、鋼筆、鑰匙圈）：排在插畫之後，才會蓋在插畫上。桌機才排得下，手機那一疊已經滿了 -->
            <img
              v-for="(o, j) in objectsFront"
              :key="`${o.src}-${j}`"
              :src="o.src"
              :alt="o.alt"
              loading="lazy"
              decoding="async"
              class="reveal prop absolute hidden lg:block"
              :style="objectStyle(o, frontOrder + j)"
            >
          </div>
        </div>

        <!-- 散落的貼紙：哪一張貼哪裡由內容層帶（各頁的設計稿各量各的） -->
        <StoryDoodles v-if="slide.doodles?.length" :items="slide.doodles" />
      </div>

      <p v-if="marker" class="sr-only">
        {{ srText }}
      </p>
    </div>

    <!-- 桌機：橫向時間軸，貼在畫面下方、跨越整個面板 -->
    <div class="bar absolute inset-x-0 hidden text-gold lg:block" aria-hidden="true">
      <!-- 淡灰底線：金線畫上去就是「變色」 -->
      <span class="absolute inset-0 bg-line" />
      <template v-if="marker?.kind === 'span'">
        <span class="fill fill-a absolute inset-y-0 left-0 origin-left bg-gold" />
        <span class="fill fill-b absolute inset-y-0 origin-left bg-gold" />
        <span class="fill fill-c absolute inset-y-0 right-0 origin-left bg-gold" />
        <StoryHeart class="heart heart-a at-a absolute top-1/2 size-9" />
        <StoryHeart class="heart heart-b at-b absolute top-1/2 size-9" />
        <!-- 地名釘在愛心上，屬於時間軸這個物件，所以跟線與愛心同一個金色；顏色已負責強調，字重回到 normal -->
        <span class="label at-a absolute font-serif-tc text-h3 font-normal tracking-wider text-gold-deep">{{ marker.from }}</span>
        <span class="label at-b absolute font-serif-tc text-h3 font-normal tracking-wider text-gold-deep">{{ marker.to }}</span>
        <p class="num absolute left-1/2 font-display text-display-l font-semibold leading-none text-ink">
          {{ shown }}<span class="ml-2 text-h3 font-normal text-ink-300">km</span>
        </p>
      </template>
      <template v-else-if="marker?.kind === 'zero'">
        <!-- 歸零：金線從兩邊往中間畫，兩顆愛心從 35%／65% 走向中央，疊在一起時大愛心浮出 -->
        <span class="fill fill-left absolute inset-y-0 left-0 origin-left bg-gold" />
        <span class="fill fill-right absolute inset-y-0 right-0 origin-right bg-gold" />
        <StoryHeart class="meet meet-a absolute left-1/2 top-1/2 size-9" />
        <StoryHeart class="meet meet-b absolute left-1/2 top-1/2 size-9" />
        <!-- 合起來的那顆是網點版：灰金雙色的小圓點，跟上面的粒子戒指同一套語言 -->
        <StoryHeartDots class="heart heart-end absolute left-1/2 top-1/2 size-12" />
        <p class="num absolute left-1/2 font-display text-display-l font-semibold leading-none text-ink">
          {{ shown }}<span class="ml-2 text-h3 font-normal text-ink-300">km</span>
        </p>
      </template>
      <template v-else>
        <!-- 片刻：線直接穿過，中間一顆小一點的愛心 -->
        <span class="fill fill-full absolute inset-0 origin-left bg-gold" />
        <StoryHeart class="heart heart-mid absolute left-1/2 top-1/2 size-6" />
      </template>
      <!-- 年份是附註：淺灰配 24px，不再用畫面第二大的字級搶焦點 -->
      <p v-if="slide.years" class="years absolute left-1/2 whitespace-nowrap font-display text-h3 tracking-widest text-ink-300">
        {{ slide.years }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/* 文字在切頁途中開始進場，標題先、內文一句接一句，每項錯開 60ms，內容更早可讀。 */
.reveal {
  transform: rotate(var(--rot, 0deg));
  transition:
    opacity 0.45s var(--ease-standard),
    transform 0.45s var(--ease-standard),
    scale 0.45s var(--ease-standard);
  transition-delay: calc(var(--i, 0) * 60ms);
}
.is-live:not(.is-drawn) .reveal {
  opacity: 0;
  transform: translateY(14px) rotate(var(--rot, 0deg));
}
/* 拼貼件等軌道停穩才出場，每件隔 90ms，才看得出一件一件擺上桌 */
.collage .reveal {
  transition-delay: calc(var(--i, 0) * 90ms);
}
.is-live:not(.is-settled) .collage .reveal {
  opacity: 0;
  transform: translateY(14px) rotate(var(--rot, 0deg));
}
.is-live:not(.is-settled) .photo {
  scale: 1.04;
}

/* 手機是直式堆疊（有沒有 JS 都是，issue #162）：每頁照內容高、不撐到一屏（理由見 StoryDeck 的樣式段），底部留 3rem，
   加上下一頁的上距 pt-20 就是章與章的間距；下一頁的頂端不會貼著這一頁的照片。
   手機的拼貼件跟文字同一個時間點起跑（StoryDeck 在手機不等停穩），多墊 240ms 讓標題與前幾句先出來、照片再落下 */
@media (width < 64rem) {
  .slide {
    padding-bottom: 3rem;
  }
  .collage .reveal {
    transition-delay: calc(240ms + var(--i, 0) * 90ms);
  }
}

/* 標題裡的數字：Cormorant 的 x 高度小，放大一點才與中文同視覺高度 */
.digit {
  font-size: 1.15em;
  line-height: 1;
}

/* ── 拼貼（位置為容器寬高的百分比，照設計稿量）── */
.collage {
  aspect-ratio: 10 / 13;
}
/* 手機：拼貼放大到「照片看得清楚」（issue #162，新人 09-16：拍立得太小）——寬度吃螢幕寬的八成（390 → 312px，原本 211px），
   不再綁螢幕高度。原本綁高度是為了塞進「一屏減 8rem 頁次軸」；改成直向翻頁後頁次軸沒了，
   而且真機 Safari 的 svh 是工具列佔掉後的小視窗（iPhone 13 只有 664px），綁高度只會把照片算得更小（177px）。
   文字＋站把拼貼頂到 y = 446px，沒有插畫的頁第二張照片下緣在 0.963W（§28 量的 0.22H + 0.752W，H = 0.96W），
   第 1～3 頁在 390 寬約 794px 高：工具列收合後（大視窗約 750～844）差不多一屏，工具列在時多捲 130px 看照片下半。
   直向模式的 snap 是 proximity、面板比視窗高時任何「面板蓋滿視窗」的位置都算對齊點，不會被彈回頁頂。
   沒有插畫的頁維持 10/9.6：佔位框在手機已收掉，那 22% 的高度是純空白；
   9.6 的下限是 0.9333（0.22H + 0.728W ≤ H 解出來的），留一點餘裕才不會讓照片凸出自己的盒子 */
@media (width < 64rem) {
  .collage {
    max-width: min(22rem, 80vw);
  }
  .collage.no-art {
    aspect-ratio: 10 / 9.6;
  }
  /* 只有插畫的頁（夜景、抱貓）：原本往左出血到 330px 寬，跟放大後的拍立得站在一起反而太大（新人 09-16：五口之家太大）。
     收成 62vw、最多 17rem（390 → 242px），置中在照片那一欄，盒子高度跟著插畫走 */
  .collage.art-only {
    max-width: min(17rem, 62vw);
    aspect-ratio: auto;
  }
  .collage.art-only .art {
    position: relative;
    inset: auto;
    width: 100%;
  }
  /* 只有一張拍立得的頁（MARRY ME 燈牌）：那一疊的兩格座標只用到第一格（48% 寬＝101px，底下空四成），
     改成一張吃滿盒子、跟其他頁同一個寬度。盒子高度跟著照片走（有框無框都成立）：
     文字＋日期把盒子頂到 y≈355，燈牌高 0.88W，390 寬整頁約 680px，工具列在時剛好一屏 */
  .collage.solo {
    max-width: min(22rem, 80vw);
    aspect-ratio: auto;
  }
  .collage.solo .photo-a {
    position: relative;
    inset: auto;
    width: 100%;
  }
}
.photo-a {
  left: 6%;
  top: 0;
  width: 48%;
}
.photo-b {
  left: 44%;
  top: 22%;
  width: 56%;
}
.art {
  left: 0;
  bottom: 0;
  width: 96%;
}
.art-empty {
  height: 22%;
}

/* ── 桌機：一整頁就是一張拼貼台（stage），文字與照片都用 stage 寬高的百分比定位 ──
   座標是照設計稿（1440×1024）量的：stage 對應設計稿的 x 240–1200、y 120–660 那塊，
   所以 stage 的比例固定 16/9，元素的百分比直接由設計稿座標換算（例：火車 x 678 → (678−240)/960 = 45.6%）。
   寬度三者取小：960px 是設計稿原寬，100% 是外層欄寬，116vh 管矮螢幕——
   內容區高度約 70vh（下方 30vh 留給時間軸），16/9 的 stage 要塞進去得 W ≤ 0.7×h×16/9 = 124vh，取 116vh 留餘裕。
   class 名不能只叫 stage：StoryDeck 外層已經有一個 class="stage"，scoped 的後代選擇器會被它匹配，每一頁都會吃到這套座標。
   沒指定 layout: 'stage' 的頁不套，維持原本的左文右圖（每一頁的設計各自不同，逐頁定案後才各自指定）。 */
@media (width >= 64rem) {
  /* 各頁內容高度不同，收在上半時中段會空一截：整頁內容照內容層的 shift 再往下推（沒給就是 0） */
  .slide-body:not(.collage-stage) {
    translate: 0 var(--shift, 0vh);
  }
  /* 不是拼貼台的頁（歸零那頁）文字也置中：六頁拼貼台都置中，只有它靠左會像漏改 */
  .slide-body:not(.collage-stage) .copy {
    text-align: center;
  }
  .collage-stage {
    position: relative;
    display: block;
    width: min(60rem, 100%, 116vh);
    margin-inline: auto;
    aspect-ratio: 16 / 9;
    /* 外層的 pb-[30vh] 把 stage 頂到偏上；往下推一些，上下留白才差不多。
       7% 是量出來的：10% 時兩張拍立得的白框中心比設計稿低約 16px（＝ 540 的 3%） */
    translate: 0 calc(7% + var(--shift, 0vh));
  }
  /* 文字一律置中對齊；塊本身貼在哪由內容層的 copyAt 帶進來（各頁設計稿各量各的） */
  .collage-stage .copy {
    position: absolute;
    left: var(--copy-l, 31.5%);
    right: var(--copy-r, 25.8%);
    top: var(--copy-t, 21%);
    text-align: center;
  }
  /* 拼貼盒在桌機不再是一個盒子：自己不定位、不限寬，裡面每一張各自貼到 stage 上 */
  .collage-stage .art-area,
  .collage-stage .collage {
    position: static;
    max-width: none;
    aspect-ratio: auto;
  }
  /* 每張照片自己的座標（內容層的 at，量的是白框中心點）。
     translate 把中心退回一半——旋轉一樣繞元素中心，所以量到的中心就是貼上去的中心。
     元素寬要比白框寬一點，因為素材檔案還含投影與自帶傾角撐出的空邊 */
  .collage-stage .prop[style*='--h'] {
    --prop-h: calc(var(--h) * 1%);
  }
  .collage-stage .photo {
    left: calc(var(--x, 50) * 1%);
    top: calc(var(--y, 50) * 1%);
    width: calc(var(--w, 20) * 1%);
    translate: -50% -50%;
  }
  /* 小物跟照片同一套座標；h 只有設計稿刻意拉過比例時才會帶進來 */
  .collage-stage .prop {
    left: calc(var(--x, 50) * 1%);
    top: calc(var(--y, 50) * 1%);
    width: calc(var(--w, 20) * 1%);
    height: var(--prop-h, auto);
    translate: -50% -50%;
  }
  .collage-stage .art {
    left: calc(var(--x, 50) * 1%);
    top: calc(var(--y, 50) * 1%);
    bottom: auto;
    width: calc(var(--w, 35) * 1%);
    translate: -50% -50%;
  }
  /* 「插畫待提供」的虛線框在拼貼台上收掉：這個版面已經不是「右欄留一個洞」的結構，
     空框擺進來只會變成一塊補丁。缺插畫的頁改由內容層的註解記著 */
  .collage-stage .art-empty {
    display: none;
  }
}
/* 手機那一疊只排得下兩張：第三張以後是桌機拼貼台才有的 */
@media (width < 64rem) {
  .photo-extra {
    display: none;
  }
}

/* 紙膠帶：一半黏在白框上、一半露在外面，像真的貼上去的。
   寬度是拍立得的 38%（跟著照片縮放），高度交給 aspect-ratio 由素材比例決定。
   左右兩張各偏一側，兩張才不會像同一個模子蓋出來的 */
.tape {
  width: 38%;
  aspect-ratio: 72 / 25;
  top: -5%;
  left: 24%;
}
.photo-b .tape {
  left: 46%;
}

/* 佔位照片沒有白框：補拍立得白框與投影（量沿用入口頁拍立得） */
.frame {
  background: #fff;
  padding: 6% 6% 14%;
  border-radius: 2px;
  box-shadow:
    0 1px 1px rgb(17 17 17 / 6%),
    0 12px 26px rgb(17 17 17 / 12%);
}

/* ── 時間軸共用：線與愛心只動 transform；愛心用 translate 置中（與 transform 是兩個屬性，不互蓋）── */
.heart {
  translate: -50% -50%;
}
.is-live:not(.is-drawn) .fill,
.is-live:not(.is-drawn) .rail-fill {
  transform: scaleX(0);
}
.is-live:not(.is-drawn) .rail-fill {
  transform: scaleY(0);
}
.is-live:not(.is-drawn) .heart {
  transform: scale(0);
}
.is-drawn .fill,
.is-drawn .rail-fill,
.is-drawn .heart {
  transition: transform var(--dur, 0.5s) var(--ease-standard) var(--at, 0s);
}

/* 手機：直線 1.6 秒畫到底，愛心跟在後面；愛心中心對在 2px 線的中心（left 1px + translate） */
.rail-fill {
  --dur: 1.6s;
}
/* 站的高度 6rem → 5.5rem，替照片再讓出 8px。5.5rem 是下限：
   旁邊那疊「地名 31.2 ＋ 公里數 45 ＋ 地名 31.2 ≈ 107px」扣掉 -my-3 的 24px 是 83.4px，
   站矮過 83.4px 就換這疊字撐開整列，兩顆愛心會對不上地名 */
.seg {
  height: 5.5rem;
}
.m-heart {
  left: 1px;
  --dur: 0.35s;
}
.m-heart-a,
.m-heart-end {
  --at: 0.9s;
}
.m-heart-b {
  --at: 1.4s;
}

/* 桌機：橫線離底 --rail-y（首屏的愛心同一個高度），兩顆愛心固定在 35%／65%。
   順序：左段 0→0.5s → 愛心 A 0.5s → 兩地之間（變色）0.7→1.5s → 愛心 B 1.5s → 右段 1.7→2.2s。 */
.bar {
  --xa: 35%;
  --xb: 65%;
  bottom: var(--rail-y, 22%);
  height: 3px;
}
.at-a {
  left: var(--xa);
}
.at-b {
  left: var(--xb);
}
.fill-a {
  --at: 0s;
  width: var(--xa);
}
.heart-a {
  --dur: 0.35s;
  --at: 0.5s;
}
.fill-b {
  --dur: 0.8s;
  --at: 0.7s;
  left: var(--xa);
  width: calc(var(--xb) - var(--xa));
}
.heart-b {
  --dur: 0.35s;
  --at: 1.5s;
}
.fill-c {
  --at: 1.7s;
  left: var(--xb);
}

/* 片刻：線 1.4 秒穿過，過中點時空心愛心浮出 */
.fill-full {
  --dur: 1.4s;
}
.heart-mid {
  --dur: 0.35s;
  --at: 0.8s;
}

/* 歸零：兩邊各畫 50%（0.2→1.4s）；兩顆愛心在線到時浮出（1.0s）、往中央走（1.4→2.3s）、疊上時淡出；大愛心 2.2s 浮出。
   .meet 的置中與位移都寫在 translate、浮出寫在 scale，不用 transform——三個屬性各自 transition。
   基礎值就是終態（已合成一顆、看不見），只有 JS 接管且還沒走到時才擺回起點。 */
.fill-left,
.fill-right {
  --dur: 1.2s;
  --at: 0.2s;
  width: 50%;
}
.meet {
  translate: -50% -50%;
  scale: 1;
  opacity: 0;
}
.meet-a {
  --dx: -15vw;
}
.meet-b {
  --dx: 15vw;
}
.is-live:not(.is-drawn) .meet {
  translate: calc(-50% + var(--dx)) -50%;
  scale: 0;
  opacity: 1;
}
.is-drawn .meet {
  transition:
    scale 0.35s var(--ease-standard) 1s,
    translate 0.9s var(--ease-standard) 1.4s,
    opacity 0.3s var(--ease-standard) 2.3s;
}
.heart-end {
  --dur: 0.45s;
  --at: 2.2s;
}

/* 距離歸零之後，那顆合起來的大愛心一直跳。故事從首屏一顆會心跳的愛心出發，也停在一顆還在跳的愛心上，首尾收在同一個動作。
   節拍沿用首屏 .origin-heart 的 2.4 秒一拍；這顆比首屏大（48px 對 36px），幅度收到 1.12，看起來的位移才一樣。
   **跳動寫在 scale、浮出寫在 transform**：兩個是各自獨立的屬性，動畫不會蓋掉出場那段 transition
   （同一個屬性上，animation 一律勝過 transition，寫在一起出場就不見了）。
   延遲到出場走完才開始（桌機 2.2s 起跑、0.45s 走完；手機 0.9s 起跑、0.35s 走完）。
   選擇器分兩種情況：JS 接管時等走到這一頁（is-drawn）才跳，沒有 JS 時本來就是終態，直接跳。
   reduced-motion 由 main.css 的全域 guard 收成靜止，不必另外處理。 */
.is-drawn .heart-end,
.slide:not(.is-live) .heart-end {
  animation: end-beat 2.4s var(--ease-standard) 2.65s infinite;
}
.is-drawn .m-heart-zero,
.slide:not(.is-live) .m-heart-zero {
  animation: end-beat 2.4s var(--ease-standard) 1.25s infinite;
}
@keyframes end-beat {
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

.label {
  bottom: 100%;
  margin-bottom: 2.75rem;
  translate: -50% 0;
}
.num {
  bottom: 100%;
  margin-bottom: 1.5rem;
  translate: -50% 0;
  white-space: nowrap;
}
.years {
  top: 100%;
  margin-top: 1.5rem;
  translate: -50% 0;
}
</style>
