// 最小化 ZIP 產生器（STORE 無壓縮）。
// PNG 本身已壓縮，直接打包即可；零依賴，輸出標準 .zip Blob，供前端「下載全部花朵」使用。

// CRC32 查表（zip 每筆 entry 需要）
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++)
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++)
    crc = (CRC_TABLE[(crc ^ bytes[i]!) & 0xFF]! ^ (crc >>> 8)) >>> 0
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** 將多個檔案打包為單一 .zip Blob（STORE，無壓縮） */
export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    // local file header（30 bytes + 檔名）
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034B50, true) // 簽章
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // flags：bit 11 = 檔名為 UTF-8（中文檔名正確解碼）
    lv.setUint16(8, 0, true) // method = 0（store）
    lv.setUint16(10, 0, true) // mod time
    lv.setUint16(12, 0, true) // mod date
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true) // compressed size
    lv.setUint32(22, size, true) // uncompressed size
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // extra length
    local.set(nameBytes, 30)

    parts.push(local, entry.data)

    // central directory record（46 bytes + 檔名）
    const cen = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014B50, true)
    cv.setUint16(4, 20, true) // version made by
    cv.setUint16(6, 20, true) // version needed
    cv.setUint16(8, 0x0800, true) // flags：bit 11 = 檔名為 UTF-8
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true) // extra length
    cv.setUint16(32, 0, true) // comment length
    cv.setUint16(34, 0, true) // disk number
    cv.setUint16(36, 0, true) // internal attrs
    cv.setUint32(38, 0, true) // external attrs
    cv.setUint32(42, offset, true) // local header 偏移
    cen.set(nameBytes, 46)
    central.push(cen)

    offset += local.length + size
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0)

  // end of central directory record（22 bytes）
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054B50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true) // comment length

  // 合併為單一緩衝後輸出（避免 Uint8Array 泛型與 BlobPart 型別摩擦）
  const segments = [...parts, ...central, end]
  const total = segments.reduce((sum, s) => sum + s.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const s of segments) {
    out.set(s, pos)
    pos += s.length
  }
  return new Blob([out.buffer], { type: 'application/zip' })
}

/** dataURL 轉 Uint8Array（支援 base64 與 percent-encoded 文字兩種編碼） */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  if (meta.includes(';base64')) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++)
      bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  return new TextEncoder().encode(decodeURIComponent(payload))
}

const DATA_URL_MIME_RE = /^data:image\/(\w+)/

/** 由 dataURL 的 mime 推導副檔名（canvas 手繪為 png；向量來源為 svg） */
export function dataUrlExt(dataUrl: string): string {
  if (dataUrl.startsWith('data:image/svg'))
    return 'svg'
  const m = dataUrl.match(DATA_URL_MIME_RE)
  return m?.[1] ?? 'png'
}
