import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CreateGiftItemBody,
  GiftItemCreatedEvent,
  GiftItemListItem,
  GiftItemUpdatedEvent,
  UpdateGiftItemBody,
} from '~/types/api/gifts'
import { useHttp } from '~/composables/useHttp'

export function listGiftItems(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<GiftItemListItem[]>,
) {
  return useHttp().get<GiftItemListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/gift-items`,
    options,
  )
}

export function createGiftItem(weddingId: string, body: CreateGiftItemBody) {
  return useHttp().post<GiftItemCreatedEvent>(
    '/api/v1/weddings/{weddingId}/gift-items',
    { pathParams: { weddingId }, body },
  )
}

export function updateGiftItem(weddingId: string, giftItemId: string, body: UpdateGiftItemBody) {
  return useHttp().patch<GiftItemUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/gift-items/{giftItemId}',
    { pathParams: { weddingId, giftItemId }, body },
  )
}

export function deleteGiftItem(weddingId: string, giftItemId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/gift-items/{giftItemId}',
    { pathParams: { weddingId, giftItemId } },
  )
}
