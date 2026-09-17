<!-- app/components/story/StoryFoilMark.vue — 首屏主標的金箔字樣：光只從字裡透出來，像金箔轉動時的明暗流動。
     做法是鏤空版：字形當遮罩，後面放幾顆軟邊的光斑慢慢漂，字外一律不透光。
     參考 studio-cc 首頁標題（那邊是 WebGL 球＋紅藍立體疊色），這裡不背 three.js——
     色調要收進金色，現成材質整組得重寫、優勢就沒了，卻要為首屏多扛一個 3D 函式庫；
     改用 SVG 遮罩＋CSS 光斑，零依賴、SSR 直接有畫面、無 JS 也完整。
     光斑的軟邊是放射漸層、不是 feGaussianBlur（09-17 改）：模糊濾鏡在瀏覽器裡是 CPU 逐幀重算的，三顆光斑一直在漂，
     iPhone 首屏因此每一幀多幾十毫秒（新人：進場會卡）；漸層由 GPU 直接畫，邊一樣軟。
     捲出畫面時光斑停下（IntersectionObserver）：看不到的東西不必動。
     配色刻意收斂：底就是原本的 gold，亮斑 gold-light、暗斑 gold-deep、一顆紙白高光、
     一顆鼠尾草冷斑（對應原站紅青色散的克制版）。平均下來仍是金色，不是漸層字。
     尺寸：viewBox 固定，寬高用 em 表達，字級交給外面的 text-h2／sm:text-h1，行動裝置自動跟著縮。
     reduced-motion：全域 guard 把動畫停在第一幀，所以每條 keyframes 的 0%／100% 就設成光斑散開的樣子。
     紙白版（variant="paper"，書的泡泡那跨疊在照片上）：底換成紙白，光斑收成金與白，是白字上流過的暖光。 -->
<script setup lang="ts">
withDefaults(defineProps<{
  /** 字樣內容（拉丁文字），同時是無障礙名稱 */
  text: string
  /** 配色：gold＝金箔（首屏）；paper＝紙白字配金色暖光（照片上） */
  variant?: 'gold' | 'paper'
}>(), { variant: 'gold' })

const id = `foil-${useId()}`
/** 三顆光斑的代號：各自一個放射漸層（顏色由 CSS 的 .stop-* 給，紙白版另換一組） */
const ORBS = ['a', 'b', 'c'] as const

/** 字樣捲出畫面就讓光斑停下（is-off），捲回來再漂 */
const markEl = ref<SVGSVGElement | null>(null)
const off = ref(false)
let observer: IntersectionObserver | null = null
onMounted(() => {
  if (!markEl.value)
    return
  observer = new IntersectionObserver((entries) => {
    off.value = !entries.some(entry => entry.isIntersecting)
  })
  observer.observe(markEl.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <svg ref="markEl" viewBox="0 0 1000 160" role="img" :aria-label="text" class="mark" :class="{ 'is-paper': variant === 'paper', 'is-off': off }">
    <defs>
      <!-- 鏤空版：白字＝透光 -->
      <mask :id="`${id}-cut`" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="160">
        <text x="500" y="118" text-anchor="middle" class="glyph cut">{{ text }}</text>
      </mask>
      <!-- 光斑：中心實、往外淡到透明的放射漸層，半徑算進軟邊（原本實心圓的半徑加上模糊糊開的那一圈） -->
      <radialGradient v-for="k in ORBS" :id="`${id}-glow-${k}`" :key="k">
        <stop offset="0" :class="`stop-${k}`" />
        <stop offset="0.55" :class="`stop-${k}`" stop-opacity="0.75" />
        <stop offset="1" :class="`stop-${k}`" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- 字的本色直接畫字，不經遮罩。原本是「整片底色矩形經遮罩」：Chrome 在 SVG 的寬度不是整數像素時，
         遮罩圖層的邊（就是 SVG 的左緣或右緣）會漏出一欄沒被遮到的底色——首屏的金、書第 9 跨的紙白，
         新人看到標題旁一直有一條細線（實測那一欄比背景亮 48～139 階；把遮罩範圍放大也一樣，漏的是 SVG 邊那一欄）。
         底色不走遮罩，遮罩下面只剩光斑，而光斑的漂移範圍收在離 SVG 兩側 60 以上，邊上沒有內容，遮罩對不準也漏不出東西 -->
    <text x="500" y="118" text-anchor="middle" class="glyph base" aria-hidden="true">{{ text }}</text>
    <g :mask="`url(#${id}-cut)`">
      <circle class="orb orb-a" r="210" :fill="`url(#${id}-glow-a)`" />
      <circle class="orb orb-b" r="110" :fill="`url(#${id}-glow-b)`" />
      <circle class="orb orb-c" r="250" :fill="`url(#${id}-glow-c)`" />
    </g>
  </svg>
</template>

<style scoped>
.mark {
  display: block;
  /* 1em 對齊 viewBox 的 font-size 120：字級就等於外層 text-h2／sm:text-h1 給的值 */
  width: calc(1000em / 120);
  height: calc(160em / 120);
  /* 不開 overflow: visible——光斑的糊邊會畫到框外，而這裡沒有東西需要畫到框外：
     字的實際範圍只佔 viewBox 的 177～822 × 6～153 */
  overflow: hidden;
}

/* 遮罩裡的字與看得見的字用同一套字型設定，兩者才會完全重疊 */
.glyph {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 120px;
  letter-spacing: 0.025em; /* 對齊原本的 tracking-wide */
}

.cut {
  fill: #fff; /* 遮罩的白＝透光，不是設計色 */
}

/* 底壓到 gold-deep（原本是 gold）：光斑一疊上去整行會變亮，
   基準不壓深的話最亮處對紙底只剩 1.4:1，字會忽隱忽現。壓深後最亮處回到原本 gold 的水準 */
.base {
  fill: var(--color-gold-deep);
}

/* 漂移：只動 transform；週期彼此互質，錯開後不會看出循環。
   easing 用內建 ease-in-out——這是長循環的環境光，不是 UI 轉場，
   ease-standard 的「快進慢出」會在往返端點頓一下。
   animation 一定要寫死名字：scoped style 會把 @keyframes 加上 scope hash 一起改寫，
   若把名字藏進 var() 就改寫不到，動畫會靜靜地不跑 */
/* 三顆都在金的同色系裡：金箔轉動是同一個顏色的明暗，不是換色。
   試過加一顆鼠尾草冷斑（想對應原站的紅青色散），金底上疊冷色會發灰、像褪色，拿掉。
   顏色寫在漸層的 stop 上（.stop-*），圓本身只管透明度與漂移 */
.stop-a {
  stop-color: var(--color-gold-light);
}
.orb-a {
  opacity: 0.75;
  animation: drift-a 15s ease-in-out infinite;
}
/* 鏡面高光：要小也要淡。放大或加亮都會把字洗白到看不見 */
.stop-b {
  stop-color: var(--color-paper);
}
.orb-b {
  opacity: 0.3;
  animation: drift-b 11s ease-in-out infinite;
}
.stop-c {
  stop-color: var(--color-secondary-800);
}
.orb-c {
  opacity: 0.5;
  animation: drift-c 19s ease-in-out infinite;
}
/* 捲出畫面：光斑停在原地 */
.is-off .orb {
  animation-play-state: paused;
}

/* 紙白版：底是紙白，亮斑金、高光白、暗斑金——白字上流過的暖光，不是換成另一種金 */
.is-paper .base {
  fill: var(--color-paper);
}
.is-paper .stop-a {
  stop-color: var(--color-gold-light);
}
.is-paper .orb-a {
  opacity: 0.55;
}
.is-paper .stop-b {
  stop-color: #fff;
}
.is-paper .orb-b {
  opacity: 0.6;
}
.is-paper .stop-c {
  stop-color: var(--color-gold);
}
.is-paper .orb-c {
  opacity: 0.4;
}

/* 漂移的左右端點收在「圓心 ± 半徑」附近不碰到 SVG 兩側（0／1000）：
   邊上沒有光斑的內容，遮罩圖層的邊才漏不出東西（見 template 的說明）。字佔 177～822，光斑仍掃過整行 */
@keyframes drift-a {
  0%,
  100% {
    transform: translate(240px, 62px);
  }
  50% {
    transform: translate(760px, 98px);
  }
}
@keyframes drift-b {
  0%,
  100% {
    transform: translate(800px, 36px);
  }
  50% {
    transform: translate(220px, 116px);
  }
}
@keyframes drift-c {
  0%,
  100% {
    transform: translate(660px, 124px);
  }
  50% {
    transform: translate(280px, 28px);
  }
}
</style>
