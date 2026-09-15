// 數字計數：active 變成 true 之後，從 from 走到 to（ease-out cubic），時間驅動、只改一個 ref。
// 用在 /story 各頁的公里數：從上一段的公里數走到這一段（201 → 111 → 65 → 0）。
// SSR 首渲染顯示終值；reduced-motion 直接跳到終值。from／to 收 getter 或 ref：呼叫端傳 `() => props.x` 保住響應。
import type { MaybeRefOrGetter, Ref } from 'vue'

export function useCountUp(
  active: MaybeRefOrGetter<boolean>,
  from: MaybeRefOrGetter<number>,
  to: MaybeRefOrGetter<number>,
  options: { delay?: number, duration?: number } = {},
): { shown: Ref<number> } {
  const { delay = 0, duration = 900 } = options
  const shown = ref(toValue(to))
  let frame = 0

  function stop() {
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  function run() {
    stop()
    const start = toValue(from)
    const end = toValue(to)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown.value = end
      return
    }
    let origin: number | null = null
    function step(now: number) {
      if (origin === null)
        origin = now + delay
      const t = Math.min(1, Math.max(0, (now - origin) / duration))
      const eased = 1 - (1 - t) ** 3
      shown.value = Math.round(start + (end - start) * eased)
      frame = t < 1 ? requestAnimationFrame(step) : 0
    }
    shown.value = start
    frame = requestAnimationFrame(step)
  }

  watch(() => toValue(active), (on) => {
    if (on)
      run()
  })

  onBeforeUnmount(stop)

  return { shown }
}
