// app/composables/usePointerReorder.ts
// 按住把手拖曳換位置（issue #207 自 rundown.vue 列拖曳抽出，流程列與角色欄順序共用）：
// 目標元素要帶 data-<attr>="<index>"，放開時以 shift 語意回報 from → to（抽出後插到目標位置）
// data-foo-bar → dataset.fooBar
const KEBAB_SEGMENT_RE = /-([a-z])/g
// 拖到可捲容器上下緣這個範圍內就自動捲（issue #213）：清單比容器長時，才拖得到畫面外的位置
const EDGE_PX = 32
const SCROLL_STEP_PX = 10

// 往上找第一個「內容比自己高、可以垂直捲」的容器
function scrollParentOf(el: Element | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight)
      return node
  }
  return null
}

export function usePointerReorder(attr: string, onDrop: (from: number, to: number) => void) {
  const draggingIndex = ref<number | null>(null)
  const overIndex = ref<number | null>(null)
  const selector = `[data-${attr}]`
  const datasetKey = attr.replace(KEBAB_SEGMENT_RE, (_, c: string) => c.toUpperCase())

  let scroller: HTMLElement | null = null
  let pointerX = 0
  let pointerY = 0
  let frame = 0

  function updateOver() {
    const el = document.elementFromPoint(pointerX, pointerY)?.closest(selector)
    if (!(el instanceof HTMLElement))
      return
    const idx = Number(el.dataset[datasetKey])
    if (Number.isInteger(idx))
      overIndex.value = idx
  }

  // 指標停在容器上下緣時每一幀捲一點；捲不動（到頂或到底）或離開邊緣就停
  function autoScroll() {
    frame = 0
    if (draggingIndex.value === null || !scroller)
      return
    const rect = scroller.getBoundingClientRect()
    const step = pointerY < rect.top + EDGE_PX ? -SCROLL_STEP_PX : pointerY > rect.bottom - EDGE_PX ? SCROLL_STEP_PX : 0
    if (step === 0)
      return
    const before = scroller.scrollTop
    scroller.scrollTop += step
    if (scroller.scrollTop === before)
      return
    updateOver()
    frame = requestAnimationFrame(autoScroll)
  }

  function onMove(event: PointerEvent) {
    if (draggingIndex.value === null)
      return
    pointerX = event.clientX
    pointerY = event.clientY
    updateOver()
    if (!frame)
      frame = requestAnimationFrame(autoScroll)
  }

  function stopAutoScroll() {
    cancelAnimationFrame(frame)
    frame = 0
    scroller = null
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    stopAutoScroll()
    const from = draggingIndex.value
    const to = overIndex.value
    draggingIndex.value = null
    overIndex.value = null
    if (from === null || to === null || from === to)
      return
    onDrop(from, to)
  }

  function start(event: PointerEvent, index: number) {
    if (event.button !== 0)
      return
    draggingIndex.value = index
    overIndex.value = index
    scroller = scrollParentOf(event.currentTarget instanceof Element ? event.currentTarget : null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    event.preventDefault()
  }

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    stopAutoScroll()
  })

  return { draggingIndex, overIndex, start }
}
