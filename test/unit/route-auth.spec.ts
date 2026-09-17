import { describe, expect, it } from 'vitest'
import { classifyRoute, isLandingOpen } from '../../server/utils/route-auth'

// 哪些 share 路由對新人自己那場免簽章（issue #163）：只有公開三頁與出席回覆自己會打的那幾支。
// 標錯一支（例如把投影牆的賓客名單也標成 open），不帶簽章的人就能列出全場賓客姓名
const W = '/api/v1/weddings/wedding-001'

describe('classifyRoute 的 open 標記', () => {
  it.each([
    ['婚禮詳情', 'GET', `${W}`],
    ['RSVP 表單設定', 'GET', `${W}/rsvp-config`],
    ['LINE 加好友', 'GET', `${W}/line-oa`],
    ['花田', 'GET', `${W}/flowers`],
    ['出席回覆提交', 'POST', `${W}/guests/rsvp-public`],
  ])('%s：share 且 open', (_label, method, path) => {
    expect(classifyRoute(method, path)).toEqual({ kind: 'share', weddingId: 'wedding-001', open: true })
  })

  it.each([
    ['投影牆祝福', 'GET', `${W}/blessings`],
    ['投影牆賓客名', 'GET', `${W}/guests/display-names`],
    ['投影設定', 'GET', `${W}/projection-settings`],
    ['流程表', 'GET', `${W}/rundown-items`],
    ['祝福提交', 'POST', `${W}/blessings`],
    ['圖片直傳簽名', 'POST', `${W}/uploads/presign`],
  ])('%s：share 但不 open，維持要簽章', (_label, method, path) => {
    expect(classifyRoute(method, path)).toEqual({ kind: 'share', weddingId: 'wedding-001' })
  })

  it('賓客專屬路由不受影響：仍是 guest、帶 guestId', () => {
    expect(classifyRoute('POST', `${W}/guests/g1/rsvp`)).toEqual({ kind: 'guest', weddingId: 'wedding-001', guestId: 'g1' })
    expect(classifyRoute('GET', `${W}/thank-you-card/public/g1`)).toEqual({ kind: 'guest', weddingId: 'wedding-001', guestId: 'g1' })
  })

  it('管理端路由不受影響：賓客名單仍要登入', () => {
    expect(classifyRoute('GET', `${W}/guests`)).toMatchObject({ kind: 'auth', weddingId: 'wedding-001', receptionist: true })
  })
})

// 中介層拿這個判斷決定「不驗簽章、也不因訪客身上帶的登入而擋」：
// 範圍一放大（別的婚禮、沒標 open 的路由也回 true），別場的登入或過期的登入就能穿過婚禮範圍檢查
describe('isLandingOpen：只認新人那場的 open 路由', () => {
  const LANDING = 'wedding-001'

  it('新人那場的 open 路由 → true', () => {
    expect(isLandingOpen(classifyRoute('GET', `${W}/rsvp-config`), LANDING)).toBe(true)
    expect(isLandingOpen(classifyRoute('POST', `${W}/guests/rsvp-public`), LANDING)).toBe(true)
  })

  it('別的婚禮的同一支路由 → false', () => {
    expect(isLandingOpen(classifyRoute('GET', '/api/v1/weddings/wedding-002/rsvp-config'), LANDING)).toBe(false)
  })

  it('新人那場但沒標 open 的 share 路由 → false', () => {
    expect(isLandingOpen(classifyRoute('GET', `${W}/guests/display-names`), LANDING)).toBe(false)
    expect(isLandingOpen(classifyRoute('POST', `${W}/blessings`), LANDING)).toBe(false)
  })

  it('賓客專屬與管理端路由 → false', () => {
    expect(isLandingOpen(classifyRoute('POST', `${W}/guests/g1/rsvp`), LANDING)).toBe(false)
    expect(isLandingOpen(classifyRoute('GET', `${W}/guests`), LANDING)).toBe(false)
    expect(isLandingOpen(classifyRoute('PATCH', `${W}`), LANDING)).toBe(false)
  })

  it('landingId 沒設（dev／e2e 是空字串）→ 沒有這個例外', () => {
    expect(isLandingOpen(classifyRoute('GET', `${W}/rsvp-config`), '')).toBe(false)
    expect(isLandingOpen(classifyRoute('GET', `${W}/rsvp-config`), undefined)).toBe(false)
  })
})
