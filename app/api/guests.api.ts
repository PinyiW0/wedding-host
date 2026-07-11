import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  BindGuestLineBody,
  CreateGuestBody,
  GuestCategoriesSavedEvent,
  GuestCategoryRenamedEvent,
  GuestCreatedEvent,
  GuestDisplayName,
  GuestLineBoundEvent,
  GuestLineLoginInfo,
  GuestListItem,
  GuestRestoredEvent,
  GuestsImportedEvent,
  GuestUpdatedEvent,
  ImportGuestsBody,
  InvitationSentMarkedEvent,
  MarkInvitationSentBody,
  RenameGuestCategoryBody,
  SaveGuestCategoriesBody,
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

// 公開投影牆用：只取賓客 id→顯示名對照（無 PII），與管理端 listGuests 分流
export function listGuestDisplayNames(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<GuestDisplayName[]>,
) {
  return useHttp().get<GuestDisplayName[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/guests/display-names`,
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

// OAuth 起手：點擊「綁定 LINE」時抓一次，有 authorizeUrl 即整頁導向 LINE 授權
export function getGuestLineLogin(weddingId: string, guestId: string) {
  return useHttp().getOnce<GuestLineLoginInfo>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/line-login',
    { pathParams: { weddingId, guestId } },
  )
}

export function bindGuestLine(weddingId: string, guestId: string, body: BindGuestLineBody) {
  return useHttp().post<GuestLineBoundEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/line-binding',
    { pathParams: { weddingId, guestId }, body },
  )
}

// 標記喜帖已寄送（PUT 冪等設值）
export function markInvitationSent(weddingId: string, guestId: string, body: MarkInvitationSentBody) {
  return useHttp().put<InvitationSentMarkedEvent>(
    '/api/v1/weddings/{weddingId}/guests/{guestId}/invitation-sent',
    { pathParams: { weddingId, guestId }, body },
  )
}

// === 婚禮層級賓客分類清單 ===
export function listGuestCategories(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<string[]>,
) {
  return useHttp().get<string[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/guest-categories`,
    options,
  )
}

export function saveGuestCategories(weddingId: string, body: SaveGuestCategoriesBody) {
  return useHttp().put<GuestCategoriesSavedEvent>(
    '/api/v1/weddings/{weddingId}/guest-categories',
    { pathParams: { weddingId }, body },
  )
}

export function renameGuestCategory(weddingId: string, body: RenameGuestCategoryBody) {
  return useHttp().post<GuestCategoryRenamedEvent>(
    '/api/v1/weddings/{weddingId}/guest-categories/rename',
    { pathParams: { weddingId }, body },
  )
}
