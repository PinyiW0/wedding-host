import type {
  AdminRegisteredEvent,
  LoginBody,
  RegisterAdminBody,
  UserLoggedInEvent,
} from '~/types/api/auth'
import { useHttp } from '~/composables/useHttp'

export function registerAdmin(body: RegisterAdminBody) {
  return useHttp().post<AdminRegisteredEvent>('/api/v1/admins', { body })
}

export function login(body: LoginBody) {
  return useHttp().post<UserLoggedInEvent>('/api/v1/auth/login', { body })
}
