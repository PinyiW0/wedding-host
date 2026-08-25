#!/usr/bin/env node
// 視覺層級硬規則檢查（規範：.claude/rules/visual-hierarchy.md ＋ spec/ui-config/creative-direction.md §3/§4）
// 只檢查可機器判定的違規，語意層級（一頁一主標等）仍由規範文件約束。
// 公開頁（PUBLIC_DIRS，對齊 auth.global.ts 賓客面向路徑）依 creative-direction.md §3
// 放行 display 級規則，改用 publicPattern 檢查（text-8xl+、font-extralight 以下仍禁）。
// 色彩／動效規則只掃 Tailwind class 字面值；<style> 區塊與複合 shadow 中段的色值不在範圍。
// 由 npm run eslint 串跑；違規列出 file:line 並以 exit 1 失敗。

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const SCAN_DIR = 'app'

// transition 任意值允許的屬性（paint/composite 層；layout 屬性動畫走 transform 取代）
const TRANSITION_ALLOW = new Set(['color', 'background-color', 'border-color', 'opacity', 'transform', 'translate', 'scale', 'rotate', 'box-shadow', 'filter', 'backdrop-filter', 'outline-color', 'text-decoration-color', 'fill', 'stroke'])
const TRANSITION_ARBITRARY = /\btransition-\[([^\]]+)\]/

const RULES = [
  {
    pattern: /\btext-\[\d+(?:\.\d+)?(?:px|rem|em|pt)\]/,
    message: '任意值字級（text-[Npx]）——改用內建字級，或先在 @theme 定義具名 token',
  },
  {
    pattern: /\bfont-(?:thin|extralight|light)\b/,
    message: 'font-light 以下字重——小字不可讀，最低用 font-normal',
    publicPattern: /\bfont-(?:thin|extralight)\b/,
    publicMessage: 'font-extralight 以下字重——公開頁僅 font-light 可配 display 大字（creative-direction.md §3）',
  },
  {
    pattern: /\btext-(?:5xl|6xl|7xl|8xl|9xl)\b/,
    message: 'text-5xl 以上——後台介面最大 text-3xl（統計數值）',
    publicPattern: /\btext-(?:8xl|9xl)\b/,
    publicMessage: 'text-8xl 以上——公開頁 display 上限 text-7xl（creative-direction.md §3）',
  },
  {
    pattern: /\boutline-none\b/,
    message: 'outline-none 未補 focus-visible 替代——鍵盤使用者會失去焦點指示',
    exempt: line => line.includes('focus-visible'),
  },
  {
    pattern: /-\[(?:#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|oklab|lch|lab|hwb|color)\()/,
    message: 'Tailwind class 任意值色彩（-[#hex]／rgb()…）——用語意色或 @theme token',
  },
  {
    pattern: /\btransition-all\b/,
    message: 'transition-all——改用 transition 或列舉具體屬性（只動 paint/composite 屬性）',
  },
  {
    pattern: /\btransition-\[[^\]]+\]/,
    message: 'transition 任意值含白名單外屬性——只動 transform/opacity 等 paint/composite 屬性（creative-direction.md §4）',
    exempt: (line) => {
      const m = line.match(TRANSITION_ARBITRARY)
      return !m || m[1].split(',').every(p => TRANSITION_ALLOW.has(p.trim()))
    },
  },
  {
    pattern: /\b(?:duration|ease|delay)-\[/,
    message: 'duration/ease/delay 任意值——duration 用內建三檔（150/250/400），easing 用 @theme motion token（creative-direction.md §4）',
  },
  {
    pattern: /\bbg-clip-text\b/,
    message: 'gradient text（bg-clip-text）——AI 模板味，禁用（creative-direction.md §3）',
  },
]

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return []
  }
  return entries.flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory())
      return walk(path)
    return e.name.endsWith('.vue') ? [path] : []
  })
}

// 本專案無 (public) route group：公開頁判定對齊 auth.global.ts 的 PUBLIC_PATTERNS
// 賓客面向路徑（login/register 屬後台入口，維持後台規則）
const PUBLIC_DIRS = ['rsvp', 'checkin', 'blessing', 'guest', 'flowers', 'thankyou', 'projection', 'rundown', 'schedule', 'story']
const PUBLIC_PREFIXES = PUBLIC_DIRS.map(d => join(SCAN_DIR, 'pages', d))

const files = walk(SCAN_DIR)
const violations = []

for (const file of files) {
  const isPublic = PUBLIC_PREFIXES.some(p => file === `${p}.vue` || file.startsWith(`${p}/`))
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      const pattern = isPublic && rule.publicPattern ? rule.publicPattern : rule.pattern
      const message = isPublic && rule.publicMessage ? rule.publicMessage : rule.message
      if (pattern.test(line) && !rule.exempt?.(line))
        violations.push(`${file}:${i + 1} ${message}`)
    }
  })
}

if (violations.length) {
  console.error(`視覺層級檢查失敗：\n${violations.map(v => `  ${v}`).join('\n')}`)
  process.exit(1)
}
console.log(`視覺層級檢查通過（掃描 ${files.length} 個 .vue 檔）`)
