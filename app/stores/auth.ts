import type { LoginBody } from '~/types/api/auth'

import { defineStore } from 'pinia'
import { login as loginApi } from '~/api'

// 登入後的使用者資訊（account 對應 testAccounts 的帳號）
interface AuthUser {
  userId: string
  account: string
  role: string
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<AuthUser | null>(null)
    const accessToken = ref<string | null>(null)

    const isAuthenticated = computed(() => !!accessToken.value)

    // 登入：寫入用 $fetch，狀態自動 persist
    async function login(account: string, password: string) {
      const body: LoginBody = { username: account, password }
      const res = await loginApi(body)
      accessToken.value = res.accessToken
      user.value = { userId: res.userId, account: res.username, role: res.role }
      return res
    }

    function clearAuth() {
      user.value = null
      accessToken.value = null
    }

    return { user, accessToken, isAuthenticated, login, clearAuth }
  },
  {
    persist: true,
  },
)
