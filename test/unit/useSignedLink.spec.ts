import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSignedLink } from '~/composables/useSignedLink'

// useRoute 是 auto-import，這裡換成可控的假路由：簽章與目前路徑都要能逐案調整
const { routeMock } = vi.hoisted(() => ({
  routeMock: { path: '/story/wedding-001', query: {} as Record<string, string> },
}))
mockNuxtImport('useRoute', () => () => routeMock)

describe('useSignedLink.withSig 把婚禮簽章帶到每一條連結', () => {
  beforeEach(() => {
    routeMock.path = '/story/wedding-001'
    routeMock.query = { sig: 'w.abc123' }
  })

  it('頁內錨點：補上目前路徑再帶簽章，錨點留在最後面', () => {
    // 只回傳 "#wedding-info" 的話 Vue Router 會把網址上的 query 丟掉，簽章當場消失（2026-09-16 上線事故）
    const { withSig } = useSignedLink()
    expect(withSig('#wedding-info')).toBe('/story/wedding-001?sig=w.abc123#wedding-info')
  })

  it('頁內錨點：跟著目前所在的頁面走', () => {
    routeMock.path = '/gallery/wedding-001'
    const { withSig } = useSignedLink()
    expect(withSig('#series-meadow')).toBe('/gallery/wedding-001?sig=w.abc123#series-meadow')
  })

  it('一般路徑：直接接上 sig', () => {
    const { withSig } = useSignedLink()
    expect(withSig('/rsvp/public/wedding-001')).toBe('/rsvp/public/wedding-001?sig=w.abc123')
  })

  it('已經有 query 的路徑：用 & 接', () => {
    const { withSig } = useSignedLink()
    expect(withSig('/blessing/wedding-001?guestId=g1')).toBe('/blessing/wedding-001?guestId=g1&sig=w.abc123')
  })

  it('路徑同時有 query 與錨點：sig 接在 query 後、錨點仍在最尾端', () => {
    const { withSig } = useSignedLink()
    expect(withSig('/gallery/wedding-001?tab=city#series-city')).toBe('/gallery/wedding-001?tab=city&sig=w.abc123#series-city')
  })

  it('簽章做 URL 編碼，特殊字元不會截斷網址', () => {
    routeMock.query = { sig: 'g.guest 1.a+b/c' }
    const { withSig } = useSignedLink()
    expect(withSig('/rsvp/public/wedding-001')).toBe('/rsvp/public/wedding-001?sig=g.guest%201.a%2Bb%2Fc')
  })

  it('網址上沒有簽章時（本機 open 模式）連結維持原樣', () => {
    routeMock.query = {}
    const { withSig } = useSignedLink()
    expect(withSig('/rsvp/public/wedding-001')).toBe('/rsvp/public/wedding-001')
    expect(withSig('#wedding-info')).toBe('#wedding-info')
  })
})
