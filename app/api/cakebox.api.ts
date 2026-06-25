import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CakeBoxAssignmentConfiguredEvent,
  CakeBoxAssignmentListItem,
  CakeBoxExclusionListItem,
  CakeBoxExtraOrderCreatedEvent,
  CakeBoxExtraOrderListItem,
  CakeBoxGuestExcludedEvent,
  CakeBoxTypeCreatedEvent,
  CakeBoxTypeListItem,
  CakeBoxTypeUpdatedEvent,
  ConfigureCakeBoxAssignmentBody,
  CreateCakeBoxExtraOrderBody,
  CreateCakeBoxTypeBody,
  ExcludeGuestCakeBoxBody,
  UpdateCakeBoxTypeBody,
} from '~/types/api/cakebox'
import { useHttp } from '~/composables/useHttp'

export function listCakeBoxAssignments(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<CakeBoxAssignmentListItem[]>,
) {
  return useHttp().get<CakeBoxAssignmentListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/cake-box-types/assignments`,
    options,
  )
}

export function listCakeBoxTypes(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<CakeBoxTypeListItem[]>,
) {
  return useHttp().get<CakeBoxTypeListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/cake-box-types`,
    options,
  )
}

export function createCakeBoxType(weddingId: string, body: CreateCakeBoxTypeBody) {
  return useHttp().post<CakeBoxTypeCreatedEvent>(
    '/api/v1/weddings/{weddingId}/cake-box-types',
    { pathParams: { weddingId }, body },
  )
}

export function updateCakeBoxType(weddingId: string, cakeBoxTypeId: string, body: UpdateCakeBoxTypeBody) {
  return useHttp().patch<CakeBoxTypeUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/cake-box-types/{cakeBoxTypeId}',
    { pathParams: { weddingId, cakeBoxTypeId }, body },
  )
}

export function deleteCakeBoxType(weddingId: string, cakeBoxTypeId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/cake-box-types/{cakeBoxTypeId}',
    { pathParams: { weddingId, cakeBoxTypeId } },
  )
}

export function configureCakeBoxAssignment(
  weddingId: string,
  cakeBoxTypeId: string,
  body: ConfigureCakeBoxAssignmentBody,
) {
  return useHttp().post<CakeBoxAssignmentConfiguredEvent>(
    '/api/v1/weddings/{weddingId}/cake-box-types/{cakeBoxTypeId}/assignment',
    { pathParams: { weddingId, cakeBoxTypeId }, body },
  )
}

// === 不發放（新人本人等不需喜餅者）===
export function listCakeBoxExclusions(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<CakeBoxExclusionListItem[]>,
) {
  return useHttp().get<CakeBoxExclusionListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/cake-box-exclusions`,
    options,
  )
}

export function excludeGuestCakeBox(weddingId: string, body: ExcludeGuestCakeBoxBody) {
  return useHttp().post<CakeBoxGuestExcludedEvent>(
    '/api/v1/weddings/{weddingId}/cake-box-exclusions',
    { pathParams: { weddingId }, body },
  )
}

export function removeCakeBoxExclusion(weddingId: string, guestId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/cake-box-exclusions/{guestId}',
    { pathParams: { weddingId, guestId } },
  )
}

// === 額外配發（公關／公司公餅）===
export function listCakeBoxExtraOrders(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<CakeBoxExtraOrderListItem[]>,
) {
  return useHttp().get<CakeBoxExtraOrderListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/cake-box-extra-orders`,
    options,
  )
}

export function createCakeBoxExtraOrder(weddingId: string, body: CreateCakeBoxExtraOrderBody) {
  return useHttp().post<CakeBoxExtraOrderCreatedEvent>(
    '/api/v1/weddings/{weddingId}/cake-box-extra-orders',
    { pathParams: { weddingId }, body },
  )
}

export function deleteCakeBoxExtraOrder(weddingId: string, extraOrderId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/cake-box-extra-orders/{extraOrderId}',
    { pathParams: { weddingId, extraOrderId } },
  )
}
