<!-- app/components/invite/InviteStage.vue — 入口頁舞台
     維持設計稿比例的畫布（桌機 1440×1024／手機 390×844），物件以百分比座標散落其上。
     負責兩件事：滑鼠視差（寫 CSS var 給子物件讀）與動效總開關（reduced-motion／無精準指標時關閉）。 -->
<script setup lang="ts">
import type { SceneBackground, SceneCat, SceneIntro, SceneItem, SceneMusic } from '~/types/invite'

const props = defineProps<{
  background: SceneBackground
  intro: SceneIntro
  cats: SceneCat[]
  catTrail: string[]
  items: SceneItem[]
  music: SceneMusic
}>()

/** 視差最大位移（px，depth=1 時）——低振幅，只做空氣感不做眩目 */
const PARALLAX_PX = 14
/** 開場信封溶出 950ms ＋ 100ms 空景喘息；桌面要等這段演完才開始，
    不然封蠟信封還在畫面上、桌上的東西就已經浮出來了 */
const INTRO_EXIT_MS = 1050

const stageRef = ref<HTMLElement | null>(null)
const audioRef = ref<HTMLAudioElement>()
// SSR 一律 false：動效只在 mounted 後依使用者環境開啟，首渲染兩端一致
const floatEnabled = ref(false)
const parallaxEnabled = ref(false)
const isMusicPlaying = ref(false)

// intro＝等使用者點信封；opening＝信封正在溶出、桌面已經開始演；scene＝開場層拆掉
const phase = ref<'intro' | 'opening' | 'scene'>('intro')

const activeCatKey = ref<string | null>(null)
const activeCat = computed(
  () => props.cats.find(c => c.key === activeCatKey.value) ?? null,
)

let introTimer: ReturnType<typeof setTimeout> | undefined
let motionQuery: MediaQueryList | null = null
let pointerQuery: MediaQueryList | null = null
let frame = 0
let pending: { x: number, y: number } | null = null

async function tryPlayMusic() {
  const audio = audioRef.value
  if (!audio || isMusicPlaying.value)
    return
  try {
    await audio.play()
    isMusicPlaying.value = true
  }
  catch {
    isMusicPlaying.value = false
  }
}

function pauseMusic() {
  audioRef.value?.pause()
  isMusicPlaying.value = false
}

function toggleMusic() {
  if (isMusicPlaying.value)
    pauseMusic()
  else tryPlayMusic()
}

// 瀏覽器多半擋非使用者手勢觸發的有聲自動播放，故失敗時退化為「等使用者第一次點擊」再補播。
// 用 click（非 pointerdown）+ capture + once：同一個 click 的 capture 階段與金唱片自身的
// bubble 階段 handler 屬於同一次同步 dispatch，中間不會有 microtask 插入，
// 兩者不會搶著切換播放狀態（點金唱片的第一下不會播了又立刻被判定成「使用者要暫停」）。
function handleFirstInteraction() {
  tryPlayMusic()
}

// 桌面的進場動畫在開場期間是暫停的（見下方 .is-waiting），離場演完才放行。
// 音樂不必在這裡起播：window 上那個 once + capture 的 click 監聽會接到這一下點擊。
function enterScene() {
  if (phase.value !== 'intro')
    return
  phase.value = 'opening'
  // reduce 模式下離場動畫被全域 guard 壓成 0.01ms，還等 1 秒會變成盯著一張空白紙
  introTimer = setTimeout(() => {
    phase.value = 'scene'
  }, motionQuery?.matches ? 0 : INTRO_EXIT_MS)
}

// 再點一次同一個腳印＝請牠回去休息（腳印本身就是開關，不用另外找出口）
function openCat(key: string) {
  activeCatKey.value = activeCatKey.value === key ? null : key
}

// 貓不是 modal，沒有遮罩可以點、也沒有內建的 Esc，兩個出口都要自己補
function onWindowPointerDown(event: PointerEvent) {
  if (!activeCatKey.value)
    return
  const target = event.target as Element | null
  // 點在貓／紙條上不收；點在別的腳印上也不收，交給那個腳印自己的 click 決定換誰
  if (target?.closest('.cat-visit, .si-cat'))
    return
  activeCatKey.value = null
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && activeCatKey.value)
    activeCatKey.value = null
}

function writeShift(x: number, y: number) {
  const el = stageRef.value
  if (!el)
    return
  el.style.setProperty('--px', `${x.toFixed(2)}px`)
  el.style.setProperty('--py', `${y.toFixed(2)}px`)
}

function applyParallax() {
  frame = 0
  if (!pending)
    return
  // 反向位移：滑鼠往右，物件往左，做出「隔著空氣看桌面」的深度
  writeShift(-pending.x * PARALLAX_PX, -pending.y * PARALLAX_PX)
}

function onPointerMove(event: PointerEvent) {
  const el = stageRef.value
  if (!parallaxEnabled.value || !el)
    return
  const rect = el.getBoundingClientRect()
  pending = {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
  }
  if (!frame)
    frame = requestAnimationFrame(applyParallax)
}

function updateMotion() {
  const reduced = Boolean(motionQuery?.matches)
  floatEnabled.value = !reduced
  parallaxEnabled.value = !reduced && Boolean(pointerQuery?.matches)
  if (!parallaxEnabled.value) {
    pending = null
    writeShift(0, 0)
  }
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  // 觸控裝置沒有可追蹤的指標，視差改以持續漂浮代替（不做陀螺儀：iOS 需權限彈窗，會毀掉開場）
  pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  updateMotion()
  motionQuery.addEventListener('change', updateMotion)
  pointerQuery.addEventListener('change', updateMotion)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onWindowPointerDown)
  window.addEventListener('keydown', onWindowKeydown)

  tryPlayMusic()
  window.addEventListener('click', handleFirstInteraction, { once: true, capture: true })
})

onBeforeUnmount(() => {
  motionQuery?.removeEventListener('change', updateMotion)
  pointerQuery?.removeEventListener('change', updateMotion)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onWindowPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('click', handleFirstInteraction, { capture: true })
  clearTimeout(introTimer)
  if (frame)
    cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="invite-root bg-paper" :class="{ 'is-waiting': phase !== 'scene' }">
    <!-- 背景層：鋪滿視窗，不隨舞台縮放，讓兩側留白也有紙紋與葉影 -->
    <div class="invite-bg" aria-hidden="true">
      <img v-if="background.shadow" :src="background.shadow" alt="" class="bg-shadow" loading="eager">
      <img v-if="background.shadowRight" :src="background.shadowRight" alt="" class="bg-shadow-right" loading="eager">
      <img v-if="background.lace" :src="background.lace" alt="" class="bg-lace" loading="lazy">
    </div>

    <audio ref="audioRef" :src="music.src" loop preload="auto" />

    <!-- 開場期間桌面整片凍在進場動畫第 0 幀（opacity 0），連鍵盤焦點一起收掉 -->
    <div ref="stageRef" class="invite-stage" :inert="phase === 'intro' || undefined">
      <InviteObject
        v-for="item in items"
        :key="item.key"
        :item="item"
        :float-enabled="floatEnabled"
        :is-music-playing="isMusicPlaying"
        :active-cat="activeCatKey"
        @toggle-music="toggleMusic"
        @open-cat="openCat"
      />
      <slot />

      <InviteCatVisit :cat="activeCat" :trail="catTrail" @close="activeCatKey = null" />
    </div>

    <!-- 薄紗：貓出場時把整片背景壓淡一階，貓與紙條才不會淹在滿版的花與緞帶裡。
         掛在 invite-root 而不是舞台內：舞台寬度是由視窗高度反推的，視窗比它寬時
         兩側會露出沒被壓淡的紙紋與葉影。同時它也是這一層的遮罩（點擊收起）——
         沒有它的時候「點別處收起」會連底下物件的點擊一起觸發（點信封會一邊收起一邊跳去 /story）。 -->
    <Transition name="veil">
      <div v-if="activeCat" class="cat-veil" aria-hidden="true" @click="activeCatKey = null" />
    </Transition>

    <InviteIntro
      v-if="phase !== 'scene'"
      :intro="intro"
      :opening="phase === 'opening'"
      @open="enterScene"
    />
  </div>
</template>

<style scoped>
.invite-root {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100dvh;
  overflow: hidden;
}

.invite-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 葉影：錨在左上、維持原比例——設計稿的葉影只落在左上角，
   拉伸鋪滿會讓整個畫面蒙上一層灰，中間該留乾淨 */
.bg-shadow {
  position: absolute;
  left: 0;
  top: 0;
  width: 52%;
  min-width: 460px;
  height: auto;
}

/* 右側葉影：只有桌機稿右緣有這片留白，手機版整條右緣都被信封與拍立得佔滿，
   貼上去只會把物件壓灰。以高度撐滿（寬度由比例決定）——素材上下左右都是硬切邊，
   只有貼齊視窗上下緣才不會露出接縫（左側斜邊已在轉檔時羽化掉，見 docs §14）。 */
.bg-shadow-right {
  position: absolute;
  right: 0;
  top: 0;
  display: none;
  height: 100%;
  width: auto;
}

@media (min-width: 1024px) {
  .bg-shadow-right {
    display: block;
  }
}

.bg-lace {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 23%;
  min-width: 240px;
  height: auto;
}

/* 舞台：寬度由視窗高度反推，確保整張桌面永遠完整落在一屏內 */
.invite-stage {
  position: relative;
  width: min(100%, calc(100dvh * 390 / 844));
  aspect-ratio: 390 / 844;
}

@media (min-width: 1024px) {
  .invite-stage {
    width: min(100%, calc(100dvh * 1440 / 1024));
    aspect-ratio: 1440 / 1024;
  }
}

/* 開場「與離場」期間都把桌面凍在進場動畫的第 0 幀（fill: both，第 0 幀就是 opacity 0）。
   凍到離場結束為止：兩幕重疊的話，封蠟信封還在放大、桌上的東西就已經在後面浮出來，很怪。
   用 animation-play-state 而不是 v-if：物件要先掛上去把圖抓完，
   不然點下去之後進場會變成一片空白慢慢補圖。 */
.is-waiting :deep(.si-enter),
.is-waiting :deep(.si-art),
.is-waiting :deep(.invite-tagline) {
  animation-play-state: paused;
}

/* 紙色而非純白：背景底色就是 --color-paper，同色系壓淡才不會浮出一層灰膜。
   z 44＝所有桌面物件（最高 42）之上、貓與紙條那層（.cat-visit z 45）之下 */
.cat-veil {
  position: absolute;
  inset: 0;
  z-index: 44;
  background: rgb(250 247 241 / 62%);
  cursor: pointer;
}

.veil-enter-active,
.veil-leave-active {
  transition: opacity 420ms var(--ease-standard);
}

.veil-enter-from,
.veil-leave-to {
  opacity: 0;
}

/* 群組 hover：熱區在信封前片上，但視覺回饋要整組一起——
   愛心卡從信封裡浮起一截，同組的其他層跟著微亮 */
.invite-stage:has(.si-group-envelope a:hover) :deep(.si-group-envelope .si-art),
.invite-stage:has(.si-group-envelope a:focus-visible) :deep(.si-group-envelope .si-art) {
  --hover: 1.02;
  --lift: -6px;
}
</style>
