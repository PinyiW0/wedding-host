import type {
  AdminRegisteredEvent,
  LoginBody,
  RegisterAdminBody,
  UserLoggedInEvent,
} from '~/types/api/auth'
import { useHttp } from '~/composables/useHttp'

// 註記：registerAdmin 不設 handleUnauthorized:false——它的 401 是「請先登入」（token 失效），
// 帳號權限不足走 403，兩者語意與 login 的「帳密錯」不同，仍該照常清登入態導回登入頁。
export function registerAdmin(body: RegisterAdminBody) {
  return useHttp().post<AdminRegisteredEvent>('/api/v1/admins', { body })
}

// 登入端點的 401＝這次帳密錯，不是登入態失效：
// 不設 false 的話，已登入者在登入頁打錯一次密碼就會被清掉原本的 session（issue #147）
export function login(body: LoginBody) {
  return useHttp().post<UserLoggedInEvent>('/api/v1/auth/login', { body, handleUnauthorized: false })
}
