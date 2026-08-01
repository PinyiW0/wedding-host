<!-- app/components/TextCursor.vue -->
<script setup lang="ts">
// 游標軌跡（Vue Bits TextCursor 移植）：滑鼠在容器上移動時留下一串符號，停下後由舊到新逐一散去。
// 移植時為配合本專案調整三處：
//   1. 事件源綁到 parentElement —— 容器自身 pointer-events-none，才不會擋住底下的連結
//   2. prefers-reduced-motion 時完全不產生軌跡（Motion 走 JS 動畫，繞得過 main.css 的 CSS guard）
//   3. 軌跡 aria-hidden —— 純裝飾，不進 accessible tree（否則 emoji 會混進連結的可及名稱）
import { Motion } from 'motion-v'

interface TrailItem {
  id: number
  x: number
  y: number
  angle: number
  randomX: number
  randomY: number
  randomRotate: number
}

const props = withDefaults(defineProps<{
  text?: string
  spacing?: number
  followMouseDirection?: boolean
  randomFloat?: boolean
  exitDuration?: number
  removalInterval?: number
  maxPoints?: number
  fontClass?: string
}>(), {
  text: '🧡',
  spacing: 100,
  followMouseDirection: true,
  randomFloat: true,
  exitDuration: 0.5,
  removalInterval: 30,
  maxPoints: 5,
  fontClass: 'text-3xl',
})

const containerRef = useTemplateRef<HTMLDivElement>('containerRef')
const trail = ref<TrailItem[]>([])

let idCounter = 0
let lastMoveAt = 0
let removalTimer: ReturnType<typeof setInterval> | null = null
let eventTarget: HTMLElement | null = null
let reduceMotion = false

function floatOffsets() {
  return props.randomFloat
    ? {
        randomX: Math.random() * 10 - 5,
        randomY: Math.random() * 10 - 5,
        randomRotate: Math.random() * 10 - 5,
      }
    : { randomX: 0, randomY: 0, randomRotate: 0 }
}

function handleMouseMove(event: MouseEvent) {
  if (!containerRef.value)
    return

  const rect = containerRef.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const next = [...trail.value]
  const last = next.at(-1)

  if (!last) {
    next.push({ id: idCounter++, x: mouseX, y: mouseY, angle: 0, ...floatOffsets() })
  }
  else {
    const dx = mouseX - last.x
    const dy = mouseY - last.y
    const distance = Math.hypot(dx, dy)

    if (distance >= props.spacing) {
      // 角度收斂到 ±90 度：符號永遠正面朝上，不會隨反向移動而顛倒
      let rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI
      if (rawAngle > 90)
        rawAngle -= 180
      else if (rawAngle < -90)
        rawAngle += 180
      const angle = props.followMouseDirection ? rawAngle : 0

      // 單次移動跨過多個間距時補齊中間點，快速滑動軌跡才不會斷開
      for (let i = 1; i <= Math.floor(distance / props.spacing); i++) {
        const t = (props.spacing * i) / distance
        next.push({
          id: idCounter++,
          x: last.x + dx * t,
          y: last.y + dy * t,
          angle,
          ...floatOffsets(),
        })
      }
    }
  }

  trail.value = next.length > props.maxPoints ? next.slice(next.length - props.maxPoints) : next
  lastMoveAt = Date.now()
}

onMounted(() => {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion)
    return

  eventTarget = containerRef.value?.parentElement ?? containerRef.value ?? null
  eventTarget?.addEventListener('mousemove', handleMouseMove)

  removalTimer = setInterval(() => {
    // 靜止逾 100ms 才開始收尾：移動途中的短暫停頓不該把軌跡清光
    if (Date.now() - lastMoveAt > 100 && trail.value.length > 0)
      trail.value = trail.value.slice(1)
  }, props.removalInterval)
})

onBeforeUnmount(() => {
  eventTarget?.removeEventListener('mousemove', handleMouseMove)
  if (removalTimer)
    clearInterval(removalTimer)
})
</script>

<template>
  <div ref="containerRef" aria-hidden="true" class="pointer-events-none absolute inset-0">
    <Motion
      v-for="item in trail"
      :key="item.id"
      :initial="{ opacity: 0, scale: 1, rotate: item.angle }"
      :animate="{
        opacity: 1,
        scale: 1,
        x: randomFloat ? [0, item.randomX, 0] : 0,
        y: randomFloat ? [0, item.randomY, 0] : 0,
        rotate: randomFloat
          ? [item.angle, item.angle + item.randomRotate, item.angle]
          : item.angle,
      }"
      :transition="{
        duration: randomFloat ? 2 : exitDuration,
        repeat: randomFloat ? Number.POSITIVE_INFINITY : 0,
        repeatType: randomFloat ? 'mirror' : 'loop',
      }"
      :style="{ left: `${item.x}px`, top: `${item.y}px` }"
      :class="fontClass"
      class="absolute select-none whitespace-nowrap"
    >
      <!-- 預設走 text prop；要用圖形（SVG）當軌跡時傳 slot 覆蓋 -->
      <slot>{{ text }}</slot>
    </Motion>
  </div>
</template>
