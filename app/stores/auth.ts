import type { LoginBody } from '~/types/api/auth'

import { acceptHMRUpdate, defineStore } from 'pinia'
import { login as loginApi } from '~/api'

// 登入後的使用者資訊（account 對應 testAccounts 的帳號）
interface AuthUser {
  userId: string
  account: string
  role: string
  weddingId: string | null // 接待員綁定的婚禮；管理者為 null
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<AuthUser | null>(null)
    const accessToken = ref<string | null>(null)

    const isAuthenticated = computed(() => !!accessToken.value)

    // 角色判斷（避免角色字串散落各處）
    const isAdmin = computed(() => user.value?.role === '管理者')
    const isCouple = computed(() => user.value?.role === '新人')
    const isReceptionist = computed(() => user.value?.role === '接待員')
    // 當前使用者綁定的婚禮（接待員專用；管理者為 null）
    const weddingId = computed(() => user.value?.weddingId ?? null)

    // 登入：寫入用 $fetch，狀態自動 persist
    async function login(account: string, password: string) {
      const body: LoginBody = { username: account, password }
      const res = await loginApi(body)
      accessToken.value = res.accessToken
      user.value = {
        userId: res.userId,
        account: res.username,
        role: res.role,
        weddingId: res.weddingId,
      }
      return res
    }

    function clearAuth() {
      user.value = null
      accessToken.value = null
    }

    return { user, accessToken, isAuthenticated, isAdmin, isCouple, isReceptionist, weddingId, login, clearAuth }
  },
  {
    persist: {
      // cookie 而非 localStorage：SSR 讀得到 token，避免 hydration 不一致（module 預設即 cookie）。
      // maxAge 必須明設並對齊後端 JWT 存活期（nuxt.config `jwtExpiresIn: '7d'`）：不設＝session cookie，
      // 瀏覽器行程被回收（手機切背景、關瀏覽器）cookie 即蒸發 →「閒置一陣子回來就被登出」。
      storage: piniaPluginPersistedstate.cookies({ sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }),
    },
  },
)

// 開發期 HMR：改 store 不整頁重載、保留現有 state
if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
