import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type { FlowerWallItem } from '~/types/api/flowers'
import { useHttp } from '~/composables/useHttp'

export function listFlowers(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<FlowerWallItem[]>,
) {
  return useHttp().get<FlowerWallItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/flowers`,
    options,
  )
}
