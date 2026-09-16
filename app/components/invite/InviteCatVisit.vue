<!-- app/components/invite/InviteCatVisit.vue — 點桌上的貓掌印，貓就走進桌面
     不換場、不蓋畫面：牠是桌上多出來的一個物件，不是蓋在桌上的一層 UI。
     三隻都落在右下角同一塊空白（桌機 x 76~100／y 50~100，是整張稿唯一沒有物件的區域，
     只有緞帶斜穿而過且層級在底下），不各自出現在自己的腳印旁——
     Healthy 的腳印在桌機的正中央，就地出現會整隻蓋掉信封與蕾絲愛心卡那個主焦點。
     出場順序是敘事的一部分：腳印一步一步走進來 → 貓落定 → 紙條才飄下來。
     幾何（落點、紙條位置、腳印路徑）是這個構圖專屬的，故留在本檔；
     跟著各隻貓變動的只有體型與朝向，那兩項在 useInviteScene。 -->
<script setup lang="ts">
import type { SceneCat } from '~/types/invite'

const props = defineProps<{
  /** null＝目前沒有貓在桌上 */
  cat: SceneCat | null
  /** 進場腳印素材，三隻共用 */
  trail: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const photoStyle = computed(() => ({
  '--cat-w': `${props.cat?.w ?? 0}cqw`,
  '--cat-mw': `${props.cat?.mobileW ?? 0}cqw`,
  '--cat-flip': props.cat?.facesRight ? '-1' : '1',
}))
</script>

<template>
  <div class="cat-visit">
    <!-- 常駐的播報區：這一層不是 dialog，螢幕閱讀器不會自動朗讀新出現的內容，
         所以留一個一直掛著的 live region（掛著才播得出來，跟著內容一起掛就太晚了） -->
    <p class="sr-only" aria-live="polite">
      {{ cat ? `${cat.name} 走到桌上來了` : '' }}
    </p>

    <Transition name="visit" mode="out-in">
      <div v-if="cat" :key="cat.key" class="visit">
        <!-- 腳印路徑：從右下角外面一步步走進來。三張素材輪流用＋左右鏡射，
             不然三步會是同一隻腳蓋三次 -->
        <img
          v-for="(src, i) in trail"
          :key="src"
          :src="src"
          alt=""
          aria-hidden="true"
          class="visit-paw"
          :class="`visit-paw-${i + 1}`"
          :style="{ '--i': i }"
          decoding="async"
        >

        <img
          :src="cat.photo"
          :alt="`貓咪 ${cat.name}`"
          class="visit-cat"
          :style="photoStyle"
          decoding="async"
        >

        <div class="visit-note">
          <button type="button" class="visit-close" :aria-label="`請 ${cat.name} 回去休息`" @click="emit('close')">
            <span aria-hidden="true">✕</span>
          </button>
          <p class="visit-name">
            {{ cat.name }} ♡
          </p>
          <p class="visit-role">
            <span v-for="line in cat.role" :key="line">{{ line }}</span>
          </p>
          <p class="visit-lines">
            <span v-for="line in cat.lines" :key="line">{{ line }}</span>
          </p>
          <p class="visit-closing">
            {{ cat.closing }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 舞台大小的透明圖層。container-type 讓底下所有尺寸都能用 cqw 寫成「佔舞台寬的百分比」，
   舞台本身是跟著視窗高度等比縮放的，貓與紙條才不會在小視窗變成巨物。
   注意 container-type 只含 layout／style／inline-size，不含 paint，不會裁掉內容。 */
.cat-visit {
  position: absolute;
  inset: 0;
  z-index: 45;
  container-type: inline-size;
  pointer-events: none;
}

.visit {
  position: absolute;
  inset: 0;
}

/* ── 腳印：錨在右下角，一步比一步往畫面內側走 ── */
.visit-paw {
  position: absolute;
  width: 10cqw;
  height: auto;
  opacity: 0;
  animation: visit-step 420ms var(--ease-emphasized) calc(var(--i) * 140ms) both;
}

.visit-paw-1 {
  right: 2%;
  bottom: -2%;
  rotate: 20deg;
}

/* 第二步是鏡射的，keyframes 得把 -1 一路帶著走，
   否則動畫會把 scale 整個蓋掉、三步變成同一隻腳印重複三次 */
.visit-paw-2 {
  right: 15%;
  bottom: 2%;
  rotate: 6deg;
  scale: -1 1;
  animation-name: visit-step-flipped;
}

.visit-paw-3 {
  right: 29%;
  bottom: 6%;
  rotate: 16deg;
}

@keyframes visit-step {
  from {
    opacity: 0;
    scale: 0.7;
  }

  to {
    opacity: 0.9;
  }
}

@keyframes visit-step-flipped {
  from {
    opacity: 0;
    scale: -0.7 0.7;
  }

  to {
    opacity: 0.9;
    scale: -1 1;
  }
}

/* ── 貓：右下角，底邊離桌緣一段距離，腳印才留得住位置 ── */
/* 以右下角為錨點：三隻的姿勢與長寬比都不同，用中心點定位會各自跑掉，
   錨在「身體壓在桌面上的那一角」才會像同一隻貓走到同一個位置趴下 */
.visit-cat {
  position: absolute;
  right: 0;
  bottom: 3%;
  width: var(--cat-mw);
  height: auto;
  scale: var(--cat-flip) 1;
  filter: drop-shadow(0 14px 22px rgba(17, 17, 17, 0.16));
  /* 擋住底下的點擊：手機版貓身正好壓在「看婚紗相簿」的拍立得上，
     不擋的話點貓會直接跳去相簿頁。牠在 .cat-visit 內，故點下去也不會被判成「點畫面別處」而收起 */
  pointer-events: auto;
  animation: visit-arrive 620ms var(--ease-emphasized) 420ms both;
}

@keyframes visit-arrive {
  from {
    opacity: 0;
    translate: 6% 16%;
  }

  to {
    opacity: 1;
    translate: 0 0;
  }
}

/* ── 紙條：貓上方那塊空白，微傾、用愛心迴紋針別著 ── */
.visit-note {
  position: absolute;
  right: 1.5%;
  bottom: 35.4%;
  width: 96.9cqw;
  padding: 1.25em 1.3em 1.15em;
  border-radius: 2px;
  background: url("/images/invite/note-paper.webp") center / cover;
  box-shadow:
    0 1px 1px rgba(17, 17, 17, 0.06),
    0 12px 26px rgba(17, 17, 17, 0.12);
  font-family: var(--font-hand);
  font-size: 5.56cqw;
  line-height: 1.6;
  color: var(--color-ink-700);
  text-align: center;
  rotate: -3deg;
  pointer-events: auto;
  animation: visit-drop 520ms var(--ease-emphasized) 820ms both;
}

@keyframes visit-drop {
  from {
    opacity: 0;
    translate: 0 -6%;
    rotate: -9deg;
  }

  to {
    opacity: 1;
    translate: 0 0;
    rotate: -3deg;
  }
}

/* 愛心迴紋針：別在左上角，一半探出紙外才像真的夾住 */
.visit-note::before {
  content: "";
  position: absolute;
  left: 8%;
  top: -1.55em;
  width: 1.85em;
  height: 2.92em;
  background: url("/images/invite/clip-heart.webp") center / contain no-repeat;
  rotate: -8deg;
  filter: drop-shadow(0 3px 4px rgba(17, 17, 17, 0.18));
}

.visit-name {
  font-size: 1.5em;
  line-height: 1.2;
  color: var(--color-gold-deep);
}

.visit-role,
.visit-lines,
.visit-closing {
  display: grid;
}

.visit-role {
  margin-top: 0.3em;
}

.visit-lines {
  margin-top: 0.75em;
}

.visit-closing {
  margin-top: 0.75em;
  color: var(--color-gold-deep);
}

/* 收起鈕：不是 dialog 就沒有遮罩可以點，出口要自己給。
   壓在紙條右上角、低調但摸得到（44px 由 ::before 補，視覺維持小圈） */
.visit-close {
  position: absolute;
  right: 0.5em;
  top: 0.4em;
  display: grid;
  place-items: center;
  width: 1.6em;
  height: 1.6em;
  border-radius: 50%;
  font-size: 0.9em;
  line-height: 1;
  color: var(--color-ink-300);
  cursor: pointer;
  transition: color 200ms var(--ease-standard), background-color 200ms var(--ease-standard);
}

.visit-close::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100%, 44px);
  height: max(100%, 44px);
  transform: translate(-50%, -50%);
}

.visit-close:hover,
.visit-close:focus-visible {
  background: rgba(17, 17, 17, 0.06);
  color: var(--color-ink-700);
}

.visit-close:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
}

/* ── 桌機：舞台變寬，所有相對尺寸跟著收 ── */
@media (min-width: 1024px) {
  .visit-paw {
    width: 3.4cqw;
  }

  .visit-paw-1 {
    right: 1%;
    bottom: -1%;
  }

  .visit-paw-2 {
    right: 8%;
    bottom: 2.5%;
  }

  .visit-paw-3 {
    right: 15%;
    bottom: 5.5%;
  }

  .visit-cat {
    width: var(--cat-w);
    bottom: 7%;
  }

  .visit-note {
    right: 23.2%;
    bottom: 44.5%;
    width: 33.3cqw;
    font-size: 2cqw;
    line-height: 1.6;
  }
}

/* ── 離場：整層一起淡出，換另一隻時先收乾淨再演下一隻（mode="out-in"） ── */
.visit-leave-active {
  animation: visit-out 240ms var(--ease-standard) both;
}

@keyframes visit-out {
  to {
    opacity: 0;
    translate: 0 2%;
  }
}
</style>
