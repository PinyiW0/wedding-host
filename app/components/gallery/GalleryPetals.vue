<!-- app/components/gallery/GalleryPetals.vue — 玫瑰花瓣灑落
     從指定的錨點區塊（城市那一段）開始飄，一路掉到頁尾，所以它是**頁面層級的固定圖層**，
     不是掛在某個系列區塊裡——掛在區塊裡的話，區塊一捲完花瓣就跟著離開，到不了頁尾。
     z-index 40：壓在照片之上、所有介面元素（音樂鈕 50、選單 65/70、游標 90）之下。
     一片花瓣拆成三層，因為落下／左右搖／自轉都要動 transform，
     放同一個元素上只有最後一個 animation 會生效。 -->
<script setup lang="ts">
const props = defineProps<{
  /** 從哪個區塊的 id 開始灑 */
  anchor: string
}>()

/**
 * 花瓣版型。全部寫死、不用亂數——亂數會讓 SSR 與 client 算出不同的值，hydration 對不起來。
 * x：左緣 vw；size：寬 px；dx：左右搖擺幅度 vw；dur：一趟落到底幾秒；
 * sway：左右搖一個來回幾秒；tumble：自轉一圈幾秒；rev：反向自轉；art：用第幾張花瓣
 */
interface Petal {
  x: number
  size: number
  dx: number
  dur: number
  sway: number
  tumble: number
  delay: number
  o: number
  rev: boolean
  art: number
}

const PETALS: Petal[] = [
  { x: 3, size: 26, dx: 3.5, dur: 17, sway: 4.5, tumble: 9, delay: 0, o: 0.8, rev: false, art: 1 },
  { x: 11, size: 15, dx: 2.5, dur: 13, sway: 3.4, tumble: 7, delay: 5, o: 0.7, rev: true, art: 2 },
  { x: 18, size: 32, dx: 5, dur: 21, sway: 6, tumble: 12, delay: 9, o: 0.85, rev: false, art: 3 },
  { x: 26, size: 19, dx: 3, dur: 15, sway: 3.8, tumble: 8, delay: 2, o: 0.7, rev: true, art: 1 },
  { x: 34, size: 24, dx: 4.2, dur: 19, sway: 5.2, tumble: 10, delay: 12, o: 0.8, rev: false, art: 2 },
  { x: 41, size: 13, dx: 2.2, dur: 12, sway: 3, tumble: 6, delay: 7, o: 0.6, rev: true, art: 3 },
  { x: 48, size: 30, dx: 4.8, dur: 23, sway: 5.6, tumble: 13, delay: 16, o: 0.8, rev: false, art: 1 },
  { x: 55, size: 17, dx: 2.8, dur: 14, sway: 3.6, tumble: 7.5, delay: 3, o: 0.7, rev: true, art: 2 },
  { x: 63, size: 34, dx: 5.4, dur: 25, sway: 6.4, tumble: 14, delay: 10, o: 0.85, rev: false, art: 3 },
  { x: 70, size: 21, dx: 3.2, dur: 16, sway: 4.2, tumble: 8.5, delay: 19, o: 0.75, rev: true, art: 1 },
  { x: 77, size: 14, dx: 2.4, dur: 12.5, sway: 3.2, tumble: 6.5, delay: 6, o: 0.6, rev: false, art: 2 },
  { x: 84, size: 28, dx: 4.5, dur: 20, sway: 5, tumble: 11, delay: 14, o: 0.8, rev: true, art: 3 },
  { x: 90, size: 18, dx: 3, dur: 15.5, sway: 4, tumble: 9.5, delay: 1, o: 0.7, rev: false, art: 1 },
  { x: 95, size: 23, dx: 3.8, dur: 18, sway: 4.8, tumble: 10.5, delay: 8, o: 0.75, rev: true, art: 2 },
]

const petals = PETALS.map(p => ({
  src: `/images/gallery-art/rose-${p.art}.webp`,
  fall: {
    '--x': `${p.x}vw`,
    '--dur': `${p.dur}s`,
    '--delay': `${-p.delay}s`,
    '--o': String(p.o),
  },
  sway: {
    '--dx': `${p.dx}vw`,
    '--sway': `${p.sway}s`,
    '--delay': `${-p.delay}s`,
  },
  art: {
    '--s': `${p.size}px`,
    '--tumble': `${p.tumble}s`,
    '--dir': p.rev ? 'reverse' : 'normal',
  },
}))

const isOn = ref(false)
let ticking = false

function update() {
  ticking = false
  const el = document.getElementById(props.anchor)
  if (!el)
    return
  // 錨點區塊進畫面兩成就開始灑，之後一路到頁尾都不關
  isOn.value = el.getBoundingClientRect().top < window.innerHeight * 0.8
}

function onScroll() {
  if (ticking)
    return
  ticking = true
  requestAnimationFrame(update)
}

onMounted(() => {
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="gpt" :data-on="isOn ? 'true' : 'false'" aria-hidden="true">
    <span v-for="(p, i) in petals" :key="i" class="gpt-fall" :style="p.fall">
      <span class="gpt-sway" :style="p.sway">
        <img :src="p.src" alt="" loading="lazy" decoding="async" class="gpt-art" :style="p.art">
      </span>
    </span>
  </div>
</template>

<style scoped>
.gpt {
  position: fixed;
  inset: 0;
  z-index: 40;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 900ms var(--ease-standard);
}

.gpt[data-on="true"] {
  opacity: 1;
}

/* 沒進到灑花的範圍就不要空轉 */
.gpt[data-on="false"] .gpt-fall,
.gpt[data-on="false"] .gpt-sway,
.gpt[data-on="false"] .gpt-art {
  animation-play-state: paused;
}

.gpt-fall {
  position: absolute;
  top: -18vh;
  left: var(--x, 50vw);
  opacity: 0;
  animation: gpt-fall var(--dur, 18s) linear infinite;
  animation-delay: var(--delay, 0s);
}

@keyframes gpt-fall {
  0% {
    transform: translate3d(0, 0, 0);
    opacity: 0;
  }

  8% {
    opacity: var(--o, 0.8);
  }

  88% {
    opacity: var(--o, 0.8);
  }

  100% {
    transform: translate3d(0, 138vh, 0);
    opacity: 0;
  }
}

/* alternate：兩端各停一下才像被風托著飄，不是等速平移 */
.gpt-sway {
  display: block;
  animation: gpt-sway var(--sway, 5s) var(--ease-standard) infinite alternate;
  animation-delay: var(--delay, 0s);
}

@keyframes gpt-sway {
  from {
    transform: translate3d(calc(var(--dx, 3vw) * -1), 0, 0);
  }

  to {
    transform: translate3d(var(--dx, 3vw), 0, 0);
  }
}

.gpt-art {
  display: block;
  width: var(--s, 22px);
  height: auto;
  animation: gpt-tumble var(--tumble, 10s) linear infinite;
  animation-direction: var(--dir, normal);
}

/* from／to 都要明寫角度，只寫 to 會退回矩陣插值而變靜止（同金唱片、風車） */
@keyframes gpt-tumble {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gpt {
    display: none;
  }
}
</style>
