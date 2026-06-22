import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CakeBoxAssignmentConfiguredEvent,
  CakeBoxAssignmentListItem,
  CakeBoxTypeCreatedEvent,
  CakeBoxTypeListItem,
  CakeBoxTypeUpdatedEvent,
  ConfigureCakeBoxAssignmentBody,
  CreateCakeBoxTypeBody,
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
