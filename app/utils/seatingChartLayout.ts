// app/utils/seatingChartLayout.ts
// 下載桌次圖的場地版面計算（issue #201）：純函式，單位一律是 pt（A4 = 595 × 842）。
// 原本整場等比縮放塞進 A4 直式，窄長場地左右留白、圓只剩 1.5cm；改成：
//   - 直式／橫式各試一次，取圓比較大的那個
//   - x、y 各自縮放，但兩軸比例差距不超過 maxStretch（前後列、左右欄的相對位置不變）
//   - 圓半徑取「與鄰桌、旁邊標籤不重疊」的最大值
//   - 標籤（葷素、人數）寫在圓外：左半場寫左側、右半場與中軸寫右側；擠不下時改寫在圓下方

export const A4_SHORT = 595
export const A4_LONG = 842

export interface ChartBox { x: number, y: number, width: number, height: number }

// 輸入：桌位圓心（後台畫布座標）
export interface LayoutTableInput { id: string, cx: number, cy: number, isMain: boolean }
export interface LayoutMarkerInput extends ChartBox { label: string }

export type LabelSide = 'left' | 'right' | 'below'

export interface PlacedTable {
  id: string
  isMain: boolean
  x: number
  y: number
  r: number
  labelSide: LabelSide
  // 標籤可用寬度（pt）：繪製時字超過就縮字級，不壓扁
  labelMaxW: number
}

export interface MapLayout {
  pageW: number
  pageH: number
  tables: PlacedTable[]
  stage: ChartBox | null
  markers: LayoutMarkerInput[]
}

export interface MapLayoutOptions {
  headerH: number // 頁首保留高度
  margin: number // 頁邊距
  labelW: number // 圓旁標籤預留寬度
  labelH: number // 圓下標籤預留高度
  gap: number // 圓與圓、圓與標籤的最小間隙
  rMin: number
  rMax: number
  mainRatio: number // 主桌比一般桌大多少
  maxStretch: number // x、y 縮放比例的最大差距倍數
  markerMinH: number // 場地標記最小高度（放得下標籤字）
}

export const DEFAULT_MAP_OPTIONS: MapLayoutOptions = {
  headerH: 78,
  margin: 24,
  labelW: 80,
  labelH: 36,
  gap: 4,
  rMin: 12,
  rMax: 40,
  mainRatio: 1.22,
  maxStretch: 2.5,
  markerMinH: 18,
}

interface Candidate { layout: MapLayout, r: number, mode: 'side' | 'below', scale: number }

// 比較兩個候選版面：圓大的勝；差不到 1pt 視為同大，再比標籤寫旁邊（較好讀），最後比整體縮放（紙張方向較貼合場地）
function better(c: Candidate, best: Candidate | null): boolean {
  if (!best)
    return true
  if (Math.abs(c.r - best.r) > 1)
    return c.r > best.r
  if (c.mode !== best.mode)
    return c.mode === 'side'
  return c.scale > best.scale * 1.05
}

// 點到矩形的距離（圓心在矩形內時為 0）
function distToBox(x: number, y: number, b: ChartBox): number {
  const dx = Math.max(b.x - x, 0, x - (b.x + b.width))
  const dy = Math.max(b.y - y, 0, y - (b.y + b.height))
  return Math.hypot(dx, dy)
}

function buildCandidate(
  input: { tables: LayoutTableInput[], stage: ChartBox | null, markers: LayoutMarkerInput[] },
  pageW: number,
  pageH: number,
  mode: 'side' | 'below',
  o: MapLayoutOptions,
): Candidate {
  // 內容範圍：桌位圓心＋舞台＋標記
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  function cover(x0: number, y0: number, x1: number, y1: number) {
    minX = Math.min(minX, x0)
    minY = Math.min(minY, y0)
    maxX = Math.max(maxX, x1)
    maxY = Math.max(maxY, y1)
  }
  for (const t of input.tables)
    cover(t.cx, t.cy, t.cx, t.cy)
  for (const b of [input.stage, ...input.markers]) {
    if (b)
      cover(b.x, b.y, b.x + b.width, b.y + b.height)
  }
  const spanX = maxX - minX
  const spanY = maxY - minY

  // 半徑影響留白、留白影響縮放：先用 rMax 留白，再以算出的半徑收斂幾輪；實際半徑不超過留白用的估計值
  let rGuess = o.rMax
  let result: Candidate | null = null
  for (let iter = 0; iter < 8; iter++) {
    const padX = rGuess + (mode === 'side' ? o.labelW + o.gap : 0)
    const padY = rGuess + (mode === 'below' ? o.labelH + o.gap : 0)
    const x0 = o.margin + padX
    const y0 = o.headerH + padY
    const innerW = Math.max(1, pageW - o.margin * 2 - padX * 2)
    const innerH = Math.max(1, pageH - o.headerH - o.margin - padY * 2)

    let sx = spanX > 1 ? innerW / spanX : Infinity
    let sy = spanY > 1 ? innerH / spanY : Infinity
    if (!Number.isFinite(sx) && !Number.isFinite(sy)) {
      sx = 1
      sy = 1
    }
    else if (!Number.isFinite(sx)) {
      sx = sy
    }
    else if (!Number.isFinite(sy)) {
      sy = sx
    }
    sx = Math.min(sx, sy * o.maxStretch)
    sy = Math.min(sy, sx * o.maxStretch)

    const offX = x0 + (innerW - spanX * sx) / 2 - minX * sx
    const offY = y0 + (innerH - spanY * sy) / 2 - minY * sy
    // 中軸取桌位左右兩端的中點；離中軸不到桌位寬度 10% 的桌（主桌常在這）算中軸，標籤寫右側
    const tableXs = input.tables.map(t => offX + t.cx * sx)
    const tMinX = Math.min(...tableXs)
    const tMaxX = Math.max(...tableXs)
    const midX = (tMinX + tMaxX) / 2
    const axisTol = Math.max(1, (tMaxX - tMinX) * 0.1)

    const tables: PlacedTable[] = input.tables.map((t) => {
      const x = offX + t.cx * sx
      const labelSide: LabelSide = mode === 'below' ? 'below' : (x < midX - axisTol ? 'left' : 'right')
      return { id: t.id, isMain: t.isMain, x, y: offY + t.cy * sy, r: 0, labelSide, labelMaxW: o.labelW }
    })
    const stage = input.stage
      ? { x: offX + input.stage.x * sx, y: offY + input.stage.y * sy, width: input.stage.width * sx, height: input.stage.height * sy }
      : null
    const markers = input.markers.map((m) => {
      const h = Math.max(m.height * sy, o.markerMinH)
      const cy = offY + (m.y + m.height / 2) * sy
      return { label: m.label, x: offX + m.x * sx, y: cy - h / 2, width: m.width * sx, height: h }
    })

    // 一般桌半徑：任兩桌不重疊，且夾在中間的標籤放得下
    let r = o.rMax
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const a = tables[i]!
        const b = tables[j]!
        const dx = Math.abs(a.x - b.x)
        const dy = Math.abs(a.y - b.y)
        // 主桌另外算，這裡只用一般桌半徑估（主桌那對留到下面）
        if (!a.isMain && !b.isMain)
          r = Math.min(r, Math.hypot(dx, dy) / 2 - o.gap / 2)
        if (mode === 'side') {
          // 標籤夾在兩桌中間、且標籤那幾行的高度碰得到鄰桌的圓，才需要把兩桌間距留給標籤
          const [l, rt] = a.x <= b.x ? [a, b] : [b, a]
          const labelBetween = l.labelSide === 'right' || rt.labelSide === 'left'
          if (labelBetween && dy < rGuess + o.labelH / 2)
            r = Math.min(r, (dx - o.labelW - o.gap * 2) / 2)
        }
        else if (dx < rGuess * 2 + o.gap) {
          // 標籤寫在下方：上下相鄰的兩桌之間要塞得下一組標籤
          r = Math.min(r, (dy - o.labelH - o.gap * 2) / 2)
        }
      }
    }
    // 不壓到舞台與場地標記（後台本來就重疊的不算，否則半徑歸零）
    for (const t of tables) {
      for (const b of [stage, ...markers]) {
        if (!b)
          continue
        const d = distToBox(t.x, t.y, b)
        if (d > o.rMin)
          r = Math.min(r, d - o.gap)
      }
    }
    const rRaw = Math.max(o.rMin, r)
    // 超過留白估計值，圓或標籤會超出紙張
    r = Math.min(rRaw, rGuess)

    // 主桌：大一圈，但不碰鄰桌、舞台
    let rMain = r * o.mainRatio
    const main = tables.find(t => t.isMain)
    if (main) {
      for (const t of tables) {
        if (t !== main)
          rMain = Math.min(rMain, Math.hypot(t.x - main.x, t.y - main.y) - r - o.gap)
      }
      for (const b of [stage, ...markers]) {
        const d = b ? distToBox(main.x, main.y, b) : Infinity
        if (d > o.rMin)
          rMain = Math.min(rMain, d - o.gap)
      }
      rMain = Math.max(r, Math.min(rMain, rGuess * o.mainRatio))
    }

    for (const t of tables) {
      t.r = t.isMain ? rMain : r
      if (mode === 'below') {
        // 下方標籤寬度不超過與同列鄰桌的間距
        let w = o.labelW
        for (const u of tables) {
          if (u !== t && Math.abs(u.y - t.y) < o.labelH + r * 2)
            w = Math.min(w, Math.abs(u.x - t.x) - o.gap)
        }
        t.labelMaxW = Math.max(r * 2, w)
      }
    }

    result = { layout: { pageW, pageH, tables, stage, markers }, r, mode, scale: Math.min(sx, sy) }
    if (rRaw <= rGuess + 0.5 && rGuess - rRaw < 1)
      break
    // 第二輪起取平均，避免在兩個值之間來回跳
    rGuess = iter === 0 ? rRaw : (rGuess + rRaw) / 2
  }
  return result!
}

// 試直式／橫式 × 標籤在旁／在下，取一般桌半徑最大的版面
export function layoutChartMap(
  input: { tables: LayoutTableInput[], stage: ChartBox | null, markers: LayoutMarkerInput[] },
  options: Partial<MapLayoutOptions> = {},
): MapLayout {
  const o = { ...DEFAULT_MAP_OPTIONS, ...options }
  let best: Candidate | null = null
  for (const [w, h] of [[A4_SHORT, A4_LONG], [A4_LONG, A4_SHORT]] as const) {
    for (const mode of ['side', 'below'] as const) {
      const c = buildCandidate(input, w, h, mode, o)
      if (better(c, best))
        best = c
    }
  }
  return best!.layout
}

// 姓名拆出括號備註：「王小明（大伯）」→ 主名＋小字備註
const NAME_NOTE_RE = /^([^（(]+)[（(]([^()（）]+)[)）]\s*$/
export function splitGuestName(name: string): { main: string, note: string } {
  const m = name.match(NAME_NOTE_RE)
  const main = m?.[1]?.trim()
  return m && main ? { main, note: m[2]! } : { main: name, note: '' }
}

// 依欄流排：每塊高度依序往下排，該欄放不下就換下一欄，欄滿換頁。回傳每塊的頁、欄、y
export interface FlowSlot { page: number, col: number, y: number }
export function flowIntoColumns(heights: number[], cols: number, colH: number, gap: number): { slots: FlowSlot[], pages: number } {
  const slots: FlowSlot[] = []
  let page = 0
  let col = 0
  let y = 0
  for (const h of heights) {
    if (y > 0 && y + h > colH) {
      col++
      y = 0
      if (col >= cols) {
        col = 0
        page++
      }
    }
    slots.push({ page, col, y })
    y += h + gap
  }
  return { slots, pages: heights.length === 0 ? 0 : page + 1 }
}
