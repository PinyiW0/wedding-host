import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type { ConnectLineOaBody, LineOaConnectedEvent, LineOaDetail } from '~/types/api/line'
import { useHttp } from '~/composables/useHttp'

export function getLineOa(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<LineOaDetail | null>,
) {
  return useHttp().get<LineOaDetail | null>(
    () => `/api/v1/weddings/${toValue(weddingId)}/line-oa`,
    options,
  )
}

export function connectLineOa(weddingId: string, body: ConnectLineOaBody) {
  return useHttp().post<LineOaConnectedEvent>('/api/v1/weddings/{weddingId}/line-oa', {
    pathParams: { weddingId },
    body,
  })
}
