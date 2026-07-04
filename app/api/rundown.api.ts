import type { MaybeRefOrGetter } from 'vue'
import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CreateRundownRoleBody,
  RundownItemListItem,
  RundownRoleCreatedEvent,
  RundownRoleListItem,
  RundownRoleUpdatedEvent,
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
