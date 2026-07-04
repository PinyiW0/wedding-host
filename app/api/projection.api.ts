import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  ProjectionSettings,
  ProjectionSettingsUpdatedEvent,
  UpdateProjectionSettingsBody,
} from '~/types/api/projection'
import { useHttp } from '~/composables/useHttp'

// GET 讀回投影設定（比照 getVenueLayout：允許 null default 供頁面判空）
export function getProjectionSettings(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<ProjectionSettings | null>,
) {
  return useHttp().get<ProjectionSettings | null>(
    () => `/api/v1/weddings/${toValue(weddingId)}/projection-settings`,
    options,
  )
}

export function updateProjectionSettings(weddingId: string, body: UpdateProjectionSettingsBody) {
  return useHttp().put<ProjectionSettingsUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/projection-settings',
    { pathParams: { weddingId }, body },
  )
}
