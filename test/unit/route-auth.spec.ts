import { describe, expect, it } from 'vitest'
import { classifyRoute } from '../../server/utils/route-auth'

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
