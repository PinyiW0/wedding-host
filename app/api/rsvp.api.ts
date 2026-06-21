import type {
  OverrideRsvpBody,
  RsvpInvitationSentEvent,
  RsvpOverriddenEvent,
  RsvpSubmittedEvent,
  SendRsvpInvitationBody,
  SubmitRsvpBody,
} from '~/types/api/rsvp'
import { useHttp } from '~/composables/useHttp'

export function sendRsvpInvitation(weddingId: string, guestId: string, body: SendRsvpInvitationBody) {
  return useHttp().post<RsvpInvitationSentEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/rsvp-invitation',
    { pathParams: { weddingId, guestId }, body },
  )
}

export function submitRsvp(weddingId: string, guestId: string, body: SubmitRsvpBody) {
  return useHttp().post<RsvpSubmittedEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/rsvp',
    { pathParams: { weddingId, guestId }, body },
  )
}

export function overrideRsvp(weddingId: string, guestId: string, body: OverrideRsvpBody) {
  return useHttp().post<RsvpOverriddenEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/rsvp-override',
    { pathParams: { weddingId, guestId }, body },
  )
}
