import type {
  CakeBoxDistributedEvent,
  DistributeCakeBoxBody,
  GiftMoneyRecordedEvent,
  GiftMoneyUpdatedEvent,
  GuestCheckedInEvent,
  GuestSelfCheckedInEvent,
  RecordGiftMoneyBody,
  SelfCheckInBody,
  UpdateGiftMoneyBody,
} from '~/types/api/reception'
import { useHttp } from '~/composables/useHttp'

export function checkInGuest(weddingId: string, guestId: string) {
  return useHttp().post<GuestCheckedInEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/check-in',
    { pathParams: { weddingId, guestId } },
  )
}

export function selfCheckInGuest(weddingId: string, guestId: string, body: SelfCheckInBody) {
  return useHttp().post<GuestSelfCheckedInEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/self-check-in',
    { pathParams: { weddingId, guestId }, body },
  )
}

export function recordGiftMoney(weddingId: string, guestId: string, body: RecordGiftMoneyBody) {
  return useHttp().post<GiftMoneyRecordedEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/gift-money',
    { pathParams: { weddingId, guestId }, body },
  )
}

export function updateGiftMoney(weddingId: string, guestId: string, body: UpdateGiftMoneyBody) {
  return useHttp().patch<GiftMoneyUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/gift-money',
    { pathParams: { weddingId, guestId }, body },
  )
}

export function distributeCakeBox(weddingId: string, guestId: string, body: DistributeCakeBoxBody) {
  return useHttp().post<CakeBoxDistributedEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/cake-box-distribution',
    { pathParams: { weddingId, guestId }, body },
  )
}
