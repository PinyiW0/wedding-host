import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import { signRoleLink, signWeddingLink, verifyLinkSig, verifyRoleLinkSig } from '../../server/utils/guest-link'
import { classifyRoute } from '../../server/utils/route-auth'

// 流程表角色連結（issue #188）：r 簽名只認同一場、同一個角色的角色版端點。
// 若 r 簽名被 verifyLinkSig 當成婚禮分享簽名，拿到角色連結的人就能把 role 拿掉讀全表
// 其餘設定照舊（Nuxt 啟動要用），只補上簽章用的 secret
mockNuxtImport<() => Record<string, unknown>>('useRuntimeConfig', original => () => ({ ...original(), guestLinkSecret: 'test-secret' }))

const W = 'wedding-001'

describe('角色簽名', () => {
  it('同一場、同一個角色 → 驗得過', () => {
    expect(verifyRoleLinkSig(signRoleLink(W, 'role-001'), W, 'role-001')).toBe(true)
  })

  it('換成其他角色 → 驗不過', () => {
    expect(verifyRoleLinkSig(signRoleLink(W, 'role-001'), W, 'role-002')).toBe(false)
  })

  it('竄改簽名裡的角色 id → 驗不過', () => {
    const forged = signRoleLink(W, 'role-001').replace('role-001', 'role-002')
    expect(verifyRoleLinkSig(forged, W, 'role-002')).toBe(false)
  })

  it('別場婚禮 → 驗不過', () => {
    expect(verifyRoleLinkSig(signRoleLink(W, 'role-001'), 'wedding-002', 'role-001')).toBe(false)
  })

  it('角色簽名不能當婚禮分享簽名用（讀不到全表）', () => {
    expect(verifyLinkSig(signRoleLink(W, 'role-001'), W)).toBe(false)
  })

  it('婚禮分享簽名不會被當成角色簽名', () => {
    expect(verifyRoleLinkSig(signWeddingLink(W), W, 'role-001')).toBe(false)
  })
})

describe('classifyRoute：角色版端點', () => {
  it('讀取角色版 → role、帶 roleId', () => {
    expect(classifyRoute('GET', `/api/v1/weddings/${W}/rundown-roles/role-001/view`))
      .toEqual({ kind: 'role', weddingId: W, roleId: 'role-001' })
  })

  it('角色改名、移除仍是管理端', () => {
    expect(classifyRoute('PATCH', `/api/v1/weddings/${W}/rundown-roles/role-001`)).toMatchObject({ kind: 'auth' })
    expect(classifyRoute('DELETE', `/api/v1/weddings/${W}/rundown-roles/role-001`)).toMatchObject({ kind: 'auth' })
  })
})
