import { Buffer } from 'node:buffer'

// 資料庫讀出量計數器（issue #224）：累計每次查詢結果的位元組數，供 E2E 量「輪詢一輪從資料庫拖出多少」。
// 只在非 enforced 模式由 server/db/index.ts 掛上；正式環境不計數、不佔記憶體。
const state = { bytes: 0, queries: 0 }

function sizeOf(value: unknown): number {
  if (value === null || value === undefined)
    return 0
  if (typeof value === 'string')
    return Buffer.byteLength(value)
  if (Buffer.isBuffer(value))
    return value.length
  return Buffer.byteLength(JSON.stringify(value))
}

export function recordDbRows(rows: unknown): void {
  state.queries += 1
  if (!Array.isArray(rows))
    return
  for (const row of rows) {
    const cells = Array.isArray(row) ? row : Object.values(row as Record<string, unknown>)
    for (const cell of cells)
      state.bytes += sizeOf(cell)
  }
}

export function readDbMeter(): { bytes: number, queries: number } {
  return { ...state }
}

export function resetDbMeter(): void {
  state.bytes = 0
  state.queries = 0
}
