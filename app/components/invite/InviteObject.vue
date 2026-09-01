<!-- app/components/invite/InviteObject.vue — 入口頁舞台上的單一物件
     三層職責：定位（桌機／手機兩組 CSS var，純 CSS 切換不靠 JS 判斷斷點，故無 hydration 風險）
     → 進場（stagger）→ 藝術層（視差位移／旋轉／漂浮／hover）。 -->
<script setup lang="ts">
import type { SceneItem } from '~/types/invite'
import { NuxtLink } from '#components'

const props = defineProps<{
  item: SceneItem
  /** 由舞台決定：reduced-motion 或手機時關閉持續漂浮 */
  floatEnabled: boolean
  /** 背景音樂是否正在播放——僅 musicToggle 物件用來決定要不要轉 */
  isMusicPlaying: boolean
  /** 目前在桌上的貓（SceneCat.key）；腳印用它標 aria-expanded */
  activeCat: string | null
}>()

const emit = defineEmits<{
  toggleMusic: []
  openCat: [key: string]
}>()

const tag = computed(() => {
  if (props.item.musicToggle || props.item.cat)
    return 'button'
  return props.item.to ? NuxtLink : 'div'
})

// 貓掌印不給 aria-label：可及名稱由裡面那張圖的 alt（「認識貓咪 Healthy」）提供，
// 兩邊都寫會讓螢幕閱讀器唸兩次
const tagProps = computed(() => {
  if (props.item.musicToggle) {
    return {
      'type': 'button',
      'aria-label': props.isMusicPlaying ? '暫停背景音樂' : '播放背景音樂',
      'aria-pressed': props.isMusicPlaying,
    }
  }
  return props.item.cat
    ? { 'type': 'button', 'aria-expanded': props.activeCat === props.item.cat }
    : { to: props.item.to }
})

function onActivate() {
  if (props.item.musicToggle)
    emit('toggleMusic')
  else if (props.item.cat)
    emit('openCat', props.item.cat)
}

const posStyle = computed(() => {
  const { desktop: d, mobile: m, z } = props.item
  return {
    '--d-x': `${d.x}%`,
    '--d-y': `${d.y}%`,
    '--d-w': `${d.w}%`,
    '--d-rot': `${d.rotate ?? 0}deg`,
    '--m-x': m ? `${m.x}%` : '0%',
    '--m-y': m ? `${m.y}%` : '0%',
    '--m-w': m ? `${m.w}%` : '0%',
    '--m-rot': `${m?.rotate ?? 0}deg`,
    '--m-display': m ? 'block' : 'none',
    '--z': String(z),
    '--i': String(props.item.order),
    '--depth': String(props.item.depth),
    '--d-flip': d.flip === 'x' ? '-1' : '1',
    '--m-flip': m?.flip === 'x' ? '-1' : '1',
    '--phase-delay': `${props.item.phaseDelay ?? 0}ms`,
  }
})

// 手寫小字的幾何：cqw 讓字級跟著物件寬度縮放（容器是 .si-link，見 style）
const captionStyle = computed(() => {
  const c = props.item.caption
  return c
    ? {
        '--cap-x': `${c.x}%`,
        '--cap-y': `${c.y}%`,
        '--cap-w': `${c.w}%`,
        '--cap-rot': `${c.rotate}deg`,
        '--cap-size': `${c.size}cqw`,
      }
    : undefined
})

const floatClass = computed(() => {
  if (props.item.musicToggle)
    return props.isMusicPlaying ? 'si-float-spin' : null
  return props.floatEnabled && props.item.float ? `si-float-${props.item.float}` : null
})

const enterClass = computed(() =>
  props.item.entrance === 'slide-up' ? 'si-reveal-up' : null,
)

const linkClass = computed(() => [
  props.item.to || props.item.musicToggle || props.item.cat ? 'si-link' : 'si-plain',
  props.item.hover === 'wobble' ? 'si-wobble' : null,
  props.item.cat ? 'si-cat' : null,
  props.item.caption ? 'si-cap-host' : null,
])
</script>

<template>
  <div
    class="si"
    :class="item.group ? `si-group-${item.group}` : null"
    :style="posStyle"
    :aria-hidden="item.alt || item.musicToggle ? undefined : 'true'"
  >
    <div class="si-enter" :class="enterClass">
      <component
        :is="tag"
        v-bind="tagProps"
        :class="linkClass"
        @click="onActivate"
      >
        <img
          v-if="item.src"
          :src="item.src"
          :alt="item.alt"
          :loading="item.eager ? 'eager' : 'lazy'"
          decoding="async"
          class="si-art"
          :class="floatClass"
        >
        <!-- 素材未到位時的站位色塊：標出物件位置與大小，方便先對版與調座標 -->
        <div v-else class="si-art si-placeholder" :class="floatClass">
          <span class="text-caption text-ink-500">{{ item.key }}</span>
        </div>
        <!-- 手寫小字；連結本身已有語意 alt，這兩個都純裝飾。
             桌機 hover 才浮現、手機常駐——兩顆各自渲染，由 CSS 斷點決定誰出現，
             不用 JS 判斷斷點，SSR 兩端輸出一致。 -->
        <span v-if="item.caption" class="si-caption si-caption-hover" :style="captionStyle" aria-hidden="true">
          <span v-for="line in item.caption.lines" :key="line">{{ line }}</span>
        </span>
        <span v-if="item.caption?.mobileLines" class="si-caption si-caption-static" :style="captionStyle" aria-hidden="true">
          <span v-for="line in item.caption.mobileLines" :key="line">{{ line }}</span>
        </span>
      </component>
    </div>
  </div>
</template>

<style scoped>
/* 定位層：手機為預設值，桌機由 media query 覆寫——兩端 SSR 輸出相同 */
.si {
  position: absolute;
  left: var(--m-x);
  top: var(--m-y);
  z-index: var(--z);
  width: var(--m-w);
  display: var(--m-display);
  transform: translate(-50%, -50%);
}

@media (min-width: 1024px) {
  .si {
    left: var(--d-x);
    top: var(--d-y);
    width: var(--d-w);
    display: block;
  }
}

/* 進場：單拍上浮，step 70ms（遞延用 calc()，不用任意值 delay class）；
   phase-delay 疊加在後面——場景分先後幾幕時，同一幕內物件仍保有彼此的 stagger。 */
.si-enter {
  animation: si-in 400ms var(--ease-emphasized) both;
  animation-delay: calc(var(--i, 0) * 70ms + var(--phase-delay, 0ms));
}

@keyframes si-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
}

/* 信封組愛心卡專用進場：從自身高度下方滑出，像從信封裡被抽出來——
   translateY 用 % 相對自己的渲染高度，桌機/手機不用分別調整幅度。
   起跑時間固定用 --phase-delay（不吃 order stagger，只有這一個物件走這個 timing）。
   起始位移刻意壓在 11%：再低卡片下緣就會探出信封前片外，淡入時會穿幫（兩個斷點都驗過）。
   用 linear 而非 --ease-emphasized：後者在時間軸 45% 處就跑完 94% 的位移，
   卡片會「淡入完就已經定格」，看不出滑動。 */
.si-reveal-up {
  animation: si-reveal-up-in 800ms linear var(--phase-delay, 0ms) both;
}

/* opacity 比 transform 早收尾：30% 時已全不透明、位移還剩 7.7%，
   所以看得到的是「浮現後繼續往上滑進定位」，而不是憑空出現。 */
@keyframes si-reveal-up-in {
  0% {
    opacity: 0;
    transform: translateY(11%);
  }

  30% {
    opacity: 1;
  }

  100% {
    opacity: 1;
    transform: translateY(0%);
  }
}

.si-plain,
.si-link {
  display: block;
}

.si-link {
  position: relative;
  cursor: pointer;
  border-radius: var(--radius);
}

/* 手寫小字的字級用 cqw，需要一個 inline-size 容器。
   只掛在真的有小字的物件上：<button> 一旦帶 container-type 會被算成 0 寬
   （金唱片與貓掌印都踩過——圖片靠 overflow 還看得到，但按鈕本身按不到）。 */
.si-cap-host {
  container-type: inline-size;
}

/* 貓掌印素材只有 3.5~8.8% 寬（手機最小 21px），直接當按鈕會小到按不到。
   用一個看不見的方塊把可點範圍補到 44px（WCAG 目標尺寸下限），視覺完全不變。 */
.si-cat::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100%, 44px);
  height: max(100%, 44px);
  transform: translate(-50%, -50%);
}

/* hover 的左右晃：轉軸放在頂端（拍立得是用迴紋針夾著的），撥一下晃兩下就停。
   用獨立的 rotate 屬性而不是 transform：.si-art 自己的 transform 鏈（視差／旋轉／
   鏡射／hover 放大）還要繼續運作，兩層各自轉、瀏覽器會相乘，不會互相蓋掉。
   小字是這一層的子元素，所以會一起晃。 */
.si-wobble {
  transform-origin: 50% 8%;
}

.si-wobble:hover,
.si-wobble:focus-visible {
  animation: si-wobble 900ms var(--ease-standard);
}

@keyframes si-wobble {
  0%,
  100% {
    rotate: 0deg;
  }

  15% {
    rotate: -3.2deg;
  }

  38% {
    rotate: 2.4deg;
  }

  60% {
    rotate: -1.4deg;
  }

  80% {
    rotate: 0.6deg;
  }
}

/* 手寫小字：位置／傾角／字級全部由 useInviteScene 的 caption 餵 CSS var 進來。
   墊一層對話框——手寫細字直接壓在照片與白邊交界上會讀不清楚。
   內距／圓角／尾巴全用 em，跟著 --cap-size 一起縮放，物件放大縮小都不會走樣。 */
.si-caption {
  position: absolute;
  left: var(--cap-x);
  top: var(--cap-y);
  z-index: 1;
  display: grid;
  justify-items: center;
  width: max-content;
  max-width: var(--cap-w);
  padding: 0.5em 0.95em 0.55em;
  transform: translate(-50%, -50%) rotate(var(--cap-rot));
  border: 1px solid var(--color-line);
  border-radius: 1.1em;
  background: var(--color-paper);
  box-shadow: var(--shadow);
  font-family: var(--font-hand);
  font-size: var(--cap-size);
  line-height: 1.3;
  color: var(--color-ink);
  text-align: center;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 250ms var(--ease-standard);
  pointer-events: none;
}

/* 尾巴：旋轉 45° 的方塊只留左上兩邊框，內部填色蓋掉框體自己的上緣，接縫就消失了 */
.si-caption::after {
  content: '';
  position: absolute;
  top: -0.46em;
  left: 24%;
  width: 0.86em;
  height: 0.86em;
  transform: rotate(45deg);
  border-top: 1px solid var(--color-line);
  border-left: 1px solid var(--color-line);
  border-top-left-radius: 0.16em;
  background: var(--color-paper);
}

/* 桌機那顆平常透明、hover 才浮現；手機那顆常駐 */
.si-caption-hover {
  display: none;
}

.si-caption-static {
  /* 手機的拍立得比較小，同一個 --cap-size 換算出來的字太細，這裡放大一級 */
  font-size: calc(var(--cap-size) * 1.5);
  opacity: 1;
}

@media (min-width: 1024px) {
  .si-caption-hover {
    display: grid;
  }

  .si-caption-static {
    display: none;
  }
}

.si-link:hover .si-caption-hover,
.si-link:focus-visible .si-caption-hover {
  opacity: 1;
}

.si-link:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 6px;
}

/* 藝術層：視差位移 + 旋轉 + hover 放大合併在同一個 transform */
.si-art {
  --rot: var(--m-rot, 0deg);
  --flip: var(--m-flip, 1);
  --si-shift: translate3d(
    calc(var(--px, 0px) * var(--depth, 0)),
    calc(var(--py, 0px) * var(--depth, 0)),
    0
  );

  display: block;
  width: 100%;
  height: auto;
  transform: var(--si-shift) translateY(var(--lift, 0)) rotate(var(--rot)) scale(var(--hover, 1)) scaleX(var(--flip, 1));
  transition: transform 250ms var(--ease-emphasized), filter 250ms var(--ease-standard);
  will-change: transform;
}

@media (min-width: 1024px) {
  .si-art {
    --rot: var(--d-rot, 0deg);
    --flip: var(--d-flip, 1);
  }
}

.si-link:hover .si-art,
.si-link:focus-visible .si-art {
  --hover: 1.03;
  --lift: -8px;

  filter: drop-shadow(0 14px 26px rgba(17, 17, 17, 0.18));
}

/* 按下的即時回饋（點擊後就要換頁，離場轉場交給目標頁自己的進場） */
.si-link:active .si-art {
  --hover: 0.99;
  --lift: -3px;
}

/* 站位色塊（素材到位後不再出現） */
.si-placeholder {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  border: 1px dashed var(--color-line);
  border-radius: var(--radius);
  background: rgba(184, 150, 90, 0.08);
}

/* 持續漂浮：只動 transform，振幅低；負延遲讓同語彙的物件錯開相位 */
.si-float-ribbon {
  animation: si-sway 9s var(--ease-standard) infinite;
  animation-delay: calc(var(--i, 0) * -1.7s);
}

@keyframes si-sway {
  0%,
  100% {
    transform: var(--si-shift) translateY(var(--lift, 0)) rotate(calc(var(--rot) - 1.2deg)) scaleX(var(--flip, 1));
  }

  50% {
    transform: var(--si-shift) translateY(var(--lift, 0)) rotate(calc(var(--rot) + 1.2deg)) scaleX(var(--flip, 1));
  }
}

.si-float-leaf {
  animation: si-drift 11s var(--ease-standard) infinite;
  animation-delay: calc(var(--i, 0) * -2.3s);
}

@keyframes si-drift {
  0%,
  100% {
    transform: var(--si-shift) rotate(var(--rot)) translateY(0);
  }

  50% {
    transform: var(--si-shift) rotate(calc(var(--rot) + 7deg)) translateY(-9px);
  }
}

/* 金唱片自轉：素材的金屬反光是有方向性的，慢速整圈旋轉才看得出「唱片在轉」。
   一圈 28 秒（≈2rpm）——真實轉速在裝飾物件上會太吵，這裡取「看得出來但不搶戲」的速度。
   from/to 兩幀寫同一組 transform function（只有角度不同），
   瀏覽器才會逐項插值；只寫 to 會退回矩陣插值，0deg 與 360deg 的矩陣相同，整個動畫會變成靜止。 */
.si-float-spin {
  animation: si-spin 28s linear infinite;
}

@keyframes si-spin {
  from {
    transform: var(--si-shift) rotate(var(--rot)) scaleX(var(--flip, 1));
  }

  to {
    transform: var(--si-shift) rotate(calc(var(--rot) + 360deg)) scaleX(var(--flip, 1));
  }
}

.si-float-petal {
  animation: si-flutter 13s var(--ease-standard) infinite;
  animation-delay: calc(var(--i, 0) * -3.1s);
}

@keyframes si-flutter {
  0%,
  100% {
    transform: var(--si-shift) rotate(var(--rot)) translate(0, 0);
  }

  35% {
    transform: var(--si-shift) rotate(calc(var(--rot) + 12deg)) translate(6px, -7px);
  }

  70% {
    transform: var(--si-shift) rotate(calc(var(--rot) - 8deg)) translate(-5px, -3px);
  }
}
</style>
