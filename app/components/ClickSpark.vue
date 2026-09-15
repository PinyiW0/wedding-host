<!-- app/components/ClickSpark.vue -->
<script setup lang="ts">
// 點擊火花（Vue Bits ClickSpark 移植）：每次點擊在指標處炸開一圈短線，並飄起一顆小愛心。
// 移植時為配合本專案調整五處：
//   1. 不再用 <div class="relative w-full h-full"> 包住內容 —— 那個 h-full 套到既有版面上會塌掉。
//      改成 position: fixed 的覆蓋層＋監聽 window，對版面零影響、也不必逐頁包一層
//   2. rAF 只在「畫面上還有東西」時跑 —— 原版是永遠掛著的無限迴圈，公開頁常駐會一直吵醒合成器
//   3. prefers-reduced-motion 時完全不產生火花（canvas 走 JS 動畫，繞得過 main.css 的 CSS guard）
//   4. 依 devicePixelRatio 放大 backing store，retina 上線條才不會糊
//   5. 顏色從 @theme token 讀（canvas 沒有 class 可用），不寫死色碼
// 小愛心是本專案自己加的（新人要求），原版只有火花。

const props = withDefaults(defineProps<{
  /** 火花顏色；留空＝取 --color-gold */
  sparkColor?: string
  /** 每道火花的線長（px） */
  sparkSize?: number
  /** 火花飛出的距離（px） */
  sparkRadius?: number
  /** 一次點擊放幾道 */
  sparkCount?: number
  /** 火花動畫時長（ms） */
  duration?: number
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  /** 愛心顏色；留空＝取 --color-gold-deep */
  heartColor?: string
  /** 愛心字級（px） */
  heartSize?: number
  /** 愛心往上飄的距離（px） */
  heartRise?: number
  /** 愛心動畫時長（ms） */
  heartDuration?: number
}>(), {
  sparkColor: '',
  sparkSize: 9,
  sparkRadius: 17,
  sparkCount: 8,
  duration: 420,
  easing: 'ease-out',
  heartColor: '',
  heartSize: 15,
  heartRise: 46,
  heartDuration: 900,
})

interface Spark {
  x: number
  y: number
  angle: number
  start: number
}

interface Heart {
  x: number
  y: number
  /** 左右輕晃的相位，讓每顆愛心的飄法不一樣 */
  phase: number
  size: number
  start: number
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')
const sparks: Spark[] = []
const hearts: Heart[] = []

let ctx: CanvasRenderingContext2D | null = null
let frame = 0
let sparkInk = '#B8965A'
let heartInk = '#9A7B43'

function ease(t: number): number {
  switch (props.easing) {
    case 'linear':
      return t
    case 'ease-in':
      return t * t
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    default:
      return t * (2 - t)
  }
}

/** 依 DPR 放大 backing store；CSS 尺寸仍是視窗大小，所以繪圖座標＝clientX/Y */
function resize() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function draw(now: number) {
  const canvas = canvasRef.value
  if (!ctx || !canvas) {
    frame = 0
    return
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 火花：從中心往外飛，線段同時縮短，看起來像被甩出去
  ctx.lineWidth = 2
  ctx.strokeStyle = sparkInk
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]!
    const t = (now - s.start) / props.duration
    if (t >= 1) {
      sparks.splice(i, 1)
      continue
    }
    const e = ease(t)
    const dist = e * props.sparkRadius
    const len = props.sparkSize * (1 - e)
    const cos = Math.cos(s.angle)
    const sin = Math.sin(s.angle)
    ctx.globalAlpha = 1 - e
    ctx.beginPath()
    ctx.moveTo(s.x + dist * cos, s.y + dist * sin)
    ctx.lineTo(s.x + (dist + len) * cos, s.y + (dist + len) * sin)
    ctx.stroke()
  }

  // 愛心：往上飄、左右輕晃，前三成淡入後淡出
  ctx.fillStyle = heartInk
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i]!
    const t = (now - h.start) / props.heartDuration
    if (t >= 1) {
      hearts.splice(i, 1)
      continue
    }
    ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7
    ctx.font = `${h.size * (0.7 + t * 0.5)}px serif`
    ctx.fillText('♥', h.x + Math.sin(t * Math.PI * 2 + h.phase) * 7, h.y - t * props.heartRise)
  }

  ctx.globalAlpha = 1
  // 都演完就收掉迴圈，不常駐佔著每一幀
  frame = sparks.length || hearts.length ? requestAnimationFrame(draw) : 0
}

function onPointerDown(event: PointerEvent) {
  // 只認主鍵／單指；右鍵與多指手勢不放火花
  if (!event.isPrimary || event.button !== 0)
    return
  const now = performance.now()
  const { clientX: x, clientY: y } = event
  for (let i = 0; i < props.sparkCount; i++)
    sparks.push({ x, y, angle: (Math.PI * 2 * i) / props.sparkCount, start: now })
  hearts.push({ x, y, phase: Math.random() * Math.PI * 2, size: props.heartSize, start: now })
  if (!frame)
    frame = requestAnimationFrame(draw)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  const root = getComputedStyle(document.documentElement)
  sparkInk = props.sparkColor || root.getPropertyValue('--color-gold').trim() || sparkInk
  heartInk = props.heartColor || root.getPropertyValue('--color-gold-deep').trim() || heartInk
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointerdown', onPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerdown', onPointerDown)
  if (frame)
    cancelAnimationFrame(frame)
})
</script>

<template>
  <canvas ref="canvasRef" class="cs-canvas" aria-hidden="true" />
</template>

<style scoped>
/* 純裝飾：不擋任何點擊，也不進 accessible tree。
   z 壓在最上層是刻意的——火花要跟著指標出現在任何東西之上（含 modal 與 toast） */
.cs-canvas {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
