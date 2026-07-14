// app/composables/useSeatingChartExport.ts
// 下載桌次圖（issue #73 自 seating.vue 拆出，行為不變）：
// 以 canvas 依桌位 positionX/Y 畫圓桌地圖（標餐點分類、不含賓客姓名），匯出 JPEG / PDF
// 餐廳人員據此知道哪桌在哪、各桌素葷與兒童需求
import type { MaybeRefOrGetter } from 'vue'
import type { SeatingMath } from '~/composables/useSeatingMath'
import type { TableListItem, VenueMarkerListItem } from '~/types/api/seating'

// 桌次圖 canvas 配色：對齊 main.css 設計 token，使下載圖與畫面語意色（cls）一致
const CHART = {
  paper: '#ffffff', // 列印白底
  ink: '#111111', // 主標 / 桌名（ink）
  inkSoft: '#6B655C', // 副標（ink-500）
  inkFaint: '#A8A096', // 舞台 / 次要（ink-300）
  line: '#DCD4C7', // 舞台框（line）
  empty: { fill: '#FAF7F1', stroke: '#DCD4C7', text: '#A8A096' }, // paper / line / ink-300
  veg: { fill: '#E0E8E1', stroke: '#3D4E41', text: '#323F35' }, // success 100 / 600 / 700
  meat: { fill: '#DCE3EC', stroke: '#344358', text: '#2B3748' }, // info 100 / 600 / 700
  mixed: { fill: '#F4EAD3', stroke: '#B8965A', text: '#9A7B43' }, // primary 100 / 500(gold) / 600(gold-deep)
} as const

// A4 直式畫布尺寸（pt；下載時整頁縮放讓所有桌次塞進一頁）
const A4_W = 595
const A4_H = 842

interface ChartExportDeps {
  weddingId: MaybeRefOrGetter<string>
  tables: MaybeRefOrGetter<TableListItem[] | null | undefined>
  venueMarkers: MaybeRefOrGetter<VenueMarkerListItem[] | null | undefined>
  math: Pick<SeatingMath, 'tableSeats' | 'guestById' | 'mainTable' | 'isMainTable'>
  // 位置以畫布當下呈現為準（拖曳中的本地覆寫也一併採用）
  tablePos: (table: TableListItem) => { x: number, y: number }
  markerPos: (marker: VenueMarkerListItem) => { x: number, y: number }
}

export function useSeatingChartExport(deps: ChartExportDeps) {
  const toast = useToast()
  const { tableSeats, guestById, mainTable, isMainTable } = deps.math
  const tables = computed(() => toValue(deps.tables) ?? [])
  const venueMarkers = computed(() => toValue(deps.venueMarkers) ?? [])

  // === 備餐統計與分類（供桌次圖標示與下載地圖）===
  // 大人 = 正常席（吃大人餐，依賓客葷素分流）；小孩 = 兒童椅嬰兒（不佔正常席、不吃大人餐）
  interface TableMeal { veg: number, meat: number, child: number, adults: number }
  function tableMeal(tableId: string): TableMeal {
    let veg = 0
    let meat = 0
    let child = 0
    for (const s of tableSeats(tableId)) {
      if (s.seatType === 'childChair') {
        child++
        continue
      }
      if (guestById(s.guestId)?.diet === 'vegetarian')
        veg++
      else
        meat++
    }
    return { veg, meat, child, adults: veg + meat }
  }

  // 餐點分類：尚無入座 / 全素食桌 / 全葷食桌 / 葷食桌（含 N 位素食）。cls 供畫面、fill/stroke/text 供 canvas（對齊 CHART token）
  type MealCatKey = 'empty' | 'veg' | 'meat' | 'mixed'
  interface MealCategory { key: MealCatKey, label: string, cls: string, fill: string, stroke: string, text: string }
  function mealCategory(tableId: string): MealCategory {
    const m = tableMeal(tableId)
    if (m.adults === 0)
      return { key: 'empty', label: '尚無入座', cls: 'border-line text-ink-300', ...CHART.empty }
    if (m.meat === 0)
      return { key: 'veg', label: '全素食桌', cls: 'border-success-600 text-success-700', ...CHART.veg }
    if (m.veg === 0)
      return { key: 'meat', label: '全葷食桌', cls: 'border-info-600 text-info-700', ...CHART.meat }
    return { key: 'mixed', label: `葷食桌（含素 ${m.veg}）`, cls: 'border-gold text-gold-deep', ...CHART.mixed }
  }

  // 全場備餐總計（地圖抬頭）
  const totalMeal = computed(() => {
    let veg = 0
    let meat = 0
    let child = 0
    for (const t of tables.value) {
      const m = tableMeal(t.tableId)
      veg += m.veg
      meat += m.meat
      child += m.child
    }
    return { veg, meat, child }
  })

  // 地圖桌序：主桌排前
  const chartTables = computed(() => {
    const main = mainTable.value
    const rest = tables.value.filter(t => t.tableId !== main?.tableId)
    return main ? [main, ...rest] : rest
  })

  function buildChartCanvas(): HTMLCanvasElement {
    const list = chartTables.value
    const M = 24
    const TITLE_H = 70
    const dpr = 4 // 高解析，列印清晰
    const canvas = document.createElement('canvas')
    canvas.width = A4_W * dpr
    canvas.height = A4_H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = CHART.paper
    ctx.fillRect(0, 0, A4_W, A4_H)
    const FONT = 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif'

    // 抬頭、總計、圖例（固定於頁首）
    ctx.fillStyle = CHART.ink
    ctx.font = `600 16px ${FONT}`
    ctx.fillText('桌次圖 · 備餐需求', M, 24)
    ctx.font = `9px ${FONT}`
    ctx.fillStyle = CHART.inkSoft
    ctx.fillText(`素食 ${totalMeal.value.veg} 份 · 葷食 ${totalMeal.value.meat} 份 · 兒童椅 ${totalMeal.value.child}`, M, 40)
    let lx = M
    for (const item of [{ c: CHART.veg.stroke, t: '全素食桌' }, { c: CHART.mixed.stroke, t: '葷食含素' }, { c: CHART.meat.stroke, t: '全葷食桌' }]) {
      ctx.fillStyle = item.c
      ctx.beginPath()
      ctx.arc(lx + 4, 53, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = CHART.inkSoft
      ctx.fillText(item.t, lx + 12, 56)
      lx += 12 + ctx.measureText(item.t).width + 14
    }

    if (list.length === 0)
      return canvas

    // 緊湊重排（桌間距固定縮小、不沿用畫面上的鬆散座標）：
    // 主桌置頂置中，其餘依「男左女右」分兩欄、各欄依原 Y 序由上而下密排。
    const centerXOf = (t: TableListItem) => t.positionX + (isMainTable(t) ? 100 : 84)
    const main = list.find(t => isMainTable(t)) ?? null
    const others = list.filter(t => !isMainTable(t))
    const xs = others.map(centerXOf)
    const axis = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0
    const leftCol = others.filter(t => centerXOf(t) <= axis).sort((a, b) => a.positionY - b.positionY)
    const rightCol = others.filter(t => centerXOf(t) > axis).sort((a, b) => a.positionY - b.positionY)

    const R = 54
    const RM = 70
    const colStep = 2 * R + 36 // 欄距 = 圓桌直徑 + 緊密間隙
    const rowStep = 2 * R + 28 // 列距 = 圓桌直徑 + 緊密間隙
    const leftCx = R
    const rightCx = R + colStep
    const STAGE_H = 26
    interface ChartItem { t: TableListItem, cx: number, cy: number, r: number, isMain: boolean }
    const items: ChartItem[] = []
    if (main)
      items.push({ t: main, cx: (leftCx + rightCx) / 2, cy: STAGE_H + RM, r: RM, isMain: true })
    const startY = STAGE_H + (main ? 2 * RM + 26 : 0) + R
    const rowCount = Math.max(leftCol.length, rightCol.length)
    for (let i = 0; i < rowCount; i++) {
      const cy = startY + i * rowStep
      if (leftCol[i])
        items.push({ t: leftCol[i]!, cx: leftCx, cy, r: R, isMain: false })
      if (rightCol[i])
        items.push({ t: rightCol[i]!, cx: rightCx, cy, r: R, isMain: false })
    }

    // 內容範圍 → 等比縮放置中塞進可用區
    let minX = Infinity
    const minY = 0
    let maxX = -Infinity
    let maxY = -Infinity
    for (const it of items) {
      minX = Math.min(minX, it.cx - it.r)
      maxX = Math.max(maxX, it.cx + it.r)
      maxY = Math.max(maxY, it.cy + it.r)
    }
    const contentW = Math.max(1, maxX - minX)
    const contentH = Math.max(1, maxY - minY)
    const availW = A4_W - M * 2
    const availH = A4_H - TITLE_H - M
    const scale = Math.min(availW / contentW, availH / contentH)
    const baseX = M + (availW - contentW * scale) / 2 - minX * scale
    const baseY = TITLE_H + (availH - contentH * scale) / 2 - minY * scale

    // 舞台（內容頂端置中）
    const stageCx = baseX + ((minX + maxX) / 2) * scale
    ctx.strokeStyle = CHART.line
    ctx.setLineDash([4, 3])
    ctx.strokeRect(stageCx - 30, baseY + 2, 60, 16)
    ctx.setLineDash([])
    ctx.textAlign = 'center'
    ctx.fillStyle = CHART.inkFaint
    ctx.font = `9px ${FONT}`
    ctx.fillText('舞台', stageCx, baseY + 13)

    // 桌次圓（位置、半徑、字級皆隨整體縮放）
    for (const it of items) {
      const cx = baseX + it.cx * scale
      const cy = baseY + it.cy * scale
      const r = it.r * scale
      const cat = mealCategory(it.t.tableId)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = cat.fill
      ctx.fill()
      ctx.lineWidth = Math.max(0.8, (it.isMain ? 3 : 2) * scale)
      ctx.strokeStyle = cat.stroke
      ctx.stroke()
      const child = tableMeal(it.t.tableId).child
      const nameFont = Math.max(8, (it.isMain ? 17 : 14) * scale)
      const subFont = Math.max(7, 11 * scale)
      ctx.fillStyle = CHART.ink
      ctx.font = `600 ${nameFont}px ${FONT}`
      ctx.fillText(it.t.tableName, cx, cy - (child > 0 ? subFont + 2 : subFont * 0.4), r * 1.7)
      ctx.font = `${subFont}px ${FONT}`
      ctx.fillStyle = cat.text
      ctx.fillText(cat.label, cx, cy + (child > 0 ? subFont * 0.2 : subFont), r * 1.85)
      if (child > 0) {
        ctx.fillStyle = CHART.veg.stroke
        ctx.fillText(`兒童椅 ${child}`, cx, cy + subFont * 1.6, r * 1.85)
      }
    }

    // 場地標記：下載圖是緊湊重排、無法 1:1 對位 → 以「螢幕座標正規化 0..1 → chart 內容框映射」
    // 保留相對方位（右側送客區仍在右側），以虛線矩形＋label 呈現（比照舞台樣式）
    const markers = venueMarkers.value
    if (markers.length > 0) {
      const SCREEN_BLOCK = 290
      let sMinX = Infinity
      let sMinY = Infinity
      let sMaxX = -Infinity
      let sMaxY = -Infinity
      for (const t of list) {
        const p = deps.tablePos(t)
        sMinX = Math.min(sMinX, p.x)
        sMinY = Math.min(sMinY, p.y)
        sMaxX = Math.max(sMaxX, p.x + SCREEN_BLOCK)
        sMaxY = Math.max(sMaxY, p.y + SCREEN_BLOCK)
      }
      const sW = Math.max(1, sMaxX - sMinX)
      const sH = Math.max(1, sMaxY - sMinY)
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = CHART.line
      ctx.font = `9px ${FONT}`
      for (const m of markers) {
        const p = deps.markerPos(m)
        const nx = Math.min(1, Math.max(0, (p.x + m.width / 2 - sMinX) / sW))
        const ny = Math.min(1, Math.max(0, (p.y + m.height / 2 - sMinY) / sH))
        const mcx = baseX + (minX + nx * contentW) * scale
        const mcy = baseY + (minY + ny * contentH) * scale
        const mw = Math.min(80, Math.max(32, m.width * 0.4))
        const mh = Math.min(28, Math.max(14, m.height * 0.4))
        ctx.strokeRect(mcx - mw / 2, mcy - mh / 2, mw, mh)
        ctx.fillStyle = CHART.inkFaint
        ctx.fillText(m.label, mcx, mcy + 3, mw - 4)
      }
      ctx.setLineDash([])
    }

    ctx.textAlign = 'start'
    return canvas
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadChartJpeg() {
    buildChartCanvas().toBlob(
      (blob) => {
        if (blob)
          triggerDownload(blob, `桌次圖-${toValue(deps.weddingId)}.jpg`)
        else
          toast.add({ title: '產生圖片失敗，請稍後再試', color: 'error' })
      },
      'image/jpeg',
      0.92,
    )
  }

  // 自製單張影像 PDF：內嵌 canvas 匯出的 JPEG（DCTDecode），免裝套件
  function downloadChartPdf() {
    const canvas = buildChartCanvas()
    const bin = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1] ?? '')
    const jpeg = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++)
      jpeg[i] = bin.charCodeAt(i)

    const enc = (s: string) => new TextEncoder().encode(s)
    const parts: Uint8Array[] = []
    let offset = 0
    const push = (u8: Uint8Array) => {
      parts.push(u8)
      offset += u8.length
    }
    const xref: number[] = []
    const obj = (num: number, head: string, stream?: Uint8Array) => {
      xref[num] = offset
      push(enc(`${num} 0 obj\n${head}`))
      if (stream) {
        push(enc('\nstream\n'))
        push(stream)
        push(enc('\nendstream'))
      }
      push(enc('\nendobj\n'))
    }
    // 頁面用 A4 點數，影像填滿整頁（canvas 本身即 A4 比例，故不變形）
    const content = `q\n${A4_W} 0 0 ${A4_H} 0 0 cm\n/Im0 Do\nQ\n`

    push(enc('%PDF-1.3\n'))
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`)
    obj(4, `<< /Length ${content.length} >>`, enc(content))
    obj(5, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg)
    const xrefStart = offset
    let xs = 'xref\n0 6\n0000000000 65535 f \n'
    for (let i = 1; i <= 5; i++)
      xs += `${String(xref[i]).padStart(10, '0')} 00000 n \n`
    push(enc(xs))
    push(enc(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`))

    triggerDownload(new Blob(parts as BlobPart[], { type: 'application/pdf' }), `桌次圖-${toValue(deps.weddingId)}.pdf`)
  }

  // 下載桌次圖下拉選單：JPEG / PDF
  const downloadItems = [[
    { label: '下載 JPEG', icon: 'i-heroicons-photo', onSelect: () => downloadChartJpeg() },
    { label: '下載 PDF', icon: 'i-heroicons-document-text', onSelect: () => downloadChartPdf() },
  ]]

  return { downloadItems, downloadChartJpeg, downloadChartPdf }
}
