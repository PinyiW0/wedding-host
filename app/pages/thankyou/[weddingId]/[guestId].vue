<!-- app/pages/thankyou/[weddingId]/[guestId].vue — 賓客公開謝卡（信封開封 + 花田裝飾，RWD） -->
<!-- 視覺：粉嫩春日戀愛氛圍（參考手遊每日信封開卡：櫻粉信封＋圓形封印＋絲帶橫幅＋星空 Event 卡層疊） -->
<script setup lang="ts">
import { getPublicThankYouCard, listFlowers } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
const guestId = computed(() => String(route.params.guestId))

const { data: card } = await getPublicThankYouCard(weddingId, guestId, { default: () => null })

// 花田裝飾（取樣少量、非互動）
const { data: flowers } = await listFlowers(weddingId, { default: () => [] })
const flowerList = computed(() => flowers.value ?? [])

// 信封開封狀態機：點開啟 → 封蓋 3D 翻開（flapOpen）→ 卡片自信封口升出（opened）
const flapOpen = ref(false)
const opened = ref(false)
function openEnvelope() {
  if (flapOpen.value)
    return
  flapOpen.value = true
  setTimeout(() => {
    opened.value = true
  }, 400)
}

// 金箔圓印：取署名前兩字（卡面用）
const seal = computed(() => (card.value?.signature || '囍').slice(0, 2))

// 飄落花瓣（浪漫氛圍層）：定值參數（非隨機，避免 SSR hydration 不一致），玫瑰×金交錯
const petals = [
  { x: '6%', dur: 11, delay: 0, sway: 52, spin: 320, gold: false, s: 1 },
  { x: '16%', dur: 14, delay: 3.5, sway: -44, spin: -280, gold: true, s: 0.8 },
  { x: '26%', dur: 12, delay: 7, sway: 60, spin: 400, gold: false, s: 1.15 },
  { x: '36%', dur: 15, delay: 1.5, sway: -36, spin: 260, gold: true, s: 0.9 },
  { x: '46%', dur: 10, delay: 5, sway: 48, spin: -340, gold: false, s: 0.85 },
  { x: '56%', dur: 13, delay: 9, sway: -56, spin: 300, gold: false, s: 1.05 },
  { x: '66%', dur: 11.5, delay: 2.5, sway: 40, spin: -260, gold: true, s: 0.8 },
  { x: '74%', dur: 14.5, delay: 6, sway: -48, spin: 360, gold: false, s: 1.1 },
  { x: '84%', dur: 12.5, delay: 0.8, sway: 56, spin: -300, gold: false, s: 0.9 },
  { x: '92%', dur: 13.5, delay: 4.2, sway: -40, spin: 280, gold: true, s: 1 },
]
</script>

<template>
  <div data-testid="thankyou-public-page" class="relative flex min-h-[70vh] flex-col items-center justify-center py-6">
    <!-- 春日底色＋星塵（粉紫黃昏，蓋過 layout 底色） -->
    <div class="spring-sky pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <span class="stardust absolute inset-0" />
    </div>

    <!-- 飄落花瓣氛圍層（fixed 滿版、不擋互動；reduced-motion 全域 guard 會停用） -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <span
        v-for="(p, i) in petals"
        :key="i"
        class="petal"
        :class="p.gold ? 'petal-gold' : 'petal-rose'"
        :style="{
          'left': p.x,
          '--dur': `${p.dur}s`,
          '--delay': `${p.delay}s`,
          '--sway': `${p.sway}px`,
          '--spin': `${p.spin}deg`,
          '--s': p.s,
        }"
      />
    </div>

    <!-- 滿版飄逸細絲緞帶＋鬆結（線條感、畫入進場、微飄；開卡後淡出） -->
    <Transition name="silk">
      <svg
        v-if="!opened"
        class="ribbon-silk pointer-events-none fixed inset-0 z-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <g class="ribbon-draw">
          <!-- 主帶：自左上飄入 → 信封左側打結 → 自信封後穿出右緣 -->
          <path class="silk-base" pathLength="1" d="M -60 220 C 120 350, 250 455, 352 452 C 386 451, 400 450, 405 448" />
          <path class="silk-base" pathLength="1" d="M 405 448 C 580 480, 780 510, 960 470 C 1140 430, 1310 415, 1500 445" />
          <!-- 鬆結雙環 -->
          <path class="silk-base" pathLength="1" d="M 405 448 C 340 380, 275 405, 300 455 C 318 492, 380 476, 405 448" />
          <path class="silk-base" pathLength="1" d="M 405 448 C 462 392, 522 415, 500 462 C 483 497, 428 478, 405 448" />
          <!-- 彎曲飄尾 ×2 -->
          <path class="silk-base" pathLength="1" d="M 402 452 C 388 540, 345 600, 290 638 C 265 654, 245 658, 234 654" />
          <path class="silk-base" pathLength="1" d="M 408 452 C 424 550, 410 630, 372 686 C 356 708, 342 714, 332 712" />
          <!-- 絲光高光（沿主帶細線） -->
          <path class="silk-sheen" pathLength="1" d="M -60 216 C 120 346, 250 451, 352 448 C 386 447, 400 446, 405 444" />
          <path class="silk-sheen" pathLength="1" d="M 405 444 C 580 476, 780 506, 960 466 C 1140 426, 1310 411, 1500 441" />
        </g>
      </svg>
    </Transition>

    <!-- 開卡背景秀（櫻粉金）：光暈＋光帶＋緩轉放射線＋bokeh＋Love Story 裝飾字 -->
    <Transition name="reveal">
      <div v-if="opened" class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <span class="reveal-glow" />
        <span class="light-sweep" />
        <span class="reveal-rays" />
        <span v-for="b in 6" :key="b" class="bokeh" :class="`bokeh-${b}`" />
        <p class="lovestory font-display italic">
          Love Story
        </p>
      </div>
    </Transition>

    <!-- 信封 ⇄ 謝卡：同格疊放，卡片從信封口向上抽出展開 -->
    <div class="relative z-10 grid w-full place-items-center">
      <Transition name="envelope-out">
        <div v-if="!opened" key="envelope" class="envelope-intro col-start-1 row-start-1 flex flex-col items-center">
          <p class="relative z-10 mb-16 text-overline uppercase text-rose-400">
            With Love · 吳限幸福
          </p>

          <div class="envelope-tilt relative">
            <!-- 背後的蜜桃粉 Event 卡（層疊景深，同色系不突兀） -->
            <div class="event-card pointer-events-none absolute -right-10 -top-12 h-56 w-80 rounded-lg lg:h-64 lg:w-96" aria-hidden="true">
              <span class="pointer-events-none absolute inset-1.5 rounded border border-white/60" />
              <span class="absolute right-6 top-4 font-display text-3xl italic text-white">Thank You</span>
            </div>

            <!-- 主信封（櫻粉、傾斜、放大） -->
            <button
              type="button"
              data-testid="thankyou-envelope"
              aria-label="開啟你的專屬謝卡"
              class="envelope group relative h-64 w-[86vw] max-w-lg rounded-lg shadow-lg transition-transform duration-250 ease-standard hover:-translate-y-1 lg:h-72"
              @click="openEnvelope"
            >
              <span class="pointer-events-none absolute inset-2 rounded border border-gold/40" />
              <span class="fold-line fold-l pointer-events-none absolute" />
              <span class="fold-line fold-r pointer-events-none absolute" />

              <!-- 信封封蓋（可 3D 向後翻開；封印與 script 都黏在蓋上） -->
              <span class="flap-group absolute inset-x-0 top-0 z-20 h-[58%]" :class="{ 'flap-open': flapOpen }">
                <span class="flap-round-edge absolute inset-0" />
                <span class="flap-round absolute inset-x-0.5 top-0 h-[calc(100%-2.5px)]" />
                <!-- 收件人（封蓋上、封印正上方；開封即淡出，不跟著翻面） -->
                <span
                  class="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap font-hand text-2xl text-coffee transition-opacity duration-150 ease-standard"
                  :class="{ 'opacity-0': flapOpen }"
                >
                  {{ card?.guestName ? `親愛的 ${card.guestName}` : '一封專屬謝卡' }}
                </span>
                <!-- 圓形櫻花封印（開啟 CTA，黏在蓋尖） -->
                <span class="sakura-seal absolute bottom-0 left-1/2 flex size-20 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full transition-transform duration-250 ease-emphasized group-hover:scale-105">
                  <svg class="absolute inset-0 m-auto size-12 opacity-90" viewBox="0 0 48 48" fill="#d9b26e" aria-hidden="true">
                    <g transform="translate(24 24)">
                      <path d="M0 -16 Q 7 -9 5 -1 Q 0 4 -5 -1 Q -7 -9 0 -16 Z" />
                      <path d="M0 -16 Q 7 -9 5 -1 Q 0 4 -5 -1 Q -7 -9 0 -16 Z" transform="rotate(72)" />
                      <path d="M0 -16 Q 7 -9 5 -1 Q 0 4 -5 -1 Q -7 -9 0 -16 Z" transform="rotate(144)" />
                      <path d="M0 -16 Q 7 -9 5 -1 Q 0 4 -5 -1 Q -7 -9 0 -16 Z" transform="rotate(216)" />
                      <path d="M0 -16 Q 7 -9 5 -1 Q 0 4 -5 -1 Q -7 -9 0 -16 Z" transform="rotate(288)" />
                    </g>
                  </svg>
                </span>
              </span>
            </button>
          </div>

          <p class="mt-8 text-body-l text-ink-500">
            {{ card?.guestName ? `親愛的 ${card.guestName}，` : '' }}有一封<span class="font-medium text-rose-400">專屬謝卡</span>要給您
          </p>
          <p class="mt-1 text-caption text-ink-300">
            輕觸信封開啟
          </p>
        </div>

        <!-- 謝卡（自信封口向上抽出、邊升邊展開；內文元素兩拍錯落淡入） -->
        <div v-else key="card" class="card-wrap relative col-start-1 row-start-1 w-full max-w-xl">
          <div data-testid="thankyou-card" class="card-float relative z-10 overflow-hidden rounded-lg">
            <!-- 簾幕：卡片升定後向兩側拉開揭幕（card-curtain-reveal 語彙） -->
            <span class="curtain curtain-l pointer-events-none absolute inset-y-0 left-0 z-20 w-1/2" aria-hidden="true" />
            <span class="curtain curtain-r pointer-events-none absolute inset-y-0 right-0 z-20 w-1/2" aria-hidden="true" />
            <ThankYouCardPreview
              :greeting="card?.greeting"
              :guest-name="card?.guestName"
              :content="card?.content"
              placeholder="謝謝您與我們一同見證這份幸福，您的祝福我們銘記在心。"
              :signature="card?.signature"
              :signature-date="card?.signatureDate"
              :image-url="card?.templateImageUrl"
              :seal="seal"
            />
          </div>

          <!-- 花田裝飾：右下一叢探出卡外（z-0 藏卡後，不壓信箋文字），與 RSVP 花田統一套系 -->
          <div
            v-if="flowerList.length > 0"
            class="pointer-events-none absolute -bottom-8 -right-6 z-0 w-44 opacity-70"
          >
            <FlowerField :flowers="flowerList" :max="4" />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* ── 春日場景 ─────────────────────────────── */
/* 粉紫黃昏漸層（僅此頁，蓋過 layout 的 cream） */
.spring-sky {
  background: linear-gradient(180deg, #f2e6f1 0%, #f9e8ec 36%, #fdf2ee 72%, #f8ecdf 100%);
}
/* 星塵：三層細碎光點＋緩慢呼吸 */
.stardust {
  background-image:
    radial-gradient(circle, rgba(255, 255, 255, 0.9) 1px, transparent 1.6px),
    radial-gradient(circle, rgba(242, 197, 209, 0.85) 1px, transparent 1.7px),
    radial-gradient(circle, rgba(216, 195, 155, 0.75) 1.2px, transparent 1.9px);
  background-size: 210px 190px, 160px 230px, 260px 300px;
  background-position: 0 0, 60px 90px, 130px 40px;
  animation: twinkle 6s ease-in-out infinite alternate;
}
@keyframes twinkle {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}

/* ── 信封（影片同款：櫻粉、傾斜、封印、絲帶、星空卡層疊） ── */
.envelope-tilt {
  transform: rotate(-3deg);
}
.envelope {
  background: linear-gradient(160deg, #fffdf9, #fdf3ec);
  border: 1px solid rgba(205, 168, 110, 0.55);
  perspective: 900px;
}
/* 滿版飄逸細絲緞帶：雙層描邊擬絲光；載入畫入、落定後整條微飄 */
.ribbon-silk {
  animation: silk-float 8s ease-in-out 2s infinite alternate;
}
.silk-base {
  stroke: #eaa8b8;
  stroke-width: 17;
  opacity: 0.8;
}
.silk-sheen {
  stroke: #fbe3e9;
  stroke-width: 5.5;
  opacity: 0.9;
}
/* 畫入進場：整組線條 1.4s 描繪完成 */
.ribbon-draw path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: silk-draw 1400ms var(--ease-standard) both;
}
.ribbon-draw path:nth-child(n+3) {
  animation-delay: 500ms;
}
@keyframes silk-draw {
  to {
    stroke-dashoffset: 0;
  }
}
.silk-leave-active {
  transition: opacity 400ms var(--ease-standard);
}
.silk-leave-to {
  opacity: 0;
}
@keyframes silk-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-8px);
  }
}

/* 蜜桃粉 Event 卡（星點白、暖粉影） */
.event-card {
  background:
    radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.4) 1px, transparent 1.8px),
    radial-gradient(circle at 70% 60%, rgba(255, 255, 255, 0.35) 1px, transparent 1.6px),
    linear-gradient(150deg, #f4c3b8, #e8a396);
  background-size: 90px 80px, 130px 110px, 100% 100%;
  transform: rotate(4deg);
  box-shadow: 0 10px 28px rgba(200, 120, 110, 0.25);
}
/* 封蓋：clip-path 三角（響應式），雙層疊出玫瑰描邊；點開啟後 3D 向後翻起 */
.flap-group {
  transform-origin: top center;
  transform-style: preserve-3d;
  transition: transform 400ms var(--ease-emphasized);
}
.flap-group.flap-open {
  transform: rotateX(-165deg);
}
/* 圓弧封蓋（雙層疊金邊）：上緣貼頂、下緣大圓弧，左上帶粉暈 */
.flap-round-edge {
  border-radius: 0 0 52% 52% / 0 0 94% 94%;
  background: linear-gradient(180deg, rgba(216, 180, 120, 0.35), rgba(205, 168, 110, 0.6));
}
.flap-round {
  border-radius: 0 0 52% 52% / 0 0 94% 94%;
  background:
    radial-gradient(120% 90% at 18% 0%, rgba(244, 190, 205, 0.55), transparent 55%),
    linear-gradient(180deg, #fdeef2, #fdf7f2);
}
/* 信身 V 摺線（信封背面斜摺的細金線） */
.fold-line {
  width: 58%;
  height: 1px;
  bottom: 12px;
  background: rgba(205, 170, 120, 0.3);
}
.fold-l {
  left: 2px;
  transform-origin: left bottom;
  transform: rotate(-26deg);
}
.fold-r {
  right: 2px;
  transform-origin: right bottom;
  transform: rotate(26deg);
}
/* 圓形櫻花封印（開啟）：立體櫻粉章 */
.sakura-seal {
  background: #f3dca6;
  border: 1px solid rgba(190, 150, 80, 0.45);
}

/* 簾幕揭卡：緞面雙片自中縫向兩側拉開（一次性） */
.curtain {
  animation: curtain-pull 600ms var(--ease-emphasized) 720ms both;
}
.curtain-l {
  background: linear-gradient(90deg, #f6d6dc, #f2c3cd);
  border-right: 1px solid rgba(214, 140, 150, 0.6);
  transform-origin: left;
}
.curtain-r {
  background: linear-gradient(270deg, #f6d6dc, #f2c3cd);
  border-left: 1px solid rgba(214, 140, 150, 0.6);
  transform-origin: right;
}
.curtain-l { --dir: -103%; }
.curtain-r { --dir: 103%; }
@keyframes curtain-pull {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(var(--dir));
  }
}

/* ── 開卡轉場：信封下沉淡出、卡片自信封口向上抽出展開 ── */
.envelope-out-leave-active {
  transition:
    opacity 400ms var(--ease-standard),
    transform 400ms var(--ease-standard);
}
.envelope-out-leave-to {
  opacity: 0;
  transform: translateY(110px) scale(0.96);
}
.card-wrap {
  transform-origin: 50% 85%;
}
.envelope-out-enter-active {
  transition:
    opacity 500ms var(--ease-emphasized) 140ms,
    transform 500ms var(--ease-emphasized) 140ms;
}
.envelope-out-enter-from {
  opacity: 0;
  transform: translateY(230px) scale(0.55);
}

/* ── 飄落花瓣 ── */
.petal {
  position: absolute;
  top: -5rem;
  width: calc(14px * var(--s, 1));
  height: calc(19px * var(--s, 1));
  border-radius: 72% 28% 62% 38% / 58% 42% 64% 36%;
  animation: petal-fall var(--dur, 12s) linear var(--delay, 0s) infinite;
  opacity: 0;
}
.petal-rose {
  background: linear-gradient(135deg, #f4cdc9, #e394a5);
}
.petal-gold {
  background: linear-gradient(135deg, #ecdcba, #d8c39b);
}
@keyframes petal-fall {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
    opacity: 0;
  }
  6% {
    opacity: 0.75;
  }
  50% {
    transform: translate3d(var(--sway, 48px), 55vh, 0) rotate(calc(var(--spin, 300deg) / 2));
    opacity: 0.7;
  }
  100% {
    transform: translate3d(calc(var(--sway, 48px) * -0.4), 112vh, 0) rotate(var(--spin, 300deg));
    opacity: 0.55;
  }
}

/* ── 開卡背景秀（櫻粉金） ── */
.reveal-enter-active {
  transition: opacity 400ms var(--ease-standard);
}
.reveal-enter-from {
  opacity: 0;
}
.reveal-glow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 120vmin;
  height: 120vmin;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(239, 170, 188, 0.28), rgba(239, 170, 188, 0.1) 40%, transparent 68%);
}
.light-sweep {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 140vw;
  height: 24vh;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(244, 205, 201, 0.5) 30%,
    rgba(252, 235, 232, 0.75) 50%,
    rgba(239, 170, 188, 0.5) 70%,
    transparent
  );
  filter: blur(8px);
  transform-origin: center;
  animation: sweep-open 800ms var(--ease-emphasized) both;
}
@keyframes sweep-open {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scaleY(0.04);
  }
  35% {
    opacity: 1;
    transform: translate(-50%, -50%) scaleY(0.5);
  }
  70% {
    opacity: 0.7;
    transform: translate(-50%, -50%) scaleY(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scaleY(1.15);
  }
}
.reveal-rays {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 165vmax;
  height: 165vmax;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(231, 140, 163, 0.07) 0deg 5deg, transparent 5deg 16deg);
  mask-image: radial-gradient(circle, black 0%, transparent 62%);
  animation: rays-spin 80s linear infinite;
}
@keyframes rays-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
.bokeh {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 197, 208, 0.6), transparent 70%);
  filter: blur(2px);
  animation: bokeh-float var(--bd, 9s) ease-in-out var(--bdel, 0s) infinite alternate;
}
.bokeh-2,
.bokeh-5 {
  background: radial-gradient(circle, rgba(216, 195, 155, 0.55), transparent 70%);
}
.bokeh-1 { left: 10%; top: 24%; width: 38px; height: 38px; --bd: 8s; }
.bokeh-2 { left: 84%; top: 16%; width: 56px; height: 56px; --bd: 11s; --bdel: 1.5s; }
.bokeh-3 { left: 18%; top: 68%; width: 30px; height: 30px; --bd: 9s; --bdel: 3s; }
.bokeh-4 { left: 78%; top: 74%; width: 44px; height: 44px; --bd: 10s; --bdel: 0.8s; }
.bokeh-5 { left: 6%; top: 46%; width: 24px; height: 24px; --bd: 12s; --bdel: 2.2s; }
.bokeh-6 { left: 92%; top: 46%; width: 32px; height: 32px; --bd: 8.5s; --bdel: 4s; }
@keyframes bokeh-float {
  from {
    transform: translateY(0);
    opacity: 0.3;
  }
  to {
    transform: translateY(-26px);
    opacity: 0.65;
  }
}
/* 純裝飾大字（visual-hierarchy 允許：低透明度、獨立背景層） */
.lovestory {
  position: absolute;
  left: 50%;
  top: 9%;
  transform: translateX(-50%) rotate(-4deg);
  font-size: clamp(56px, 10vw, 118px);
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.04em;
  color: rgba(214, 124, 148, 0.2);
}

/* ── 謝卡漂浮與信箋錯落 ── */
.card-float {
  animation: card-float 6s ease-in-out 1.5s infinite alternate;
}
@keyframes card-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-6px);
  }
}

/* 載入進場（單拍不搶戲） */
.envelope-intro {
  animation: intro-in 400ms var(--ease-standard) both;
}
@keyframes intro-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

/* 第二拍：信箋內文元素錯落淡入（step 80ms，於 <style> 層遞延） */
.card-wrap :deep(.ty-card-body > *) {
  animation: card-item-in 400ms var(--ease-standard) both;
}
.card-wrap :deep(.ty-card-body > *:nth-child(2)) {
  animation-delay: 80ms;
}
.card-wrap :deep(.ty-card-body > *:nth-child(3)) {
  animation-delay: 160ms;
}
.card-wrap :deep(.ty-card-body > *:nth-child(4)) {
  animation-delay: 240ms;
}
.card-wrap :deep(.ty-card-body > *:nth-child(5)) {
  animation-delay: 320ms;
}
@keyframes card-item-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
