import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useHttp } from '~/composables/useHttp'
import { useAuthStore } from '~/stores/auth'

// navigateTo 需攔截：401 會導向 /login，測試環境不做真實導頁
const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn(() => Promise.resolve()) }))
mockNuxtImport('navigateTo', () => navigateToMock)

// runtime 煙霧測試：真的透過 useHttp 打假端點，驗證 baseURL 套上、path 替換、AsyncData / Promise 行為
describe('useHttp 共用 domain（runtime 煙霧測試）', () => {
  it('getOnce：baseURL（apiBase /api）有套上、$fetch 取得資料', async () => {
    registerEndpoint('/api/ping', () => ({ ok: true }))
    const res = await useHttp().getOnce<{ ok: boolean }>('/ping')
    expect(res.ok).toBe(true)
  })

  it('getOnce：path params 在 runtime 被替換', async () => {
    registerEndpoint('/api/users/42', () => ({ id: '42' }))
    const res = await useHttp().getOnce<{ id: string }>('/users/{id}', { pathParams: { id: 42 } })
    expect(res.id).toBe('42')
  })

  it('post：寫入走 $fetch（method POST）', async () => {
    registerEndpoint('/api/users', { method: 'POST', handler: () => ({ created: true }) })
    const res = await useHttp().post<{ created: boolean }>('/users', { body: { name: 'x' } })
    expect(res.created).toBe(true)
  })

  it('get：reactive 讀取（useFetch）回 AsyncData 且資料正確', async () => {
    registerEndpoint('/api/teams', () => [{ id: 't1' }])
    const Comp = defineComponent({
      async setup() {
        const { data } = await useHttp().get<{ id: string }[]>('/teams')
        return () => h('div', JSON.stringify(data.value))
      },
    })
    const wrapper = await mountSuspended(Comp)
    expect(wrapper.text()).toContain('t1')
  })

  it('get：getter url（reactive 形式）可解析', async () => {
    registerEndpoint('/api/teams/t9', () => ({ id: 't9' }))
    const Comp = defineComponent({
      async setup() {
        const id = ref('t9')
        const { data } = await useHttp().get<{ id: string }>(() => `/teams/${id.value}`)
        return () => h('div', JSON.stringify(data.value))
      },
    })
    const wrapper = await mountSuspended(Comp)
    expect(wrapper.text()).toContain('t9')
  })
})

// issue #147：401 的兩種語意必須分流——「登入態失效」該登出，「這次帳密錯」不該動現有 session
describe('useHttp 的 401 處理', () => {
  registerEndpoint('/api/needs-auth', () => {
    throw createError({ statusCode: 401, statusMessage: '請先登入' })
  })

  beforeEach(() => {
    navigateToMock.mockClear()
    const auth = useAuthStore()
    auth.user = { userId: 'u1', account: 'admin', role: '管理者', weddingId: null }
    auth.accessToken = 'stale-token'
    window.history.pushState({}, '', '/guests')
  })

  it('一般端點回 401：清除登入態並導回登入頁', async () => {
    await expect(useHttp().getOnce('/needs-auth')).rejects.toThrow()

    expect(useAuthStore().accessToken).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('帶 handleUnauthorized:false 的端點回 401：保留登入態、不導頁', async () => {
    await expect(
      useHttp().post('/needs-auth', { body: {}, handleUnauthorized: false }),
    ).rejects.toThrow()

    expect(useAuthStore().accessToken).toBe('stale-token')
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('同頁多支 API 同時回 401：只導向登入頁一次', async () => {
    const http = useHttp()

    // 不依賴誰先回應：先觸發的那個 clearAuth 後 token 即為 null，其餘會在 guard 提早返回
    await Promise.allSettled([
      http.getOnce('/needs-auth'),
      http.getOnce('/needs-auth'),
      http.getOnce('/needs-auth'),
    ])

    expect(navigateToMock).toHaveBeenCalledTimes(1)
  })

  it('已在登入頁時回 401：清除登入態但不重複導向當前路由', async () => {
    window.history.pushState({}, '', '/login')

    await expect(useHttp().getOnce('/needs-auth')).rejects.toThrow()

    expect(useAuthStore().accessToken).toBeNull()
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
