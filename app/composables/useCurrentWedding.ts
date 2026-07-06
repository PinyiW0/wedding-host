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
    { immediate: false, watch: false },
  )

  watch(
    weddingId,
    (id) => {
      if (id)
        execute()
      // 離開婚禮頁（如回「所有婚禮」）時清掉殘留資料，否則側欄標頭會停在上一場婚禮
      else
        wedding.value = undefined
    },
    { immediate: true },
  )

  return { wedding, weddingId }
}
