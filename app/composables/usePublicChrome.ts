// app/composables/usePublicChrome.ts — 公開頁右上角那顆固定的選單開關要用什麼顏色。
// 它疊在頁面上不跟著捲：底下是紙色就用墨色，底下是深色照片就換紙白。
// 誰蓋到它由各區塊自己回報：把區塊根元素交給 watchCorner，並說明「蓋到的時候底下是不是深的」。
// 判斷「蓋到」用 IntersectionObserver 量視窗頂端 36～63px 那一小條（開關的中心在 y≈46），
// 不在捲動事件裡讀 getBoundingClientRect。
// 之前用 mix-blend-mode: difference 讓白線自動翻色，但中灰的石牆翻出來還是中灰（書第一跨），才改成明講。
import type { Ref } from 'vue'

/** 各區塊回報的「我蓋到開關而且底下是深的」，key 是區塊名 */
type DarkSources = Record<string, boolean>

export function usePublicChrome() {
  const sources = useState<DarkSources>('public-chrome-dark', () => ({}))

  /** 有任何一個區塊回報深色，開關就換紙白 */
  const light = computed(() => Object.values(sources.value).some(Boolean))

  function setDark(key: string, on: boolean) {
    if ((sources.value[key] ?? false) === on)
      return
    sources.value = { ...sources.value, [key]: on }
  }

  /**
   * 觀察一個區塊：它蓋到開關那一條、而且 dark() 為真時，回報深色。
   * dark 是 getter，區塊裡的狀態變了（書翻到另一跨）也會跟著更新；離開視窗或卸載時自動收回
   */
  function watchCorner(key: string, el: Ref<HTMLElement | null>, dark: () => boolean) {
    const covering = ref(false)
    let observer: IntersectionObserver | null = null

    onMounted(() => {
      if (!el.value)
        return
      observer = new IntersectionObserver((records) => {
        covering.value = records.some(record => record.isIntersecting)
      }, { rootMargin: '-36px 0px -93% 0px' })
      observer.observe(el.value)
    })

    watchEffect(() => {
      setDark(key, covering.value && dark())
    })

    onBeforeUnmount(() => {
      observer?.disconnect()
      observer = null
      setDark(key, false)
    })
  }

  return { light, watchCorner }
}
