#!/usr/bin/env node
// README 演示素材產生器：重錄 docs/demo/*.gif 與 docs/screenshots/*.png
//
// 前置：dev server 需先啟動（另開終端跑 npm run dev），預設打 http://localhost:3000
//       要改位址帶 CAPTURE_BASE_URL=http://localhost:3333 npm run capture:demo
// 副作用：開頭會呼叫 /api/__test__/reset —— 本機 DB 會被清空並重置為 seed 資料，
//         手動建的資料會消失（與跑 E2E 相同的代價）。
//
// GIF 產生方式（無系統依賴，不需 ffmpeg）：
//   Playwright 逐幀截圖 → 送進一個 about:blank 分頁，用 canvas 解碼成 RGBA
//   → gifenc 量化編碼 → 回傳 GIF bytes。編碼全程在瀏覽器內，避免每幀把
//   數 MB 的 RGBA 搬回 Node。

import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000'
const DEMO_DIR = resolve(ROOT, 'docs/demo')
const SHOT_DIR = resolve(ROOT, 'docs/screenshots')

// 示範帳號（README「本機啟動」段落用的同一組）與示範婚禮
const ACCOUNT = { username: 'couple', password: 'couple1122' }
const WEDDING_ID = 'wedding-001'

// 錄製／截圖用的 viewport，與 docs/screenshots 既有素材同尺寸（後台 1600×1000、手機 390×844@2x）
const DESKTOP = { width: 1600, height: 1000 }
const MOBILE = { width: 390, height: 844 }
// GIF 輸出尺寸：兩者都是來源的等比縮放（1600×1000 → 880×550；手機 @2x 截圖縮回 1×）
const DESKTOP_GIF = { width: 880, height: 550 }
const MOBILE_GIF = { width: 390, height: 844 }

const FPS = 8

/** 隱藏 dev server 的 Nuxt DevTools 浮標，避免入鏡 */
async function hideDevtools(ctx) {
  await ctx.addInitScript(() => {
    const inject = () => {
      if (document.getElementById('__capture-hide'))
        return
      const style = document.createElement('style')
      style.id = '__capture-hide'
      style.textContent = '#nuxt-devtools-container, nuxt-devtools-inspect-panel { display: none !important; }'
      document.head?.appendChild(style)
    }
    if (document.head)
      inject()
    else document.addEventListener('DOMContentLoaded', inject)
  })
}

// ===== GIF 編碼（瀏覽器端）=====

/** 開一個 about:blank 分頁當編碼器，注入 gifenc */
async function createEncoder(browser) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('about:blank')

  const src = await readFile(resolve(ROOT, 'node_modules/gifenc/dist/gifenc.esm.js'), 'utf8')
  // 以 blob URL 動態 import，不依賴 gifenc 打包後的內部變數名
  await page.evaluate(async (code) => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    window.gifenc = await import(url)
  }, src)

  return page
}

/**
 * 把一組 PNG frame 編成 GIF。
 * frames: [{ png: Buffer, delay: number }]，delay 為該幀停留毫秒
 * colors: 調色盤色數，畫面文字密集的頁面調低可壓檔案（本專案配色低彩度，128 色看不出差別）
 */
async function encodeGif(encoder, frames, { width, height, colors = 256 }) {
  await encoder.evaluate(({ w, h }) => {
    window.__enc = window.gifenc.GIFEncoder()
    window.__canvas = new OffscreenCanvas(w, h)
    window.__ctx = window.__canvas.getContext('2d', { willReadFrequently: true })
  }, { w: width, h: height })

  for (const frame of frames) {
    await encoder.evaluate(async ({ b64, w, h, delay, colors }) => {
      const res = await fetch(`data:image/png;base64,${b64}`)
      const bitmap = await createImageBitmap(await res.blob())
      window.__ctx.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()

      const { data } = window.__ctx.getImageData(0, 0, w, h)
      const palette = window.gifenc.quantize(data, colors)
      const index = window.gifenc.applyPalette(data, palette)
      window.__enc.writeFrame(index, w, h, { palette, delay })
    }, { b64: frame.png.toString('base64'), w: width, h: height, delay: frame.delay, colors })
  }

  const b64 = await encoder.evaluate(() => {
    window.__enc.finish()
    const bytes = window.__enc.bytes()
    let s = ''
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    return btoa(s)
  })

  return Buffer.from(b64, 'base64')
}

// ===== 錄製（背景截圖 loop）=====

/**
 * 開始逐幀截圖，回傳 stop()。
 * 用實際採樣間隔當每幀 delay，播放速度才與真實操作一致。
 */
function startRecording(page) {
  const frames = []
  const state = { running: true }
  let lastAt = Date.now()

  const loop = (async () => {
    while (state.running) {
      const startedAt = Date.now()
      const png = await page.screenshot({ type: 'png', animations: 'allow' }).catch(() => null)
      if (!png)
        break

      const now = Date.now()
      frames.push({ png, delay: Math.min(200, Math.max(20, now - lastAt)) })
      lastAt = now

      const rest = 1000 / FPS - (Date.now() - startedAt)
      if (rest > 0)
        await new Promise(r => setTimeout(r, rest))
    }
  })()

  return async () => {
    state.running = false
    await loop
    return frames
  }
}

async function writeGif(encoder, frames, size, name) {
  const gif = await encodeGif(encoder, frames, size)
  const path = resolve(DEMO_DIR, name)
  await writeFile(path, gif)
  const mb = (gif.length / 1024 / 1024).toFixed(2)
  console.log(`✓ ${name}（${frames.length} 幀，${size.width}×${size.height}，${mb} MB）`)
  return gif.length
}

async function shoot(page, name, waitMs = 600) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(waitMs)
  await page.screenshot({ path: resolve(SHOT_DIR, name) })
  console.log(`✓ ${name}`)
}

// ===== 劇本 =====

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByTestId('login-account').fill(ACCOUNT.username)
  await page.getByTestId('login-password').fill(ACCOUNT.password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))
}

/**
 * 桌次排席：先手動安排一位賓客入座，再用「推薦排序」帶完其餘。
 *
 * 手動入座走「點選賓客 → 點桌上空位」這條路徑（頁面同時支援拖曳，但拖曳過程錄不出來：
 * Playwright 截圖不含滑鼠游標，原生 HTML5 DnD 也不會渲染 drag image）。
 * 點選路徑有「待放置：<賓客>」提示條，狀態變化在 GIF 上看得見。
 */
async function recordSeating(page, encoder) {
  await page.goto(`${BASE}/weddings/${WEDDING_ID}/seating`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const stop = startRecording(page)
  await page.waitForTimeout(500)

  // 手動入座：點名單上的新郎 → 點主桌空位
  await page.getByTestId('vibe-seating-guest-guest-101').click()
  await page.waitForTimeout(900) // 停在「待放置」提示，讓這步看得清楚
  await page.getByTestId('table-001-empty-1').click()
  await page.waitForTimeout(1100)

  // 其餘交給推薦排序
  await page.getByTestId('vibe-seating-recommend').click()
  await page.waitForTimeout(2000) // 自動帶位 + 圓桌逐一填滿的重繪
  await page.waitForTimeout(700) // 結果停留（連同上方色數，是控制檔案大小的兩個旋鈕）

  return writeGif(encoder, await stop(), { ...DESKTOP_GIF, colors: 128 }, 'seating.gif')
}

/** 祝福審核 → 投影牆：後台通過一則，切到投影牆看跑馬燈 */
async function recordProjection(page, encoder) {
  await page.goto(`${BASE}/weddings/${WEDDING_ID}/blessings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  const stop = startRecording(page)
  await page.waitForTimeout(700)

  // 逐則通過待審祝福（「通過」會先開確認框，需再點確認才送出）
  for (let i = 0; i < 2; i++) {
    const approve = page.locator('[data-testid^="blessing-approve-"]').first()
    if (!await approve.count())
      break
    await approve.click()
    await page.getByTestId('confirm-ok').click()
    await page.waitForTimeout(1100)
  }

  // 推一則到投影即時牆
  const project = page.locator('[data-testid^="blessing-project-"]').first()
  if (await project.count()) {
    await project.click()
    await page.waitForTimeout(1200)
  }

  await page.goto(`${BASE}/projection/${WEDDING_ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4500) // 跑馬燈跑一段

  return writeGif(encoder, await stop(), DESKTOP_GIF, 'projection.gif')
}

/** 賓客 RSVP：填出席資訊 → 手繪小花 → 送出 */
async function recordRsvp(page, encoder) {
  await page.goto(`${BASE}/rsvp/public/${WEDDING_ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const stop = startRecording(page)
  await page.waitForTimeout(700)

  await page.getByTestId('rsvp-guest-name').fill('林宜蓁')
  await page.waitForTimeout(400)
  await page.getByTestId('rsvp-phone').fill('0912345678')
  await page.waitForTimeout(600)

  // 捲到畫花區並畫一朵小花
  const canvas = page.getByTestId('rsvp-flower-canvas')
  await canvas.scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await drawFlower(page, canvas)
  await page.waitForTimeout(700)

  // 送出回覆 → 這朵花會種進祝福花田
  await page.getByTestId('rsvp-submit').click()
  await page.getByTestId('rsvp-submit-success').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1600)

  return writeGif(encoder, await stop(), MOBILE_GIF, 'rsvp.gif')
}

/** 在畫布上畫一朵五瓣小花：五片花瓣各畫一圈，中心補一個花心（分段移動才錄得到筆觸） */
async function drawFlower(page, canvas) {
  const box = await canvas.boundingBox()
  if (!box)
    return

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const spread = Math.min(box.width, box.height) * 0.17 // 花瓣圓心離中心的距離
  const petalR = spread * 0.78

  async function stroke(ox, oy, radius, steps) {
    await page.mouse.move(ox + radius, oy)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2
      await page.mouse.move(ox + Math.cos(t) * radius, oy + Math.sin(t) * radius)
      await page.waitForTimeout(10)
    }
    await page.mouse.up()
  }

  for (let petal = 0; petal < 5; petal++) {
    const angle = (petal / 5) * Math.PI * 2 - Math.PI / 2
    await stroke(cx + Math.cos(angle) * spread, cy + Math.sin(angle) * spread, petalR, 16)
    await page.waitForTimeout(140)
  }
  await stroke(cx, cy, spread * 0.34, 12) // 花心
}

// ===== 主流程 =====

async function main() {
  const res = await fetch(`${BASE}/api/__test__/reset`, { method: 'POST' }).catch(() => null)
  if (!res?.ok) {
    console.error(`× 無法重設 seed（${BASE}）——請先啟動 dev server：npm run dev`)
    process.exit(1)
  }
  console.log('seed 已重設')

  await mkdir(DEMO_DIR, { recursive: true })
  await mkdir(SHOT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const encoder = await createEncoder(browser)

  // --- 後台（已登入）---
  const adminCtx = await browser.newContext({ viewport: DESKTOP, locale: 'zh-TW' })
  await hideDevtools(adminCtx)
  const admin = await adminCtx.newPage()
  await login(admin)

  await recordSeating(admin, encoder)
  await recordProjection(admin, encoder)

  await admin.goto(`${BASE}/weddings/${WEDDING_ID}`, { waitUntil: 'networkidle' })
  await shoot(admin, 'dashboard.png')
  await admin.goto(`${BASE}/weddings/${WEDDING_ID}/guests`, { waitUntil: 'networkidle' })
  await shoot(admin, 'guests.png')
  await admin.goto(`${BASE}/weddings/${WEDDING_ID}/blessings`, { waitUntil: 'networkidle' })
  await shoot(admin, 'blessings.png')
  await admin.goto(`${BASE}/projection/${WEDDING_ID}`, { waitUntil: 'networkidle' })
  await shoot(admin, 'projection.png', 1500)

  // --- 賓客公開頁（未登入，行動裝置尺寸）---
  const guestCtx = await browser.newContext({ viewport: MOBILE, locale: 'zh-TW', isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await hideDevtools(guestCtx)
  const guest = await guestCtx.newPage()

  await recordRsvp(guest, encoder)

  await guest.goto(`${BASE}/rsvp/public/${WEDDING_ID}`, { waitUntil: 'networkidle' })
  await shoot(guest, 'rsvp-mobile.png', 1200)
  await guest.goto(`${BASE}/flowers/${WEDDING_ID}`, { waitUntil: 'networkidle' })
  await shoot(guest, 'flowers-mobile.png', 2000)

  await browser.close()
  console.log('全部完成')
}

await main()
