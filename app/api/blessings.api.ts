import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  BlessingApprovedEvent,
  BlessingListItem,
  BlessingRejectedEvent,
  BlessingSubmittedEvent,
  RejectBlessingBody,
  SubmitBlessingBody,
} from '~/types/api/blessings'
import { useHttp } from '~/composables/useHttp'

export function listBlessings(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<BlessingListItem[]>,
) {
  return useHttp().get<BlessingListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/blessings`,
    options,
  )
}

export function submitBlessing(weddingId: string, body: SubmitBlessingBody) {
  return useHttp().post<BlessingSubmittedEvent>('/api/v1/weddings/{weddingId}/blessings', {
    pathParams: { weddingId },
    body,
  })
}

export function approveBlessing(weddingId: string, blessingId: string) {
  return useHttp().post<BlessingApprovedEvent>(
    '/api/v1/weddings/{weddingId}/blessings/{blessingId}/approve',
    { pathParams: { weddingId, blessingId } },
  )
}

export function rejectBlessing(weddingId: string, blessingId: string, body: RejectBlessingBody) {
  return useHttp().post<BlessingRejectedEvent>(
    '/api/v1/weddings/{weddingId}/blessings/{blessingId}/reject',
    { pathParams: { weddingId, blessingId }, body },
  )
}
