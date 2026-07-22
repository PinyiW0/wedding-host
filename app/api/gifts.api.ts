import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CreateGiftCategoryBody,
  CreateGiftItemBody,
  GiftCategoryCreatedEvent,
  GiftCategoryItem,
  GiftCategoryUpdatedEvent,
  GiftItemCreatedEvent,
  GiftItemListItem,
  GiftItemUpdatedEvent,
  UpdateGiftCategoryBody,
  UpdateGiftItemBody,
} from '~/types/api/gifts'
import { useHttp } from '~/composables/useHttp'

export function listGiftCategories(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<GiftCategoryItem[]>,
) {
  return useHttp().get<GiftCategoryItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/gift-categories`,
    options,
  )
}

export function createGiftCategory(weddingId: string, body: CreateGiftCategoryBody) {
  return useHttp().post<GiftCategoryCreatedEvent>(
    '/api/v1/weddings/{weddingId}/gift-categories',
    { pathParams: { weddingId }, body },
  )
}

export function updateGiftCategory(weddingId: string, categoryId: string, body: UpdateGiftCategoryBody) {
  return useHttp().patch<GiftCategoryUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/gift-categories/{categoryId}',
    { pathParams: { weddingId, categoryId }, body },
  )
}

export function deleteGiftCategory(weddingId: string, categoryId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/gift-categories/{categoryId}',
    { pathParams: { weddingId, categoryId } },
  )
}

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
