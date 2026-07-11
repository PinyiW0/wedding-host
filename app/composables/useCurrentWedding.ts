import type { WeddingListItem } from '~/types/api/weddings'
import { useHttp } from '~/composables/useHttp'

/**
 * 後台殼層用：依當前路由 weddingId 取婚禮資訊供側欄情境標頭顯示。
 * 無 weddingId（如 /weddings、/reception）時不發 request，避免打到 /weddings/undefined。
 */
export function useCurrentWedding() {
  const route = useRoute()
  const weddingId = computed(() => {
    const id = route.params.weddingId
    return typeof id === 'string' && id ? id : ''
  })

  const { data: wedding, execute } = useHttp().get<WeddingListItem>(
    () => `/api/v1/weddings/${weddingId.value}`,
    // 專屬 key：避免與頁面層抓同一 URL 的 useFetch 共用 asyncData——
    // 頁面的 await 在 hydration 中途 resolve 會連帶改寫側欄標頭而 mismatch（#52）
    { immediate: false, watch: false, server: false, key: 'current-wedding-header' },
  )

  // 首次抓取延後至 hydration 完成後（onMounted）：token 存 localStorage、SSR 拿不到，
  // 若在 hydration 期間就發出，client 會在 hydration 結束前 resolve 並重渲染 → mismatch（#52）
  onMounted(() => {
    if (weddingId.value)
      execute()
  })

  watch(
    weddingId,
    (id) => {
      if (id)
        execute()
      // 離開婚禮頁（如回「所有婚禮」）時清掉殘留資料，否則側欄標頭會停在上一場婚禮
      else
        wedding.value = undefined
    },
  )

  return { wedding, weddingId }
}
