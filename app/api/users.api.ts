import type { HttpGetOptions } from '~/composables/useHttp'
import type {
  CoupleAccountEvent,
  CoupleAccountListItem,
  CreateCoupleAccountBody,
  UpdateCoupleAccountBody,
} from '~/types/api/users'
import { useHttp } from '~/composables/useHttp'

export function listCoupleAccounts(options?: HttpGetOptions<CoupleAccountListItem[]>) {
  return useHttp().get<CoupleAccountListItem[]>('/api/v1/users', options)
}

export function createCoupleAccount(body: CreateCoupleAccountBody) {
  return useHttp().post<CoupleAccountEvent>('/api/v1/users', { body })
}

export function updateCoupleAccount(userId: string, body: UpdateCoupleAccountBody) {
  return useHttp().patch<CoupleAccountEvent>('/api/v1/users/{userId}', {
    pathParams: { userId },
    body,
  })
}

export function deleteCoupleAccount(userId: string) {
  return useHttp().delete<void>('/api/v1/users/{userId}', { pathParams: { userId } })
}
