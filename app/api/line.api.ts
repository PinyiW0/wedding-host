import type { ConnectLineOaBody, LineOaConnectedEvent } from '~/types/api/line'
import { useHttp } from '~/composables/useHttp'

export function connectLineOa(weddingId: string, body: ConnectLineOaBody) {
  return useHttp().post<LineOaConnectedEvent>('/api/v1/weddings/{weddingId}/line-oa', {
    pathParams: { weddingId },
    body,
  })
}
