import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createError, createEvent, defineEventHandler, getHeader, getQuery, getRequestURL } from 'h3'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { receptionAccounts, users } from '../../server/db/schema'
import { classifyRoute, isLandingOpen } from '../../server/utils/route-auth'

// 中介層的「新人那場免簽章」例外（issue #163）：守的是接線，不是判斷式本身。
// 把 landingOpen 接錯位置（例如漏比婚禮 ID、空字串也放行、對沒標 open 的路由也放行），
// route-auth.spec.ts 仍會是綠的，但每一場婚禮的公開資料都不用簽章了——這支測試會轉紅。
const LANDING = 'wedding-landing'
const OTHER = 'wedding-other'

const { config, dbRows } = vi.hoisted(() => ({
  config: { authMode: 'enforced', public: { landingWeddingId: '' } },
  dbRows: new Map<unknown, unknown[]>(),
}))

// 測試環境的自動匯入會把中介層裡的 useRuntimeConfig 換成 Nuxt app 那一份：
// 其餘設定照舊（Nuxt 啟動要用），只蓋掉中介層會讀的 authMode 與 landingWeddingId
interface RuntimeConfigShape { public: Record<string, unknown>, [key: string]: unknown }
mockNuxtImport<() => RuntimeConfigShape>('useRuntimeConfig', original => () => {
  const base = original()
  return { ...base, authMode: config.authMode, public: { ...base.public, landingWeddingId: config.public.landingWeddingId } }
})

vi.mock('../../server/db', () => ({
  ensureDbReady: vi.fn(async () => {}),
  // 只支援中介層用到的 select().from(table).where()：依資料表回預先放好的列
  useDb: () => ({
    select: () => ({ from: (table: unknown) => ({ where: async () => dbRows.get(table) ?? [] }) }),
  }),
}))

type Handler = (event: H3Event) => Promise<unknown>
let handler: Handler

beforeAll(async () => {
  // Nitro 自動匯入在單元測試環境不存在：補成全域後再載入中介層
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('getRequestURL', getRequestURL)
  vi.stubGlobal('getHeader', getHeader)
  vi.stubGlobal('getQuery', getQuery)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('classifyRoute', classifyRoute)
  vi.stubGlobal('isLandingOpen', isLandingOpen)
  vi.stubGlobal('verifyLinkSig', () => false)
  // 'valid' 當成驗得過的 token，其餘一律視為無效／過期
  vi.stubGlobal('verifyAuthToken', async (token: string) => token === 'valid' ? { userId: 'acc-1' } : null)
  handler = (await import('../../server/middleware/auth')).default as Handler
})

beforeEach(() => {
  config.authMode = 'enforced'
  config.public.landingWeddingId = LANDING
  dbRows.clear()
})

function makeEvent(method: string, path: string, token?: string): H3Event {
  const req = new IncomingMessage(new Socket())
  req.method = method
  req.url = path
  req.headers = { host: 'localhost', ...(token ? { authorization: `Bearer ${token}` } : {}) }
  return createEvent(req, new ServerResponse(req))
}

// 回傳被擋下的狀態碼；放行回 0
async function run(event: H3Event): Promise<number> {
  try {
    await handler(event)
    return 0
  }
  catch (error) {
    return (error as { statusCode: number }).statusCode
  }
}

// 接待員帳號：綁在哪一場由參數決定
function loginAsReceptionist(weddingId: string) {
  dbRows.set(users, [])
  dbRows.set(receptionAccounts, [{ accountId: 'acc-1', username: 'desk', weddingId }])
}

const api = (weddingId: string, sub = '') => `/api/v1/weddings/${weddingId}${sub}`

describe('auth 中介層：新人那場的 open 路由（enforced）', () => {
  it.each([
    ['婚禮詳情', 'GET', ''],
    ['RSVP 表單設定', 'GET', '/rsvp-config'],
    ['LINE 加好友', 'GET', '/line-oa'],
    ['花田', 'GET', '/flowers'],
    ['出席回覆提交', 'POST', '/guests/rsvp-public'],
  ])('沒登入、沒簽章打新人那場的%s → 放行', async (_label, method, sub) => {
    expect(await run(makeEvent(method, api(LANDING, sub)))).toBe(0)
  })

  it('別的婚禮的同一支路由 → 403', async () => {
    expect(await run(makeEvent('GET', api(OTHER, '/rsvp-config')))).toBe(403)
    expect(await run(makeEvent('POST', api(OTHER, '/guests/rsvp-public')))).toBe(403)
  })

  it('新人那場但沒標 open 的 share 路由 → 403', async () => {
    expect(await run(makeEvent('GET', api(LANDING, '/guests/display-names')))).toBe(403)
    expect(await run(makeEvent('GET', api(LANDING, '/blessings')))).toBe(403)
    expect(await run(makeEvent('POST', api(LANDING, '/blessings')))).toBe(403)
  })

  it('landingWeddingId 是空字串 → 沒有例外，一樣要簽章', async () => {
    config.public.landingWeddingId = ''
    expect(await run(makeEvent('GET', api(LANDING, '/rsvp-config')))).toBe(403)
  })

  it('新人那場的管理端路由不受影響 → 401', async () => {
    expect(await run(makeEvent('GET', api(LANDING, '/guests')))).toBe(401)
  })
})

describe('auth 中介層：訪客身上帶的登入（enforced）', () => {
  it('無效的 token 打新人那場的 open 路由 → 當成沒登入放行', async () => {
    const event = makeEvent('GET', api(LANDING, '/rsvp-config'), 'expired')
    expect(await run(event)).toBe(0)
    expect(event.context.authUser).toBeUndefined()
  })

  it('無效的 token 打其他路由 → 401', async () => {
    expect(await run(makeEvent('GET', api(LANDING, '/guests/display-names'), 'expired'))).toBe(401)
    expect(await run(makeEvent('GET', api(OTHER, '/rsvp-config'), 'expired'))).toBe(401)
  })

  it('綁在別場的接待員打新人那場的 open 路由 → 當成沒登入放行、不掛 authUser', async () => {
    loginAsReceptionist(OTHER)
    const event = makeEvent('GET', api(LANDING), 'valid')
    expect(await run(event)).toBe(0)
    expect(event.context.authUser).toBeUndefined()
  })

  it('綁在別場的接待員打新人那場沒標 open 的路由 → 403', async () => {
    loginAsReceptionist(OTHER)
    expect(await run(makeEvent('GET', api(LANDING, '/guests/display-names'), 'valid'))).toBe(403)
    expect(await run(makeEvent('GET', api(LANDING, '/guests'), 'valid'))).toBe(403)
  })

  it('綁在新人那場的接待員 → 照舊走登入身分', async () => {
    loginAsReceptionist(LANDING)
    const event = makeEvent('GET', api(LANDING), 'valid')
    expect(await run(event)).toBe(0)
    expect(event.context.authUser).toMatchObject({ userId: 'acc-1', role: '接待員', weddingId: LANDING })
  })
})
