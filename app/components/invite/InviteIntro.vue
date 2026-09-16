<!-- app/components/invite/InviteIntro.vue — 入口頁開場：銀盤上一封封蠟的喜帖
     點一下才進到桌面場景。刻意不鋪底色——葉影與紙紋是同一個空間，
     開場與桌面共用同一片背景，切換時只有「桌上的東西出現了」，不是換場。 -->
<script setup lang="ts">
import type { SceneIntro } from '~/types/invite'

defineProps<{
  intro: SceneIntro
  /** true＝正在播離場（信封往前放大溶出），由舞台在點擊後切換 */
  opening: boolean
}>()

const emit = defineEmits<{
  open: []
}>()
</script>

<template>
  <div class="intro" :class="{ 'is-opening': opening }">
    <img :src="intro.backdrop" alt="" class="intro-backdrop" loading="eager" decoding="async">
    <div class="intro-inner">
      <button type="button" class="intro-hit" aria-label="打開喜帖" @click="emit('open')">
        <img :src="intro.tray" alt="" class="intro-tray" loading="eager" decoding="async">
        <img :src="intro.envelope" alt="" class="intro-envelope" loading="eager" decoding="async">
      </button>
      <p class="intro-hint text-body tracking-wide text-ink-500">
        {{ intro.hint }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.intro {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 6vh 1.5rem;
}

/* 離場開始就交出點擊：底下的桌面此時已經在演進場了 */
.intro.is-opening {
  pointer-events: none;
}

/* 花藝平鋪底圖：開場自成一個世界，離場時整片溶掉才露出桌面那層紙紋與葉影 */
.intro-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: intro-backdrop-in 700ms var(--ease-standard) both;
}

@keyframes intro-backdrop-in {
  from {
    opacity: 0;
  }
}

/* position 是必要的：底圖是 absolute，不給 inner 定位的話會被蓋在底下 */
.intro-inner {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 1.75rem;
  animation: intro-in 600ms var(--ease-emphasized) 120ms both;
}

@keyframes intro-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}

.intro-hit {
  position: relative;
  display: block;
  cursor: pointer;
  border-radius: var(--radius);
  transition: transform 250ms var(--ease-emphasized);
}

/* 信封比盤子寬，溢出的兩側原本落在 button 的框外、點不到。
   用不影響版面的 ::after 把可點範圍補到信封實際邊界。 */
.intro-hit::after {
  content: "";
  position: absolute;
  inset: -2% -14%;
}

.intro-hit:hover,
.intro-hit:focus-visible {
  transform: scale(1.02);
}

.intro-hit:active {
  transform: scale(0.99);
}

.intro-hit:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 12px;
}

/* 銀盤以高度定尺寸：開場只有這一個焦點，視窗多高它就佔多少，不受寬度影響 */
.intro-tray {
  display: block;
  height: min(46dvh, 380px);
  width: auto;
  filter: drop-shadow(0 26px 44px rgba(17, 17, 17, 0.14));
}

.intro-envelope {
  position: absolute;
  left: 50%;
  top: 50%;
  /* 略寬於盤子：喜帖是這一幕唯一的主角，收在盤內會被銀盤的花邊搶走視線。
     溢出的部分靠 .intro-hit::after 補回可點範圍（button 的框只到盤子邊）。 */
  width: 114%;
  /* Tailwind preflight 的 img { max-width: 100% } 會把它夾在盤子寬度上，
     不解開的話 width 寫多少都只到 100% */
  max-width: none;
  transform: translate(-50%, -50%) rotate(-3deg);
  filter: drop-shadow(0 12px 20px rgba(17, 17, 17, 0.16));
  animation: intro-breathe 3.6s var(--ease-standard) infinite;
}

/* 極低振幅的呼吸，只是要讓人看出「這東西可以按」——
   位移寫在 translate 的 y 分量裡，基準的 -50% 與 rotate 每一幀都要帶上，
   否則動畫會把定位一起蓋掉。 */
@keyframes intro-breathe {
  0%,
  100% {
    transform: translate(-50%, calc(-50% - 4px)) rotate(-3deg);
  }

  50% {
    transform: translate(-50%, calc(-50% + 4px)) rotate(-3deg);
  }
}

.intro-hint {
  margin: 0;
}

/* 桌機給更大的畫面：開場只有這一個焦點，銀盤太小會在 1440 寬的版面裡失重 */
@media (min-width: 1024px) {
  .intro-tray {
    height: min(58dvh, 520px);
  }

  .intro-inner {
    gap: 2.25rem;
  }
}

/* ── 離場：提示先收，銀盤淡出，信封往觀者穿過來 ── */
/* 素材是一張封好的平面圖，沒有可以掀開的封口圖層，所以「打開」用鏡頭穿過去表達：
   先後縮蓄力（22%），再放大淡出。整段 950ms——太快會像畫面被抽掉而不是被打開。
   opacity 在 88% 才歸零：太早收乾淨的話，信封沒了、桌面還沒開始演，中間會空一大段。 */
.is-opening .intro-envelope {
  animation: intro-envelope-out 950ms var(--ease-standard) both;
}

@keyframes intro-envelope-out {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(-3deg) scale(1);
  }

  22% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(-3deg) scale(0.94);
  }

  88% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-2deg) scale(2.2);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-1deg) scale(2.4);
  }
}

/* 銀盤晚一拍才退，先讓信封離開盤面——同時消失會看不出誰動了 */
.is-opening .intro-tray {
  animation: intro-fade-out 480ms var(--ease-standard) 140ms both;
}

.is-opening .intro-hint {
  animation: intro-fade-out 220ms var(--ease-standard) both;
}

/* 底圖最後才走（900ms 收乾淨，桌面 1050ms 才開演）：
   提示 → 銀盤 → 底圖，一層一層退，最後只剩信封往前穿過去 */
.is-opening .intro-backdrop {
  animation: intro-fade-out 700ms var(--ease-standard) 200ms both;
}

@keyframes intro-fade-out {
  to {
    opacity: 0;
  }
}
</style>
