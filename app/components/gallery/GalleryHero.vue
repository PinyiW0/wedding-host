<!-- app/components/gallery/GalleryHero.vue — 婚紗相簿首屏
     照片滿版出血；外框寬度由頁面的 --gallery-frame 決定（目前 0），開場動畫的落點以此對齊。
     標語拆成四個大字圍在照片四邊（上方那個會輪換）；往下捲時四個字先聚合到畫面正中央
     疊成一行標語，再整組往上滑走。
     捲動進度 --hp 預設 0＝散在四邊，所以沒有 JS 或關閉動效時就是一張完整的首屏。
     本檔不在 visual-hierarchy 的公開頁白名單內，display 級字級一律走 <style scoped>。 -->
<script setup lang="ts">
import type { GalleryHeroContent } from '~/types/gallery'

const props = defineProps<{
  hero: GalleryHeroContent
}>()

/** 上方大字輪換間隔 */
const SWAP_MS = 3400

const rootRef = ref<HTMLElement | null>(null)
const wordIndex = ref(0)
let swapTimer: ReturnType<typeof setInterval> | undefined

const topWord = computed(() => {
  const list = props.hero.words.top
  return list[wordIndex.value % list.length] ?? list[0] ?? ''
})

const { register } = useScrollProgress()

onMounted(() => {
  register(rootRef.value, { varName: '--hp', mode: 'leave' })
  // 文字輪換是 JS 驅動的，繞得過 main.css 的 CSS guard，得自己判斷
  if (props.hero.words.top.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  swapTimer = setInterval(() => {
    wordIndex.value += 1
  }, SWAP_MS)
})

onBeforeUnmount(() => clearInterval(swapTimer))
</script>

<template>
  <section ref="rootRef" class="gh-root">
    <div class="gh-frame">
      <img
        :src="hero.src"
        :alt="hero.alt"
        class="gh-img"
        fetchpriority="high"
      >
      <div class="gh-scrim" aria-hidden="true" />

      <!-- 標語的完整文字給螢幕閱讀器；畫面上由四邊的大字呈現 -->
      <h1 class="sr-only">
        {{ hero.tagline }}
      </h1>

      <!-- 開場描完的那個字樣，縮小落回頁首 -->
      <img src="/images/gallery/logo.svg" alt="" width="358" height="202" class="gh-logo">

      <span class="gh-word gh-word-top" aria-hidden="true">
        <!-- 換字時整個元件重掛，掃光因此每次都從頭跑一次：字出現 → 掃一道光 → 停 → 換下一個字。
             底色刻意壓到 86%，高光才有對比可掃；純白掃純白等於看不見 -->
        <Transition name="gh-swap" mode="out-in">
          <ShinyText
            :key="topWord"
            :text="topWord"
            class="gh-word-swap"
            color="rgb(250 247 241 / 86%)"
            shine-color="#ffffff"
            :speed="1.6"
            :delay="1.1"
            :spread="110"
          />
        </Transition>
      </span>
      <span class="gh-word gh-word-left" aria-hidden="true">{{ hero.words.left }}</span>
      <span class="gh-word gh-word-right" aria-hidden="true">{{ hero.words.right }}</span>
      <span class="gh-word gh-word-bottom" aria-hidden="true">{{ hero.words.bottom }}</span>

      <p class="gh-sign">
        {{ hero.names }}<span class="gh-dot" aria-hidden="true">·</span>{{ hero.date }}
      </p>

      <div class="gh-count">
        <GalleryCountdown :target="hero.weddingAt" :married-label="hero.marriedLabel" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.gh-root {
  position: relative;
  min-height: 100dvh;
  padding: var(--gallery-frame, 16px);
  background: var(--color-paper);
}

.gh-frame {
  /* 四個字共用的尺規：聚合時的相對位置全部以它為單位，字級不同也不會歪掉 */
  --word-size: clamp(2.25rem, 7vw, 6rem);

  /* 字樣（logo.svg，字形 349.77×194.02、畫布四邊各留 4 單位＝357.77×202.02，寬高比 1.77）的落點與畫布高度抽成變數：
     上方那個大字要靠這兩個值算出自己不得越過的上界，見 .gh-word-top。
     2026-09-17 換成新人重畫的字樣：多了一道掃到字底下的長底線，比例從 2.82 變成 1.8（同寬會高出一半）。
     寬度照「字母的高度跟原本一樣」換算——字母佔新字樣高度的 74%：原本 138px 寬時字高 49px → 新的總高 66px → 寬 120px；
     手機 88px 寬時字高 31px → 總高 42px → 寬 76px */
  --logo-w: clamp(76px, 9.5vw, 120px);
  --logo-top: clamp(14px, 3vh, 34px);
  --logo-bottom: calc(var(--logo-top) + var(--logo-w) / 1.77);
  --frame-h: calc(100dvh - var(--gallery-frame, 16px) * 2);

  /* 捲動分兩段：先聚合（spread 1→0），再整組上滑（rise 0→1） */
  --spread: clamp(0, calc(1 - var(--hp, 0) / 0.55), 1);
  --rise: clamp(0, calc((var(--hp, 0) - 0.55) / 0.45), 1);

  position: relative;
  min-height: var(--frame-h);
  overflow: hidden;
  /* 外框為 0 時圓角會在四角露出頁面底色，所以圓角跟著外框走 */
  border-radius: var(--gallery-frame, 0px);
  background: var(--color-cream);
}

.gh-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 裁切時多留上緣、少留下緣，人物因此落在畫面偏下的位置——
     視窗越扁裁得越多，這正是上方大字會壓到臉的情境，靠這個把人推開 */
  object-position: center 22%;
  /* 往下捲時照片微微推近，比整張定住有空氣感；放大不會露出邊 */
  transform: scale(calc(1 + var(--hp, 0) * 0.06));
}

/* 上下各一道墨色漸層：托住四邊的白字；上緣稍重，大字萬一落在亮處也讀得到 */
.gh-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom, rgb(17 17 17 / 44%), transparent 34%),
    linear-gradient(to top, rgb(17 17 17 / 62%), transparent 58%);
}

/* 深色墨稿的字樣壓在照片上會看不見，轉成紙白 */
.gh-logo {
  position: absolute;
  left: 50%;
  top: var(--logo-top);
  width: var(--logo-w);
  height: auto;
  transform: translateX(-50%) translateY(calc(var(--hp, 0) * -14vh));
  filter: brightness(0) invert(1);
  opacity: calc(0.9 - var(--hp, 0) * 2);
}

/* ── 四邊大字 ──
   四個字都以畫面正中央為原點，再用 --fx/--fy 推到四邊。
   spread 由 1 收到 0 時，它們從四邊回到 --cx/--cy 的聚合位置（疊成一行標語），
   接著 rise 帶整組往上滑出。 */
.gh-word {
  position: absolute;
  left: 50%;
  top: 50%;
  font-family: var(--font-display);
  font-size: var(--word-size);
  line-height: 1;
  font-weight: 400;
  color: var(--color-paper);
  text-shadow: 0 2px 24px rgb(17 17 17 / 32%);
  white-space: nowrap;
  pointer-events: none;
  transform:
    translate(-50%, -50%)
    translate(
      calc(var(--cx, 0px) + (var(--fx, 0px) - var(--cx, 0px)) * var(--spread)),
      calc(var(--cy, 0px) + (var(--fy, 0px) - var(--cy, 0px)) * var(--spread))
    )
    translate(0, calc(var(--rise) * -54vh));
  opacity: calc(1 - var(--rise));
}

/* 上方這個字最容易撞到人物，比其他三邊小一號 */
.gh-word-top {
  --fx: 0px;

  /* -36vh 是設計稿的落點，但字樣的位置幾乎是固定 px：視窗越扁，這個字就越往字樣頭上爬。
     用 max() 給它一條下界（值越大＝越靠下），字樣底部再讓 14px 出來。
     0.41em＝字上緣到盒中心的距離（Shine 的 h 是四個字裡最高的一筆） */
  --fy: max(-36vh, calc(var(--logo-bottom) + 14px + 0.41em - var(--frame-h) / 2));
  --cx: 0px;
  --cy: calc(var(--word-size) * -1.05);

  font-size: calc(var(--word-size) * 0.88);
}

.gh-word-left {
  --fx: -40vw;
  --fy: 0px;
  --cx: calc(var(--word-size) * -1.45);
  --cy: 0px;
}

/* 右緣讓給倒數條，推得比左邊少一點 */
.gh-word-right {
  --fx: 35vw;
  --fy: 0px;
  --cx: calc(var(--word-size) * 0.95);
  --cy: 0px;
}

.gh-word-bottom {
  --fx: 0px;

  /* 35vh 是設計稿的落點，但署名是貼在框底的固定 px：手機為了讓 Safari 的工具列，署名往上抬到 78px，
     這個字用 vh 往下推就疊到署名上（新人 09-16 iPhone 實測：Love 壓在 Alex & Lele 上）。
     用 min() 給它一條上界（值越小＝越靠上）：字的中心離框底至少「署名底距 ＋ 署名一行高 ＋ 12px 間距 ＋ 半個字高」。
     桌機 35vh 仍是較小的那個，位置不變；做法對齊上方那個字用 max() 擋字樣的那條界線 */
  --fy: min(35vh, calc(var(--frame-h) / 2 - var(--sign-bottom) - var(--text-body-l) * 1.7 - 12px - 0.5em));
  --cx: 0px;
  --cy: calc(var(--word-size) * 1.05);
}

.gh-word-swap {
  display: inline-block;

  /* 掃光是 background-clip: text，而背景只畫在元素盒內。
     line-height: 1 的盒子裝不下 Happy 的 p／y 下伸筆畫（要 1.201em），
     descender 會落在盒外拿不到顏色＝看起來被切掉。1.5 是給備援字型的餘裕。
     盒子撐高不會移動文字：baseline 到盒中心的距離只跟字型 metrics 有關 */
  line-height: 1.5;
}

/* 輪換：上一個字往上淡出、下一個字自下方遞上 */
.gh-swap-enter-active,
.gh-swap-leave-active {
  transition:
    transform 400ms var(--ease-emphasized),
    opacity 250ms var(--ease-standard);
}

.gh-swap-enter-from {
  opacity: 0;
  transform: translateY(0.38em);
}

.gh-swap-leave-to {
  opacity: 0;
  transform: translateY(-0.38em);
}

/* 署名置中、落在「Love」正下方，跟四邊的大字同一條中軸（新人 09-16：靠左角落看起來怪）。
   手機的底部導覽膠囊是滿版的，署名要讓到它上面；底距抽成變數，上面那個「Love」靠它算自己不得越過的界線 */
.gh-frame {
  --sign-bottom: 78px;
}
.gh-sign {
  position: absolute;
  left: 50%;
  bottom: var(--sign-bottom);
  display: flex;
  align-items: center;
  white-space: nowrap;
  transform: translateX(-50%);
  font-family: var(--font-display);
  font-size: var(--text-body-l);
  letter-spacing: 0.06em;
  color: var(--color-paper);
  opacity: calc(0.9 - var(--hp, 0));
}

.gh-dot {
  margin-inline: 10px;
  opacity: 0.6;
}

/* 倒數：貼右緣，往下捲時淡出 */
.gh-count {
  position: absolute;
  inset: 0 clamp(6px, 1.4vw, 18px) 0 auto;
  width: clamp(34px, 5vw, 52px);
  opacity: calc(1 - var(--hp, 0) * 1.6);
}

@media (min-width: 640px) {
  .gh-frame {
    --sign-bottom: clamp(16px, 3vh, 28px);
  }
}
</style>
