import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CreateReceptionAccountBody,
  ReceptionAccountCreatedEvent,
  ReceptionAccountListItem,
  UpdateReceptionAccountBody,
} from '~/types/api/accounts'
import { useHttp } from '~/composables/useHttp'

export function listReceptionAccounts(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<ReceptionAccountListItem[]>,
) {
  return useHttp().get<ReceptionAccountListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/reception-accounts`,
    options,
  )
}

export function createReceptionAccount(weddingId: string, body: CreateReceptionAccountBody) {
  return useHttp().post<ReceptionAccountCreatedEvent>(
    '/api/v1/weddings/{weddingId}/reception-accounts',
    { pathParams: { weddingId }, body },
  )
}

export function updateReceptionAccount(weddingId: string, accountId: string, body: UpdateReceptionAccountBody) {
  return useHttp().patch<ReceptionAccountCreatedEvent>(
    '/api/v1/weddings/{weddingId}/reception-accounts/{accountId}',
    { pathParams: { weddingId, accountId }, body },
  )
}

export function deleteReceptionAccount(weddingId: string, accountId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/reception-accounts/{accountId}',
    { pathParams: { weddingId, accountId } },
  )
}
