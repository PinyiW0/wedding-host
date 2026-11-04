import type { LayoutTableInput, MapLayout } from '~/utils/seatingChartLayout'
import { describe, expect, it } from 'vitest'
import { A4_LONG, A4_SHORT, flowIntoColumns, layoutChartMap, splitGuestName } from '~/utils/seatingChartLayout'

// 窄長場地：主桌在中軸，其餘兩欄 × 9 列（對應正式站那場的擺法）
function narrowVenue(): LayoutTableInput[] {
  const list: LayoutTableInput[] = [{ id: 'main', cx: 400, cy: 300, isMain: true }]
  for (let row = 0; row < 9; row++) {
    list.push({ id: `L${row}`, cx: 200, cy: 520 + row * 290, isMain: false })
    list.push({ id: `R${row}`, cx: 600, cy: 520 + row * 290, isMain: false })
  }
  return list
}

// 寬場地：6 欄 × 2 列
function wideVenue(): LayoutTableInput[] {
  const list: LayoutTableInput[] = []
  for (let col = 0; col < 6; col++) {
    for (let row = 0; row < 2; row++)
      list.push({ id: `T${col}-${row}`, cx: 150 + col * 290, cy: 300 + row * 290, isMain: false })
  }
  return list
}

function minGap(layout: MapLayout) {
  let gap = Infinity
  const ts = layout.tables
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++)
      gap = Math.min(gap, Math.hypot(ts[i]!.x - ts[j]!.x, ts[i]!.y - ts[j]!.y) - ts[i]!.r - ts[j]!.r)
  }
  return gap
}

describe('下載桌次圖版面（issue #201）', () => {
  it('窄長場地用直式，圓比舊版大且彼此不重疊', () => {
    // Arrange
    const tables = narrowVenue()
    const stage = { x: 300, y: 60, width: 200, height: 80 }

    // Act
    const layout = layoutChartMap({ tables, stage, markers: [] })

    // Assert：舊版整場等比縮放，一般桌半徑 = 168 × 0.32 × 縮放
    const oldScale = Math.min((A4_SHORT - 48) / 568, (A4_LONG - 94) / (2840 - 60))
    const oldR = 168 * 0.32 * oldScale
    const plain = layout.tables.find(t => !t.isMain)!
    expect(layout.pageW).toBe(A4_SHORT)
    expect(plain.r).toBeGreaterThan(oldR * 1.6)
    expect(minGap(layout)).toBeGreaterThan(0)
    expect(layout.tables.find(t => t.isMain)!.r).toBeGreaterThan(plain.r)
  })

  it('左欄標籤寫左側、右欄與主桌寫右側，且不超出紙張', () => {
    // Arrange
    const tables = narrowVenue()

    // Act
    const layout = layoutChartMap({ tables, stage: null, markers: [] })

    // Assert
    for (const t of layout.tables) {
      const expected = t.id.startsWith('L') ? 'left' : 'right'
      expect(t.labelSide).toBe(expected)
      const labelEdge = t.labelSide === 'left' ? t.x - t.r - t.labelMaxW : t.x + t.r + t.labelMaxW
      expect(labelEdge).toBeGreaterThanOrEqual(0)
      expect(labelEdge).toBeLessThanOrEqual(layout.pageW)
    }
  })

  it('寬場地改用橫式', () => {
    // Arrange
    const tables = wideVenue()

    // Act
    const layout = layoutChartMap({ tables, stage: null, markers: [] })

    // Assert
    expect(layout.pageW).toBe(A4_LONG)
    expect(minGap(layout)).toBeGreaterThan(0)
  })

  it('x、y 縮放差距不超過 2.5 倍：前後列與左右欄的相對位置維持', () => {
    // Arrange
    const tables = narrowVenue()

    // Act
    const layout = layoutChartMap({ tables, stage: null, markers: [] })

    // Assert：同一組桌在畫布上的 x 間距與 y 間距比例，換到紙上最多被拉 2.5 倍
    const byId = Object.fromEntries(layout.tables.map(t => [t.id, t]))
    const sx = (byId.R0!.x - byId.L0!.x) / 400
    const sy = (byId.L1!.y - byId.L0!.y) / 290
    expect(Math.max(sx / sy, sy / sx)).toBeLessThanOrEqual(2.5 + 1e-6)
    expect(byId.L0!.x).toBeLessThan(byId.main!.x)
    expect(byId.main!.x).toBeLessThan(byId.R0!.x)
  })

  it('只有一桌時半徑停在上限，不會無限放大', () => {
    // Arrange
    const tables = [{ id: 'only', cx: 100, cy: 100, isMain: false }]

    // Act
    const layout = layoutChartMap({ tables, stage: null, markers: [] })

    // Assert
    expect(layout.tables[0]!.r).toBeLessThanOrEqual(40)
    expect(Number.isFinite(layout.tables[0]!.x)).toBe(true)
  })

  it('姓名拆出括號備註，沒有括號就原樣保留', () => {
    expect(splitGuestName('王小明（大伯）')).toEqual({ main: '王小明', note: '大伯' })
    expect(splitGuestName('王小明 (Mickey)')).toEqual({ main: '王小明', note: 'Mickey' })
    expect(splitGuestName('新郎爸爸同學')).toEqual({ main: '新郎爸爸同學', note: '' })
    expect(splitGuestName('（大伯）')).toEqual({ main: '（大伯）', note: '' })
  })

  it('名單卡依欄流排：放不下換欄，三欄滿了換頁', () => {
    // Arrange：欄高 100，每塊 40、間隔 10 → 一欄放 2 塊
    const heights = [40, 40, 40, 40, 40, 40, 40]

    // Act
    const { slots, pages } = flowIntoColumns(heights, 3, 100, 10)

    // Assert
    expect(slots.map(s => `${s.page}-${s.col}`)).toEqual(['0-0', '0-0', '0-1', '0-1', '0-2', '0-2', '1-0'])
    expect(slots[1]!.y).toBe(50)
    expect(pages).toBe(2)
  })
})
