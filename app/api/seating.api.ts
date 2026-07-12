import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CreateTableBody,
  CreateVenueMarkerBody,
  GuestSeatedEvent,
  SeatGuestBody,
  SeatListItem,
  TableCreatedEvent,
  TableListItem,
  TableUpdatedEvent,
  UpdateTableBody,
  UpdateVenueMarkerBody,
  VenueLayoutBody,
  VenueLayoutConfiguredEvent,
  VenueLayoutDetail,
  VenueMarkerCreatedEvent,
  VenueMarkerListItem,
  VenueMarkerUpdatedEvent,
} from '~/types/api/seating'
import { useHttp } from '~/composables/useHttp'

export function listTables(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<TableListItem[]>,
) {
  return useHttp().get<TableListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/tables`,
    options,
  )
}

export function createTable(weddingId: string, body: CreateTableBody) {
  return useHttp().post<TableCreatedEvent>('/api/v1/weddings/{weddingId}/tables', {
    pathParams: { weddingId },
    body,
  })
}

export function updateTable(weddingId: string, tableId: string, body: UpdateTableBody) {
  return useHttp().patch<TableUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/tables/{tableId}',
    { pathParams: { weddingId, tableId }, body },
  )
}

export function deleteTable(weddingId: string, tableId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/tables/{tableId}',
    { pathParams: { weddingId, tableId } },
  )
}

// 命令式讀取單桌座位（在 loadSeats 迴圈內逐桌抓，故用 getOnce 走 $fetch 而非 useFetch）
export function getTableSeats(weddingId: string, tableId: string) {
  return useHttp().getOnce<SeatListItem[]>(
    '/api/v1/weddings/{weddingId}/tables/{tableId}/seats',
    { pathParams: { weddingId, tableId } },
  )
}

export function seatGuest(weddingId: string, tableId: string, body: SeatGuestBody) {
  return useHttp().post<GuestSeatedEvent>(
    '/api/v1/weddings/{weddingId}/tables/{tableId}/seats',
    { pathParams: { weddingId, tableId }, body },
  )
}

export function unseatGuest(weddingId: string, tableId: string, guestId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/tables/{tableId}/seats/{guestId}',
    { pathParams: { weddingId, tableId, guestId } },
  )
}

export function getVenueLayout(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<VenueLayoutDetail | null>,
) {
  return useHttp().get<VenueLayoutDetail | null>(
    () => `/api/v1/weddings/${toValue(weddingId)}/venue-layout`,
    options,
  )
}

export function configureVenueLayout(weddingId: string, body: VenueLayoutBody) {
  return useHttp().put<VenueLayoutConfiguredEvent>(
    '/api/v1/weddings/{weddingId}/venue-layout',
    { pathParams: { weddingId }, body },
  )
}

// === 場地標記（門口、送客區、進場入口等）===
export function listVenueMarkers(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<VenueMarkerListItem[]>,
) {
  return useHttp().get<VenueMarkerListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/venue-markers`,
    options,
  )
}

export function createVenueMarker(weddingId: string, body: CreateVenueMarkerBody) {
  return useHttp().post<VenueMarkerCreatedEvent>(
    '/api/v1/weddings/{weddingId}/venue-markers',
    { pathParams: { weddingId }, body },
  )
}

export function updateVenueMarker(weddingId: string, markerId: string, body: UpdateVenueMarkerBody) {
  return useHttp().patch<VenueMarkerUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/venue-markers/{markerId}',
    { pathParams: { weddingId, markerId }, body },
  )
}

export function deleteVenueMarker(weddingId: string, markerId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/venue-markers/{markerId}',
    { pathParams: { weddingId, markerId } },
  )
}
