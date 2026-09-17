<!-- app/components/story/StoryBook.vue — 七頁故事之後的一本書：五個跨頁（左右各一面），像書頁繞書脊翻過去。
     翻頁的進度由 StoryDeck 把 --dp 換算成 progress 傳進來（0…N−1，小數＝翻到一半）：
     桌機捲軸、翻頁按鈕、手機手指拖都能來回刷，這裡不跑任何計時動畫，所以 reduced-motion 不必另外處理（deck 本來就瞬間跳）。
     模型：N 個跨頁有 N−1 張紙，第 k 張紙正面＝跨頁 k 的右面 R_k、背面＝跨頁 k+1 的左面 L_{k+1}。
     這裡**不做 preserve-3d、不做背面**：R_k 與 L_{k+1} 是兩個獨立元素（各在自己的 section 裡），
     各自繞書脊轉互為鏡像的角度（R_k 轉 t×−180°、L_{k+1} 轉 (1−t)×180°），永遠共面；背對讀者的那一面直接 visibility: hidden。
     好處：沒有鏡像文字、沒有 Safari 巢狀 3D 的坑、每個跨頁仍是一個 section（讀屏不會讀到兩份）。
     疊放層在 JS 算（zSheet）：翻過去的在左疊、越晚翻越上；沒翻的在右疊、越早翻越上；正在翻的壓過兩疊。
     只有 0<t<1 的那兩面掛 3D transform：靜止的面是平的，字才清晰、合成層只有正在動的兩面。
     書鋪滿整個視窗（新人 09-14：留紙色邊太突兀）：每一面 50vw×100vh，照片 cover 依 focus 裁。
     滿版照片左右各一張 img，各自 200% 寬、右面往左偏一個頁寬——兩張裁法一樣，接縫在任何視窗比例都連續。
     手機（lg 以下、stacked）：五個跨頁直式疊、各自一屏，往下捲就是翻頁（issue #162）；每一跨的照片鋪滿整屏（cover、構圖點 50% 40%），
     文字面（標題、眉標、內文）疊在照片底部一層墨色薄紗上（StoryBookFace 的 overlay），活字與海邊的小字也一樣壓在底部。
     第一跨是進相簿的門（StoryBookOpener，新人 09-17）：照片是一張圓角卡片從畫面底升上來、一露面就隨捲動撐開，
     升到頂端釘住撐滿、字再疊上去（軌道 1.5 屏），之後四跨照舊。
     2026-09-16 以前手機是一個跨頁＝一整張紙繞左緣翻、紙內兩面上下疊（字在上、照片在下），新人實測要照片滿版、直向翻。
     無 JS（live=false）：五個跨頁直式堆疊、全部看得到。 -->
<script setup lang="ts">
import type { StorySpread } from '~/types/story'

const props = defineProps<{
  spreads: StorySpread[]
  /** 書內進度 0…N−1（小數＝翻到一半），由 StoryDeck 換算 */
  progress: number
  /** 走到過的跨頁數（0＝第一跨已走到；負值＝還沒翻到書） */
  reached: number
  /** JS 已接管；false 時不做 3D、不藏任何東西 */
  live: boolean
  /** 手機的直向翻頁模式（StoryDeck）：五跨直式疊、各自一屏，沒有翻紙、不 inert */
  stacked: boolean
  /** 提前把五跨的照片抓下來（StoryDeck 在走到書前三頁時打開）：捲到才抓會在進到那一跨的瞬間頓一下 */
  warm: boolean
  /** 在整組面板裡的序號（data-panel） */
  index: number
}>()

const emit = defineEmits<{
  /** 手機第一跨的門開了沒（框撐過一半）：StoryDeck 拿去決定右上角開關的顏色 */
  openerOpen: [open: boolean]
}>()

/** 手機第一跨改走 StoryBookOpener：要是「兩面」的跨頁、其中一面是照片（求婚那跨）；不是就照一般的疊法 */
const opener = computed(() => {
  const s = props.spreads[0]
  if (!props.stacked || !s || s.kind !== 'pages')
    return null
  const photo = s.right.kind === 'photo' ? s.right : s.left.kind === 'photo' ? s.left : null
  const copy = s.left.kind === 'copy' ? s.left : s.right.kind === 'copy' ? s.right : null
  return photo ? { photo, lines: copy?.lines ?? [] } : null
})

/** 第 i 跨的照片要不要現在就抓：第一跨一露面就要在，其餘等 warm */
function eagerAt(i: number) {
  return i === 0 || props.warm
}

/** 滿版跨頁的手機版：照片 2880×2048 只用得到中間 1440 那截（390×664 的直式框裁掉左右各四分之一），
 *  另切一張同高、只留中段的 -m.webp（cwebp -crop 720 0 1440 2048）給手機——解碼的像素少一半，進到那一跨才不會頓。
 *  用 <picture> 依寬度切、不用 srcset：-m 是裁切不是縮圖，構圖不同，srcset 讓非 retina 的桌機也可能挑到它 */
const WEBP_EXT = /\.webp$/
function bleedMobile(src: string) {
  return src.replace(WEBP_EXT, '-m.webp')
}
/** 與 StoryDeck 的 DECK_QUERY 同一條分界：這寬度以下是手機（直式框） */
const MOBILE_QUERY = '(max-width: 63.999rem)'

const count = computed(() => props.spreads.length)
/** 目前停在（或最接近）哪一跨：其餘跨頁 inert，鍵盤與讀屏只走得到這一跨 */
const here = computed(() => Math.round(props.progress))

/** 第 k 張紙翻了多少（0 沒翻、1 翻完） */
function turn(k: number) {
  return Math.min(1, Math.max(0, props.progress - k))
}

/** 第 k 張紙的層：翻過去的在左疊、越晚翻越上（1+k）；沒翻的在右疊、越早翻越上（N−1−k）；正在翻的壓過兩疊（N+1）。
 *  左右兩疊不重疊，所以同一組數字可以共用 */
function zSheet(k: number) {
  const t = turn(k)
  if (t >= 1)
    return 1 + k
  if (t <= 0)
    return count.value - 1 - k
  return count.value + 1
}

/** 跨頁 i 的左面屬於第 i−1 張紙（i=0 是底頁，永遠攤平） */
function leftTurn(i: number) {
  return i === 0 ? 1 : turn(i - 1)
}
/** 跨頁 i 的右面屬於第 i 張紙（最後一跨的右面是底頁） */
function rightTurn(i: number) {
  return i === count.value - 1 ? 0 : turn(i)
}

function spreadStyle(i: number) {
  return {
    '--tl': leftTurn(i).toFixed(4),
    '--tr': rightTurn(i).toFixed(4),
    '--zl': i === 0 ? 0 : zSheet(i - 1),
    '--zr': i === count.value - 1 ? 0 : zSheet(i),
  }
}

/** 左面：t 在 0～1 之間才是正在翻；t ≤ 0.5 背對讀者 */
function leftClass(i: number) {
  const t = leftTurn(i)
  return { 'is-turning': t > 0 && t < 1, 'is-away': t <= 0.5 }
}
/** 右面：t ≥ 0.5 背對讀者 */
function rightClass(i: number) {
  const t = rightTurn(i)
  return { 'is-turning': t > 0 && t < 1, 'is-away': t >= 0.5 }
}
/** 滿版跨頁的裁切重心（內容層的 focus）；左右兩面是同一張圖各露一半，兩面都要套同一個值 */
function bleedStyle(s: StorySpread) {
  return s.kind === 'bleed' && s.focus ? { objectPosition: `${s.focus.x}% ${s.focus.y}%` } : undefined
}

/** 哪一面排這一跨的 h2：有文字面就給文字面（看得見的標題），兩面都是照片就給左面（讀屏用） */
function titleSide(s: StorySpread) {
  if (s.kind === 'bleed')
    return 'l'
  return s.left.kind === 'copy' ? 'l' : s.right.kind === 'copy' ? 'r' : 'l'
}
</script>

<template>
  <div class="book-panel relative bg-paper" :class="{ 'is-live': live, 'is-stacked': stacked }" :data-panel="index">
    <div class="book">
      <!-- 桌機翻紙時其餘跨頁 inert（鍵盤與讀屏只走得到這一跨）；手機直式疊，每一跨都在版面上，不 inert -->
      <section
        v-for="(s, i) in spreads"
        :id="`spread-${s.key}`"
        :key="s.key"
        :aria-labelledby="`spread-${s.key}-title`"
        class="spread"
        :class="{ 'is-drawn': reached >= i, 'is-bleed': s.kind === 'bleed', 'is-opener': i === 0 && !!opener }"
        :inert="live && !stacked && here !== i"
        :style="spreadStyle(i)"
      >
        <!-- 手機的第一跨：進相簿的門（框隨捲動撐滿），停點仍是這個 section 的頂端 -->
        <StoryBookOpener
          v-if="i === 0 && opener"
          :photo="opener.photo"
          :lines="opener.lines"
          :title="s.title"
          :title-id="`spread-${s.key}-title`"
          :eager="eagerAt(i)"
          @open="emit('openerOpen', $event)"
        />
        <!-- 滿版跨頁：同一張照片左右各露一半（cover ＋ object-position 0%／100%）；右半純裝飾 -->
        <template v-else-if="s.kind === 'bleed'">
          <div class="page page-l page-photo" :class="leftClass(i)">
            <h2 :id="`spread-${s.key}-title`" class="sr-only">
              {{ s.title }}
            </h2>
            <picture>
              <source :media="MOBILE_QUERY" :srcset="bleedMobile(s.src)">
              <img :src="s.src" :alt="s.alt" :loading="eagerAt(i) ? 'eager' : 'lazy'" decoding="async" class="bleed bleed-l" :style="bleedStyle(s)">
            </picture>
            <!-- 活字疊在照片左下：首屏那組金箔字＋手寫字樣的紙白版，翻到這一跨才起筆。名稱已由 h2 給，這裡不再讀 -->
            <div v-if="s.mark" class="mark-box" aria-hidden="true">
              <StoryFoilMark :text="s.mark.title" variant="paper" class="text-h3 lg:text-h2" />
              <StoryShineMark :label="s.mark.script" variant="paper" :start="reached >= i" :delay="400" class="script" />
            </div>
            <!-- 幾行小字疊在照片左下（海邊那跨）：紙白、字距拉開，走到這一跨才浮出 -->
            <div v-else-if="s.caption" class="caption-box reveal font-serif-tc text-body text-paper lg:text-body-l" aria-hidden="true">
              <p v-for="(line, k) in s.caption" :key="k">
                {{ line }}
              </p>
            </div>
          </div>
          <div class="page page-r page-photo" :class="rightClass(i)" aria-hidden="true">
            <picture>
              <source :media="MOBILE_QUERY" :srcset="bleedMobile(s.src)">
              <img :src="s.src" alt="" :loading="eagerAt(i) ? 'eager' : 'lazy'" decoding="async" class="bleed bleed-r" :style="bleedStyle(s)">
            </picture>
          </div>
        </template>
        <template v-else>
          <StoryBookFace
            :page="s.left"
            :title="s.title"
            :title-id="`spread-${s.key}-title`"
            :with-title="titleSide(s) === 'l'"
            :eager="eagerAt(i)"
            :overlay="stacked"
            class="page page-l"
            :class="[leftClass(i), s.left.kind === 'photo' ? 'page-photo' : 'page-copy']"
          />
          <StoryBookFace
            :page="s.right"
            :title="s.title"
            :title-id="`spread-${s.key}-title`"
            :with-title="titleSide(s) === 'r'"
            :eager="eagerAt(i)"
            :overlay="stacked"
            class="page page-r"
            :class="[rightClass(i), s.right.kind === 'photo' ? 'page-photo' : 'page-copy']"
          />
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ── 無 JS 的終態：跨頁直式堆疊、全部看得到。桌機每跨兩欄（合起來 45:32），手機單欄 ── */
.spread {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.book-panel:not(.is-live) .spread + .spread {
  margin-top: 4rem;
}
.book-panel:not(.is-live) .page-photo {
  aspect-ratio: 45 / 64;
}
.page {
  position: relative;
}
/* 滿版照片：左右各一張，各自兩個頁寬、右面往左偏一個頁寬，兩張的 cover 裁法相同所以接縫連續；面要把超出的那一半裁掉。
   max-width: none 一定要寫：Tailwind 的 preflight 給 img 上了 max-width: 100%，200% 會被壓回一個頁寬、右半就空了 */
.is-bleed .page {
  overflow: hidden;
}
.bleed {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 200%;
  max-width: none;
  height: 100%;
  object-fit: cover;
}
.bleed-r {
  left: -100%;
}
/* 活字：貼在左面左下，寬度照設計稿（字樣約佔一面的六成）。
   一層很淡的投影：紙白字落在亮一點的葉子上（手機縮小後尤其）會糊掉，投影把字托出來；filter 不動畫、只是靜態的描邊 */
.mark-box,
.caption-box {
  position: absolute;
  left: 11%;
  bottom: 8%;
  z-index: 2;
  filter: drop-shadow(0 2px 8px rgb(0 0 0 / 40%));
}
.mark-box {
  width: 64%;
}
.mark-box .script {
  margin-top: -0.75rem;
}
/* 小字：字距拉開到 0.28em（設計稿的排法），行距鬆一點；比烙在圖上的那版小一號（新人 09-14） */
.caption-box {
  left: 8%;
  letter-spacing: 0.28em;
  line-height: 2;
  white-space: nowrap;
}
/* 小字的進場：同文字頁的 .reveal（走到這一跨才浮出） */
.reveal {
  transition:
    opacity 0.6s var(--ease-standard),
    transform 0.6s var(--ease-standard);
  transition-delay: 200ms;
}
.is-live .spread:not(.is-drawn) .reveal {
  opacity: 0;
  transform: translateY(14px);
}
@media (width < 64rem) {
  .spread {
    grid-template-columns: 1fr;
  }
  /* 手機的滿版照片：只用左面那張，鋪滿整面（cover），右半不用了。
     構圖點 50% 40%：人物多在畫面中上段，往上偏一點才不會只裁到沙灘與草地。
     無 JS 時沿用 .page-photo 的 45:64 直式比例 */
  .is-bleed .page-r {
    display: none;
  }
  .is-bleed .bleed-l {
    width: 100%;
    object-position: 50% 40%;
  }
  /* 活字底下的薄紗：照片鋪滿後字會落在亮的沙灘或葉子上，只靠投影托不住；
     下緣 40% 由透明漸深到 45% 的墨，位置在活字（z-index 2）之下、照片之上 */
  .is-bleed .page-l::after {
    content: '';
    position: absolute;
    inset: 60% 0 0;
    z-index: 1;
    background: linear-gradient(to bottom, transparent, rgb(17 17 17 / 45%));
    pointer-events: none;
  }
  /* 手機的字樣放寬一點：金箔字是固定的 em 寬，盒子太窄手寫字反而比它小。
     離底 11%（664 高約 73px）：讓開右下角的「回到最上方」膠囊與左下角的「跳過故事」（issue #162 直向翻頁後這些都釘在視窗底）。
     投影改用 text-shadow、字樣不投影：filter: drop-shadow 在 iOS 上是逐幀重算的合成濾鏡，
     疊在正在進場（opacity／transform 過場）的元素上，進到這一跨的那一秒每一幀都在重算（新人 09-17：照片區會頓）；
     手機底下已有薄紗托字，投影只是描邊，換掉看不出差別 */
  .mark-box {
    left: 6%;
    bottom: 11%;
    width: 70%;
    filter: none;
  }
  .caption-box {
    left: 6%;
    bottom: 11%;
    letter-spacing: 0.2em;
    filter: none;
    text-shadow: 0 2px 8px rgb(0 0 0 / 40%);
  }
  .mark-box .script {
    margin-top: -0.5rem;
  }
}

/* ── 桌機（JS 接管）：書鋪滿整個視窗，每一面各自繞書脊轉 ── */
@media (width >= 64rem) {
  .is-live.book-panel {
    height: 100%;
  }
  .is-live .book {
    position: absolute;
    inset: 0;
  }
  /* section 不能有 transform／opacity／isolation／perspective：各面的 z-index 要跨 section 交錯 */
  .is-live .spread {
    position: absolute;
    inset: 0;
    display: block;
  }
  .is-live .page {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
  }
  .is-live .page-l {
    left: 0;
    transform-origin: 100% 50%;
    z-index: var(--zl);
  }
  .is-live .page-r {
    left: 50%;
    transform-origin: 0 50%;
    z-index: var(--zr);
  }
  /* 用 perspective() 函式不用屬性：屬性只投影直接子元素、放 section 上又各自成 stacking context；
     函式的消失點在各面的 transform-origin（都在書脊中點），同一張紙的兩面投影一致 */
  .is-live .page-l.is-turning {
    transform: perspective(2400px) rotateY(calc((1 - var(--tl)) * 180deg));
    backface-visibility: hidden;
  }
  .is-live .page-r.is-turning {
    transform: perspective(2400px) rotateY(calc(var(--tr) * -180deg));
    backface-visibility: hidden;
  }
  .is-live .page.is-away {
    visibility: hidden;
  }
  /* 沒有書溝、翻動時也沒有陰影（新人 09-14：中間的線不要出現、也不要有陰影）——
     第一版有一道 6% 寬的書脊暗溝與翻動中從自由邊暗下去的漸層，整組拿掉，翻頁只靠透視的形變 */
}

/* ── 手機（JS 接管，直向翻頁 issue #162）：五個跨頁直式疊、各自一屏。
   照片面鋪滿整屏、文字面疊在底部（字色與薄紗在 StoryBookFace 的 overlay）；沒有翻紙——翻頁就是往下捲，
   停點的 snap 由 StoryDeck 掛在每個 .spread 上。用 svh 不用 dvh（工具列收合時 dvh 會變，頁高會抖） ── */
@media (width < 64rem) {
  .is-stacked .spread {
    position: relative;
    display: block;
    min-height: 100svh;
    overflow: hidden;
    background: var(--color-paper);
  }
  /* 第一跨是門：高度由 StoryBookOpener 的軌道決定，overflow 不能 hidden——
     overflow 非 visible 的祖先會變成 sticky 的參考框，舞台就釘不住 */
  .is-stacked .spread.is-opener {
    min-height: auto;
    overflow: visible;
  }
  .is-stacked .page-photo {
    position: absolute;
    inset: 0;
  }
  /* 文字面在照片之上（左面是文字時 DOM 在照片前面，靠 z-index 壓上去） */
  .is-stacked .page-copy {
    position: absolute;
    inset: auto 0 0;
    z-index: 1;
  }
}
</style>
