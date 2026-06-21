import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  BindGuestLineBody,
  CreateGuestBody,
  GuestCreatedEvent,
  GuestLineBoundEvent,
  GuestListItem,
  GuestRestoredEvent,
  GuestsImportedEvent,
  GuestUpdatedEvent,
  ImportGuestsBody,
  UpdateGuestBody,
} from '~/types/api/guests'
import { useHttp } from '~/composables/useHttp'

export function listGuests(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<GuestListItem[]>,
) {
  return useHttp().get<GuestListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/guests`,
    options,
  )
}

export function createGuest(weddingId: string, body: CreateGuestBody) {
  return useHttp().post<GuestCreatedEvent>('/api/v1/weddings/{weddingId}/guests', {
    pathParams: { weddingId },
    body,
  })
}

export function updateGuest(weddingId: string, guestId: string, body: UpdateGuestBody) {
  return useHttp().patch<GuestUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}',
    { pathParams: { weddingId, guestId }, body },
  )
}

export function deleteGuest(weddingId: string, guestId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}',
    { pathParams: { weddingId, guestId } },
  )
}

export function restoreGuest(weddingId: string, guestId: string) {
  return useHttp().post<GuestRestoredEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/restore',
    { pathParams: { weddingId, guestId } },
  )
}

export function importGuests(weddingId: string, body: ImportGuestsBody) {
  return useHttp().post<GuestsImportedEvent>(
    '/api/v1/weddings/{weddingId}/guests/import',
    { pathParams: { weddingId }, body },
  )
}

export function bindGuestLine(weddingId: string, guestId: string, body: BindGuestLineBody) {
  return useHttp().post<GuestLineBoundEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/line-binding',
    { pathParams: { weddingId, guestId }, body },
  )
}
