import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CreateRundownRoleBody,
  GuestScheduleItem,
  RundownItemListItem,
  RundownRoleCreatedEvent,
  RundownRoleListItem,
  RundownRoleUpdatedEvent,
  RundownRoleView,
  RundownTableSavedEvent,
  SaveRundownTableBody,
  UpdateRundownRoleBody,
} from '~/types/api/rundown'
import { useHttp } from '~/composables/useHttp'

// === 流程角色（新人自訂管理） ===
export function listRundownRoles(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<RundownRoleListItem[]>,
) {
  return useHttp().get<RundownRoleListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/rundown-roles`,
    options,
  )
}

export function createRundownRole(weddingId: string, body: CreateRundownRoleBody) {
  return useHttp().post<RundownRoleCreatedEvent>(
    '/api/v1/weddings/{weddingId}/rundown-roles',
    { pathParams: { weddingId }, body },
  )
}

export function updateRundownRole(weddingId: string, roleId: string, body: UpdateRundownRoleBody) {
  return useHttp().patch<RundownRoleUpdatedEvent>(
    '/api/v1/weddings/{weddingId}/rundown-roles/{roleId}',
    { pathParams: { weddingId, roleId }, body },
  )
}

export function deleteRundownRole(weddingId: string, roleId: string) {
  return useHttp().delete<void>(
    '/api/v1/weddings/{weddingId}/rundown-roles/{roleId}',
    { pathParams: { weddingId, roleId } },
  )
}

// === 流程矩陣表 ===
export function listRundownItems(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<RundownItemListItem[]>,
) {
  return useHttp().get<RundownItemListItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/rundown-items`,
    options,
  )
}

// 整表取代：既有列帶 rundownItemId、新列省略（後端配發）、未帶回的既有列＝刪除
export function saveRundownTable(weddingId: string, body: SaveRundownTableBody) {
  return useHttp().put<RundownTableSavedEvent>(
    '/api/v1/weddings/{weddingId}/rundown-items',
    { pathParams: { weddingId }, body },
  )
}

// === 流程表角色版（issue #188）：角色連結只讀得到自己那份 ===
export function getRundownRoleView(
  weddingId: MaybeRefOrGetter<string>,
  roleId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<RundownRoleView>,
) {
  return useHttp().get<RundownRoleView>(
    () => `/api/v1/weddings/${toValue(weddingId)}/rundown-roles/${toValue(roleId)}/view`,
    options,
  )
}

// === 賓客版流程（issue #190）：只有賓客可見時段的公開欄位 ===
export function listGuestSchedule(
  weddingId: MaybeRefOrGetter<string>,
  options?: HttpGetOptions<GuestScheduleItem[]>,
) {
  return useHttp().get<GuestScheduleItem[]>(
    () => `/api/v1/weddings/${toValue(weddingId)}/guest-schedule`,
    options,
  )
}
