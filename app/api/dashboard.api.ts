import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type { DashboardStats } from '~/types/api/dashboard'
import { useHttp } from '~/composables/useHttp'

export function getDashboardStats(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<DashboardStats>,
) {
  return useHttp().get<DashboardStats>(
    () => `/api/v1/weddings/${toValue(weddingId)}/dashboard-stats`,
    options,
  )
}
