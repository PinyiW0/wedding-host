import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type { GuestListItem } from '~/types/api/guests'
import type {
  MergePendingGuestBody,
  PendingGuestConfirmedEvent,
  PendingGuestMergedEvent,
  PendingGuestRejectedEvent,
  PublicRsvpSubmittedEvent,
  SubmitPublicRsvpBody,
} from '~/types/api/pending-guests'
import { useHttp } from '~/composables/useHttp'

// 公開自助 RSVP（無 auth）：建立待確認賓客
export function submitPublicRsvp(weddingId: string, body: SubmitPublicRsvpBody) {
  return useHttp().post<PublicRsvpSubmittedEvent>(
    '/api/v1/weddings/{weddingId}/guests/rsvp-public',
    { pathParams: { weddingId }, body },
  )
}

export function listPendingGuests(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<GuestListItem[]>,
) {
  return useHttp().get<GuestListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/pending-guests`,
    options,
  )
}

export function mergePendingGuest(weddingId: string, guestId: string, body: MergePendingGuestBody) {
  return useHttp().post<PendingGuestMergedEvent>(
    '/api/v1/weddings/{weddingId}/pending-guests/{guestId}/merge',
    { pathParams: { weddingId, guestId }, body },
  )
}

export function confirmPendingGuest(weddingId: string, guestId: string) {
  return useHttp().post<PendingGuestConfirmedEvent>(
    '/api/v1/weddings/{weddingId}/pending-guests/{guestId}/confirm',
    { pathParams: { weddingId, guestId } },
  )
}

export function rejectPendingGuest(weddingId: string, guestId: string) {
  return useHttp().post<PendingGuestRejectedEvent>(
    '/api/v1/weddings/{weddingId}/pending-guests/{guestId}/reject',
    { pathParams: { weddingId, guestId } },
  )
}
