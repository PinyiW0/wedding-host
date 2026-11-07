// app/composables/usePointerReorder.ts
// 按住把手拖曳換位置（issue #207 自 rundown.vue 列拖曳抽出，流程列與角色欄順序共用）：
// 目標元素要帶 data-<attr>="<index>"，放開時以 shift 語意回報 from → to（抽出後插到目標位置）
// data-foo-bar → dataset.fooBar
const KEBAB_SEGMENT_RE = /-([a-z])/g

export function usePointerReorder(attr: string, onDrop: (from: number, to: number) => void) {
  const draggingIndex = ref<number | null>(null)
  const overIndex = ref<number | null>(null)
  const selector = `[data-${attr}]`
  const datasetKey = attr.replace(KEBAB_SEGMENT_RE, (_, c: string) => c.toUpperCase())

  function onMove(event: PointerEvent) {
    if (draggingIndex.value === null)
      return
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest(selector)
    if (!(el instanceof HTMLElement))
      return
    const idx = Number(el.dataset[datasetKey])
    if (Number.isInteger(idx))
      overIndex.value = idx
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
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
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    event.preventDefault()
  }

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  })

  return { draggingIndex, overIndex, start }
}
