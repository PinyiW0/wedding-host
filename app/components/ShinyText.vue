<!-- app/components/ShinyText.vue -->
<script setup lang="ts">
// 掃光文字（Vue Bits ShinyText 移植）：一道比底色亮的高光橫掃過文字。
// 移植時為配合本專案調整四處：
//   1. prefers-reduced-motion 時整個不套用漸層，退回純文字（Motion 走 JS 動畫，繞得過 main.css 的 CSS guard；
//      只停動畫的話高光會停在半路，字會比旁邊的兄弟元素暗一階，看起來像壞掉）
//   2. 拿掉原版的 className prop —— Vue 的 attribute fallthrough 本來就會把外部 class 併進根元素
//   3. color/shineColor 直接吃 CSS 變數（gradient 內可用 var()），呼叫端才不必把設計 token 硬寫成 hex
//   4. 方法改 function 宣告（專案慣例）
//   5. Motion 的元素標籤 prop 是 as 不是 tag —— 原始碼寫的 tag="span" 在 motion-v 2.x 會整個渲染不出來
//
// template 內不寫註解：dev 模式下註解也算節點，會讓本元件變成多根，
// 外層的 <Transition> 只收單一根，整個會渲染不出來（而且 class 也無處 fallthrough）。
// reduced-motion 時不給 style，字就退回繼承父層顏色，不必拆成 v-if／v-else 兩個根。
//
// 注意：本效果用的是 background-clip: text，與 creative-direction §3「禁 gradient text」同一個機制。
// 該條禁的是「彩色漸層字」那種 AI 模板味；這裡是同色系的高光掃過（底色→白→底色），
// 由新人指定套用在相簿首屏輪換的那個大字上，屬刻意例外，見 docs/gallery-landing-assets.md。
import { Motion, useAnimationFrame, useMotionValue, useTransform } from 'motion-v'

const props = withDefaults(defineProps<{
  text: string
  /** 文字底色（暗於高光才看得出掃光） */
  color?: string
  /** 高光顏色 */
  shineColor?: string
  /** 一次掃光的秒數 */
  speed?: number
  /** 兩次掃光之間的停頓秒數 */
  delay?: number
  /** 漸層角度 */
  spread?: number
  /** true＝來回掃，false＝單向循環 */
  yoyo?: boolean
  pauseOnHover?: boolean
  direction?: 'left' | 'right'
  disabled?: boolean
}>(), {
  color: '#b5b5b5',
  shineColor: '#ffffff',
  speed: 2,
  delay: 0,
  spread: 120,
  yoyo: false,
  pauseOnHover: false,
  direction: 'left',
  disabled: false,
})

const isPaused = ref(false)
// SSR 一律 false：動效只在 mounted 後依使用者環境決定，首渲染兩端一致
const reduceMotion = ref(false)
const progress = useMotionValue(0)

let elapsed = 0
let lastTime: number | null = null

const animationMs = computed(() => props.speed * 1000)
const delayMs = computed(() => props.delay * 1000)
const sign = computed(() => (props.direction === 'left' ? 1 : -1))
const isOff = computed(() => props.disabled || reduceMotion.value)

useAnimationFrame((time) => {
  if (isOff.value || isPaused.value) {
    lastTime = null
    return
  }
  if (lastTime === null) {
    lastTime = time
    return
  }
  elapsed += time - lastTime
  lastTime = time

  const cycle = animationMs.value + delayMs.value
  // 0→100 是高光從一側掃到另一側；停頓期間停在終點（高光已離開畫面）
  if (props.yoyo) {
    const t = elapsed % (cycle * 2)
    if (t < animationMs.value)
      setProgress((t / animationMs.value) * 100)
    else if (t < cycle)
      setProgress(100)
    else if (t < cycle + animationMs.value)
      setProgress(100 - ((t - cycle) / animationMs.value) * 100)
    else
      setProgress(0)
  }
  else {
    const t = elapsed % cycle
    setProgress(t < animationMs.value ? (t / animationMs.value) * 100 : 100)
  }
})

/** direction 決定掃光從哪一端進來：right 時把進度整條翻過來 */
function setProgress(p: number) {
  progress.set(sign.value === 1 ? p : 100 - p)
}

watch(() => props.direction, () => {
  elapsed = 0
  progress.set(0)
})

const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`)

const gradientStyle = computed(() => ({
  backgroundImage: `linear-gradient(${props.spread}deg, ${props.color} 0%, ${props.color} 35%, ${props.shineColor} 50%, ${props.color} 65%, ${props.color} 100%)`,
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}))

function onEnter() {
  if (props.pauseOnHover)
    isPaused.value = true
}

function onLeave() {
  if (props.pauseOnHover)
    isPaused.value = false
}

onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>

<template>
  <Motion
    as="span"
    class="inline-block"
    :style="isOff ? undefined : { ...gradientStyle, backgroundPosition }"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    {{ text }}
  </Motion>
</template>
