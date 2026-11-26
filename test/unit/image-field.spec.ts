import type { H3Event } from 'h3'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// 圖片欄位落庫規則（issue #226）：正式環境的資料庫只存網址，不存 base64。
// 2026-11-22 的事故起點就是花圖以 base64 落在賓客表——這支守的是「再也寫不進去」。
const { config, r2, puts } = vi.hoisted(() => ({
  config: { authMode: 'enforced' },
  r2: { configured: true, failing: false, allow: true },
  puts: [] as { key: string, bytes: Uint8Array, contentType: string }[],
}))

interface RuntimeConfigShape { public: Record<string, unknown>, [key: string]: unknown }
mockNuxtImport<() => RuntimeConfigShape>('useRuntimeConfig', original => () => {
  const base = original()
  return { ...base, authMode: config.authMode, public: { ...base.public, r2PublicUrl: 'https://img.example.test' } }
})

type Mod = typeof import('../../server/utils/image-field')
let mod: Mod

const event = {} as H3Event
const WEDDING_ID = 'wedding-test'
// 1×1 透明 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

async function statusOf(run: () => unknown): Promise<number | undefined> {
  try {
    await run()
  }
  catch (error) {
    return (error as { statusCode?: number }).statusCode
  }
  return undefined
}

beforeAll(async () => {
  // Nitro 自動匯入在單元測試環境不存在：補成全域後再載入
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getRequestIP', () => '203.0.113.1')
  vi.stubGlobal('isR2Configured', () => r2.configured)
  vi.stubGlobal('consumeRateLimit', () => r2.allow)
  vi.stubGlobal('putR2Object', async (key: string, bytes: Uint8Array, contentType: string) => {
    if (r2.failing)
      throw new Error('R2 down')
    puts.push({ key, bytes, contentType })
  })
  mod = await import('../../server/utils/image-field')
})

beforeEach(() => {
  config.authMode = 'enforced'
  r2.configured = true
  r2.failing = false
  r2.allow = true
  puts.length = 0
})

describe('storeFlowerDrawing：賓客手繪花落庫前的轉存', () => {
  it('r2 已設定：把 PNG 寫進 R2，回傳 300 字元內的 https 網址', async () => {
    const stored = await mod.storeFlowerDrawing(event, WEDDING_ID, PNG)

    expect(stored).toMatch(/^https:\/\/img\.example\.test\/weddings\/wedding-test\/flower\/[\w-]+\.png$/)
    expect(stored!.length).toBeLessThanOrEqual(300)
    expect(puts).toHaveLength(1)
    expect(puts[0]!.contentType).toBe('image/png')
    expect(stored).toContain(puts[0]!.key)
  })

  it('沒帶花圖（undefined／null／空字串）原樣回傳，不寫 R2', async () => {
    expect(await mod.storeFlowerDrawing(event, WEDDING_ID, undefined)).toBeUndefined()
    expect(await mod.storeFlowerDrawing(event, WEDDING_ID, null)).toBeNull()
    expect(await mod.storeFlowerDrawing(event, WEDDING_ID, '')).toBe('')
    expect(puts).toHaveLength(0)
  })

  it('不是 PNG dataURL（網址、SVG、內容不是 PNG）回 400，不寫 R2', async () => {
    expect(await statusOf(() => mod.storeFlowerDrawing(event, WEDDING_ID, 'https://evil.example/x.png'))).toBe(400)
    expect(await statusOf(() => mod.storeFlowerDrawing(event, WEDDING_ID, 'data:image/svg+xml;base64,PHN2Zy8+'))).toBe(400)
    expect(await statusOf(() => mod.storeFlowerDrawing(event, WEDDING_ID, 'data:image/png;base64,aGVsbG8gd29ybGQ='))).toBe(400)
    expect(puts).toHaveLength(0)
  })

  it('超過 300KB 回 400', async () => {
    const big = `data:image/png;base64,${'A'.repeat(Math.ceil(mod.FLOWER_MAX_BYTES / 3) * 4 + 4)}`
    expect(await statusOf(() => mod.storeFlowerDrawing(event, WEDDING_ID, big))).toBe(400)
  })

  it('超過限流回 429；R2 寫入失敗回 502', async () => {
    r2.allow = false
    expect(await statusOf(() => mod.storeFlowerDrawing(event, WEDDING_ID, PNG))).toBe(429)
    r2.allow = true
    r2.failing = true
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await statusOf(() => mod.storeFlowerDrawing(event, WEDDING_ID, PNG))).toBe(502)
    logged.mockRestore()
  })

  it('r2 未設定的 enforced 環境回 503：不讓 base64 再進正式庫', async () => {
    r2.configured = false
    expect(await statusOf(() => mod.storeFlowerDrawing(event, WEDDING_ID, PNG))).toBe(503)
  })

  it('r2 未設定的本機／E2E（open 模式）維持 dataURL 原樣落庫', async () => {
    r2.configured = false
    config.authMode = 'open'
    expect(await mod.storeFlowerDrawing(event, WEDDING_ID, PNG)).toBe(PNG)
    expect(puts).toHaveLength(0)
  })
})

describe('assertImageRef：管理端圖片欄位只收網址', () => {
  it('enforced：data: 內容與過長字串回 400，網址與空值放行', async () => {
    expect(await statusOf(() => mod.assertImageRef(PNG, '投影照片'))).toBe(400)
    expect(await statusOf(() => mod.assertImageRef(' DATA:image/png;base64,AAAA', '投影照片'))).toBe(400)
    expect(await statusOf(() => mod.assertImageRef(`https://img.example.test/${'a'.repeat(mod.IMAGE_URL_MAX_CHARS)}`, '投影照片'))).toBe(400)
    expect(await statusOf(() => mod.assertImageRef({ a: 1 }, '投影照片'))).toBe(400)
    expect(await statusOf(() => mod.assertImageRef('javascript:alert(1)', '投影照片'))).toBe(400)
    expect(await statusOf(() => mod.assertImageRef('http://img.example.test/a.jpg', '投影照片'))).toBe(400)

    expect(await statusOf(() => mod.assertImageRef('https://img.example.test/weddings/w/projection/a.jpg', '投影照片'))).toBeUndefined()
    expect(await statusOf(() => mod.assertImageRef(null, '投影照片'))).toBeUndefined()
    expect(await statusOf(() => mod.assertImageRef('', '投影照片'))).toBeUndefined()
  })

  it('open 模式（本機／E2E）不檢查，dataURL 照收', async () => {
    config.authMode = 'open'
    expect(await statusOf(() => mod.assertImageRef(PNG, '投影照片'))).toBeUndefined()
  })
})
