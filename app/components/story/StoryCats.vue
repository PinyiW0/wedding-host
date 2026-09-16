<!-- app/components/story/StoryCats.vue — 三隻貓同框的一張場景（新人 2026-09-15 給的：三隻追羽毛），取代原本三欄各一張去背圖的卡片。
     每隻貓身上罩一顆透明的 <button>（命中框是量出來的百分比，見 docs/public-landing-assets.md §45）：
     游標停上去／鍵盤停上去／點下去，牠的名字（手寫字）浮在頭上、一根羽毛從上面落到牠頭頂；
     點下去另外在圖下方打開牠的紙條（一次一張，再點一次或按「收起」關掉）。
     羽毛只在互動那一下動，不做滿版飄羽毛——creative-direction §4 一頁一個主動效，這一頁已經給首屏了。
     羽毛是新人畫的插圖（與貓同一家族的手繪筆觸）：落下的那根用 feather.webp，桌機游標用垂直翻轉的 32px 小圖 feather-cursor.png。
     尺寸（新人 09-15：貓太大隻）：場景圖桌機約 746px 寬（不超過原本 max-w-3xl 的 768）；手機不再放大，滿版出血（-mx-6）到螢幕邊就好。
     版面：手機由上而下是標題 → 場景 → 紙條（紙條在圖下方，手機一屏看得到）。
     桌機（新人 09-15：點貓後紙條落到畫面外）改左右並排：三欄兩列的 grid，場景跨左邊兩欄兩列、
     標題貼右欄上半的底、紙條貼右欄下半的頂——兩者在圖的中線上下交會，貓與紙條同一屏看得完。
     DOM 順序不變（標題、場景、紙條），手機照原本的流排，桌機只靠 grid 放置，讀屏順序兩邊一致。
     兩列用等高的 grid-rows-2，紙條那格再保留 min-h-72（最高的 Happy 紙條連上距 276px）：
     列高永遠由保留高度決定、不看紙條開沒開，左邊的圖（在兩列裡垂直置中）與右上的標題都不會跳。
     提示句底下另有三顆名字膠囊（09-15 第二輪）：熱區是透明的，膠囊是看得見的第二條入口，與熱區共用同一個 onPick。 -->
<script setup lang="ts">
import type { StoryCat, StoryCatScene } from '~/types/story'

const props = defineProps<{
  cats: StoryCat[]
  scene: StoryCatScene
}>()

/** 游標或鍵盤停在哪一隻（名字＋羽毛）；點開紙條的那一隻另外記——兩條通道各自獨立，移開游標後名字才不會留在畫面上 */
const hoverKey = ref<string | null>(null)
const openKey = ref<string | null>(null)

const openCat = computed(() => props.cats.find(cat => cat.key === openKey.value) ?? null)

function isLit(key: string) {
  return hoverKey.value === key || openKey.value === key
}

/** 名字與羽毛要落在頭頂：頭頂座標是整張圖的百分比，換算成命中框裡的百分比才能跟 button 放在同一個框裡 */
function spotStyle(cat: StoryCat) {
  const { box, head } = cat.spot
  return {
    '--x': `${box.x}%`,
    '--y': `${box.y}%`,
    '--w': `${box.w}%`,
    '--h': `${box.h}%`,
    '--hx': `${((head.x - box.x) / box.w * 100).toFixed(2)}%`,
    '--hy': `${((head.y - box.y) / box.h * 100).toFixed(2)}%`,
  }
}

function onEnter(key: string, event: PointerEvent) {
  if (event.pointerType !== 'touch')
    hoverKey.value = key
}
function onLeave(key: string) {
  if (hoverKey.value === key)
    hoverKey.value = null
}
/** 鍵盤停上來也給同一個回饋；滑鼠按下帶進來的 focus 交給 hover 那條通道，不要點一下亮兩次 */
function onFocus(key: string, event: FocusEvent) {
  if ((event.target as HTMLElement).matches(':focus-visible'))
    hoverKey.value = key
}
function onPick(key: string) {
  openKey.value = openKey.value === key ? null : key
}
</script>

<template>
  <section aria-labelledby="story-cats-title" class="bg-cream px-6 py-16 lg:py-24">
    <!-- 桌機四列：上下兩列是等分的空白、中間兩列是標題與紙條，場景圖跨滿四列——
         標題＋紙條這一組就跟左邊的貓垂直置中（新人 09-15）。紙條那列保留最高那張的高度，開關、換貓時整組不跳 -->
    <div class="cats-grid mx-auto max-w-3xl lg:grid lg:max-w-6xl lg:grid-cols-3 lg:gap-x-16">
      <!-- 眉標拿掉（THREE CATS · 三隻小胖貓）：六個區塊都掛眉標是 creative-direction 點名的模板味，這一區一句話當標題就夠。
           桌機放右欄、靠左；右欄只有 341px 寬，標題在逗號後自己斷行，不讓瀏覽器斷在詞中間 -->
      <div class="text-center lg:col-start-3 lg:row-start-2 lg:text-left">
        <h2 id="story-cats-title" class="font-serif-tc text-body-l font-semibold text-ink sm:text-h3">
          我們的小小日常，<br class="hidden lg:inline">也有牠們的位置。
        </h2>
        <p class="mt-3 font-serif-tc text-body text-ink-500">
          點點牠們，讀牠們留給你的小紙條。
        </p>
        <!-- 三顆名字膠囊（2026-09-15）：圖上的熱區是透明的，「可以點」只靠一句提示；名字排出來就是看得見的入口，
             也補掉桌機右欄紙條沒開時那一段空白。點膠囊走的是熱區同一個 onPick：開紙條、羽毛落到牠頭上、名字浮出，再點一次收起。
             最少 40px 高（觸控目標）；選取態邊框與字轉金，只動顏色 -->
        <div class="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
          <button
            v-for="cat in cats"
            :key="cat.key"
            type="button"
            class="min-h-10 rounded-full border px-4 font-serif-tc text-body transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
            :class="openKey === cat.key ? 'border-gold text-gold-deep' : 'border-line text-ink-500 hover:border-gold-light hover:text-gold-deep'"
            :aria-pressed="openKey === cat.key"
            aria-controls="story-cat-note"
            @click="onPick(cat.key)"
          >
            {{ cat.name }}
          </button>
        </div>
      </div>

      <div class="cat-scene -mx-6 mt-8 sm:mx-0 lg:col-span-2 lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:mt-0 lg:self-center">
        <div class="cat-stage relative">
          <img
            :src="scene.src"
            :alt="scene.alt"
            :width="scene.width"
            :height="scene.height"
            loading="lazy"
            draggable="false"
            class="block w-full"
          >
          <div
            v-for="cat in cats"
            :key="cat.key"
            class="cat-spot absolute"
            :class="{ 'is-lit': isLit(cat.key) }"
            :style="spotStyle(cat)"
          >
            <button
              type="button"
              class="cat-hit absolute inset-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
              :aria-label="`${cat.name}，${openKey === cat.key ? '收起牠的小紙條' : '讀牠的小紙條'}`"
              :aria-expanded="openKey === cat.key"
              aria-controls="story-cat-note"
              @pointerenter="onEnter(cat.key, $event)"
              @pointerleave="onLeave(cat.key)"
              @focus="onFocus(cat.key, $event)"
              @blur="onLeave(cat.key)"
              @click="onPick(cat.key)"
            />
            <span class="cat-tag absolute whitespace-nowrap font-hand text-h3 leading-none text-gold-deep" aria-hidden="true">{{ cat.name }}</span>
            <img src="/images/story/feather.webp" alt="" width="320" height="219" loading="lazy" draggable="false" class="cat-feather absolute block select-none" aria-hidden="true">
          </div>
        </div>
      </div>

      <!-- 紙條：一次一張。手機放在圖下方、桌機放右欄標題底下（名字與羽毛都在圖上，紙條疊上去會蓋到貓）。
           aria-live 包在外層常駐，v-if 換進來的內容才會被讀屏播出；:key 換貓時重跑一次進場。
           lg:min-h-72（288px）＝最高那張（Happy，含上距 276px）再留一點，紙條沒開時這一列也佔著位置 -->
      <div aria-live="polite" class="mx-auto max-w-md lg:col-start-3 lg:row-start-3 lg:mx-0 lg:min-h-72 lg:max-w-none">
        <div v-if="openCat" id="story-cat-note" :key="openCat.key" class="note mt-8 px-6 py-6 text-center lg:mt-4">
          <!-- ♡ 不用手寫體：手寫體沒有這個字，硬指定會讓瀏覽器為了查字去下載 9.5MB 的整包，最後還是用 Noto Sans TC 畫（main.css 子集的說明） -->
          <p class="font-hand text-h3 leading-none text-gold-deep">
            {{ openCat.name }} <span class="font-sans">♡</span>
          </p>
          <p class="mt-4 font-serif-tc text-body leading-relaxed whitespace-pre-line text-ink-700">
            {{ openCat.role }}
          </p>
          <p class="mt-4 font-hand text-body-l leading-relaxed whitespace-pre-line text-ink">
            {{ openCat.line }}
          </p>
          <button
            type="button"
            class="mt-5 border-b border-gold-light pb-1 text-caption text-ink-500 transition-colors duration-250 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
            @click="openKey = null"
          >
            收起小紙條
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 手機：場景滿版出血（-mx-6 頂掉內距，貼齊螢幕邊），不再放大。
   --stage-w 留著當調整鈕：要再放大時超出的兩端用 overflow-x: clip 裁掉——
   不用 overflow: hidden，它會連帶把浮在頭上的名字與羽毛一起裁掉（肥肥的頭頂離圖的上緣只有 17%） */
.cat-scene {
  --stage-w: 100%;

  overflow-x: clip;
}
.cat-stage {
  width: var(--stage-w);
  /* width 超過 100% 時 margin auto 會算成 0，改用負 margin 置中 */
  margin-left: calc((100% - var(--stage-w)) / 2);
}
@media (min-width: 640px) {
  .cat-scene {
    --stage-w: 100%;
  }
}

/* 桌機：上下兩列 1fr 平分場景圖多出來的高度，中間兩列（標題、紙條）照內容排，整組就落在圖的垂直中心 */
@media (min-width: 64rem) {
  .cats-grid {
    grid-template-rows: 1fr auto auto 1fr;
  }
}

/* 一隻貓的命中框：位置與大小是量出來的百分比（見 docs §45）。整隻貓都可以點，不必像花田那樣只點耳朵——這裡不是彩蛋 */
.cat-spot {
  top: var(--y);
  left: var(--x);
  width: var(--w);
  height: var(--h);
}

/* 桌機游標停在貓身上換成新人畫的那根羽毛：<button> 的 UA 游標是 default，要自己寫。
   小圖已垂直翻轉，羽軸尖在左緣 (0, 7)，熱點就放在那裡 */
@media (hover: hover) and (pointer: fine) {
  .cat-hit {
    cursor: url("/images/story/feather-cursor.png") 0 7, pointer;
  }
}

/* 名字：浮在頭頂上方、羽毛之上。位移合進 translate（本來就要 -50% 置中），亮起時再往上飄一點 */
.cat-tag {
  top: var(--hy);
  left: var(--hx);
  translate: -50% calc(-100% - 2.2rem);
  opacity: 0;
  transition:
    opacity 250ms var(--ease-standard),
    translate 250ms var(--ease-standard);
}
.cat-spot.is-lit .cat-tag {
  translate: -50% calc(-100% - 2.8rem);
  opacity: 1;
  transition:
    opacity 400ms var(--ease-standard),
    translate 400ms var(--ease-emphasized);
}

/* 羽毛：從頭頂上方落下來、邊落邊放平，停在頭頂（下緣壓在頭頂線上一點點）。
   插圖本身斜 34°（羽毛尖在右上），落下時再往上翹、停下時順時針放平成約 14°，像剛飄下來躺在頭上。
   寬度約為場景圖裡原生羽毛的一半（桌機場景 768 寬時原生羽毛約 130px）：再小會像另一種東西，再大會蓋到貓臉。
   落下寫 translate、放平寫 rotate，兩個屬性各自獨立；收回時原路淡出、快一檔 */
.cat-feather {
  top: var(--hy);
  left: var(--hx);
  width: 2.5rem;
  max-width: none;
  height: auto;
  translate: -50% -260%;
  rotate: -18deg;
  opacity: 0;
  transition:
    opacity 250ms var(--ease-standard),
    translate 250ms var(--ease-standard),
    rotate 250ms var(--ease-standard);
}
.cat-spot.is-lit .cat-feather {
  translate: -50% -80%;
  rotate: 20deg;
  opacity: 1;
  transition:
    opacity 400ms var(--ease-standard),
    translate 400ms var(--ease-emphasized),
    rotate 400ms var(--ease-emphasized);
}
@media (min-width: 1024px) {
  .cat-feather {
    width: 4rem;
  }
}

/* 紙條：紙紋與手寫字沿用同一頁的 note-paper 語彙（首屏便簽、花田紙條都是這一套） */
.note {
  background: url("/images/invite/note-paper.webp") center / cover;
  box-shadow: 0 5px 18px rgb(60 48 32 / 7%);
  rotate: -1deg;
  animation: note-in 400ms var(--ease-emphasized) both;
}
@keyframes note-in {
  from {
    translate: 0 8px;
    opacity: 0;
  }
  to {
    translate: 0 0;
    opacity: 1;
  }
}
</style>
