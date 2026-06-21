import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CreateWeddingBody,
  UpdateWeddingBody,
  WeddingCreatedEvent,
  WeddingListItem,
  WeddingRestoredEvent,
  WeddingUpdatedEvent,
} from '~/types/api/weddings'
import { useHttp } from '~/composables/useHttp'

export function listWeddings(options?: HttpGetOptions<WeddingListItem[]>) {
  return useHttp().get<WeddingListItem[]>('/api/v1/weddings', options)
}

export function getWedding(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<WeddingListItem>,
) {
  return useHttp().get<WeddingListItem>(() => `/api/v1/weddings/${toValue(weddingId)}`, options)
}

export function createWedding(body: CreateWeddingBody) {
  return useHttp().post<WeddingCreatedEvent>('/api/v1/weddings', { body })
}

export function updateWedding(weddingId: string, body: UpdateWeddingBody) {
  return useHttp().patch<WeddingUpdatedEvent>('/api/v1/weddings/{weddingId}', {
    pathParams: { weddingId },
    body,
  })
}

export function deleteWedding(weddingId: string) {
  return useHttp().delete<void>('/api/v1/weddings/{weddingId}', {
    pathParams: { weddingId },
  })
}

export function restoreWedding(weddingId: string) {
  return useHttp().post<WeddingRestoredEvent>('/api/v1/weddings/{weddingId}/restore', {
    pathParams: { weddingId },
  })
}
