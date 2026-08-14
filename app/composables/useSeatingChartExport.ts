// app/composables/useSeatingChartExport.ts
// 下載桌次圖（issue #73 自 seating.vue 拆出；issue #101 增賓客名單版）：
// 以 canvas 依桌位 positionX/Y 畫圓桌地圖，匯出 JPEG / PDF。兩個版本共用版面計算：
//   - 備餐地圖：圈內標桌名 + 餐點分類（不含賓客姓名），供餐廳人員知道各桌素葷與兒童需求
//   - 賓客名單：圈內列出該桌所有賓客姓名，供列印／分享的桌位示意圖
import type { MaybeRefOrGetter } from 'vue'
import type { SeatingMath } from '~/composables/useSeatingMath'
import type { CanvasBox } from '~/composables/useVenueCanvasGeometry'
import type { SeatListItem, TableListItem, VenueLayoutDetail, VenueMarkerListItem } from '~/types/api/seating'

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
const M = 24 // 頁邊距
const TITLE_H = 70 // 頁首保留高度（抬頭 + 總計 + 圖例）
const FONT = 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif'

// 桌次圓在畫布座標系中的幾何（圓心 = 桌位格中心，半徑依格寬）
interface ChartItem { t: TableListItem, cx: number, cy: number, r: number, isMain: boolean }
// 版面計算結果：items（各桌畫布座標）+ 縮放與位移（把畫布座標映射到 A4 可用區）
interface ChartLayout {
  items: ChartItem[]
  scale: number
  baseX: number
  baseY: number
  bounds: CanvasBox
  stage: CanvasBox | null
}

interface ChartExportDeps {
  weddingId: MaybeRefOrGetter<string>
  tables: MaybeRefOrGetter<TableListItem[] | null | undefined>
  venueMarkers: MaybeRefOrGetter<VenueMarkerListItem[] | null | undefined>
  // 舞台位置與尺寸：下載圖與畫布同一份佈局，擺位才對得起來
  venueLayout: MaybeRefOrGetter<VenueLayoutDetail | null | undefined>
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

  // 全場已入座人數（賓客名單版抬頭）：所有座位數（含兒童椅、含同組展開）
  const totalSeated = computed(() =>
    tables.value.reduce((n, t) => n + tableSeats(t.tableId).length, 0),
  )

  // 地圖桌序：主桌排前
  const chartTables = computed(() => {
    const main = mainTable.value
    const rest = tables.value.filter(t => t.tableId !== main?.tableId)
    return main ? [main, ...rest] : rest
  })

  // 座位 → 顯示姓名（兒童椅加「(童)」標記）；同組多席各佔一格、重覆列出對齊實際座位數
  function occupantName(seat: SeatListItem): string {
    const name = guestById(seat.guestId)?.name ?? seat.guestId
    return seat.seatType === 'childChair' ? `${name}(童)` : name
  }

  // === 共用版面：直接沿用畫布座標（後台拖曳出來的擺位），整場等比縮放塞進一頁 A4 ===
  // 不再重排成兩欄密排——重排過的圖到了現場對不上場地，排位工作等於白做（issue #151）
  function computeChartLayout(): ChartLayout | null {
    const list = chartTables.value
    if (list.length === 0)
      return null

    const stage = computeStageBox(toValue(deps.venueLayout))
    // 底圖不入列印（列印走白底），只納入桌位、標記與舞台的實際範圍
    const bounds = computeContentBounds({
      tables: list,
      markers: venueMarkers.value,
      tablePos: deps.tablePos,
      markerPos: deps.markerPos,
      isMainTable,
      stageBox: stage,
      refImageBox: null,
    })
    if (!bounds)
      return null

    // 圓桌半徑 = 桌位格的 32%（等同畫面上圓桌佔格 64%），主桌自然大一圈
    const items: ChartItem[] = list.map((t) => {
      const p = deps.tablePos(t)
      const isMain = isMainTable(t)
      const box = tableBoxWidth(isMain)
      return { t, cx: p.x + box / 2, cy: p.y + box / 2, r: box * 0.32, isMain }
    })

    const availW = A4_W - M * 2
    const availH = A4_H - TITLE_H - M
    const scale = Math.min(availW / bounds.width, availH / bounds.height)
    const baseX = M + (availW - bounds.width * scale) / 2 - bounds.x * scale
    const baseY = TITLE_H + (availH - bounds.height * scale) / 2 - bounds.y * scale

    return { items, scale, baseX, baseY, bounds, stage }
  }

  // 舞台：依 venueLayout 的實際位置與尺寸畫；尚未設定佈局時退回內容框頂端置中
  function drawStage(ctx: CanvasRenderingContext2D, layout: ChartLayout) {
    ctx.strokeStyle = CHART.line
    ctx.setLineDash([4, 3])
    ctx.textAlign = 'center'
    ctx.font = `9px ${FONT}`
    const stage = layout.stage
    if (stage) {
      const x = layout.baseX + stage.x * layout.scale
      const y = layout.baseY + stage.y * layout.scale
      const w = stage.width * layout.scale
      const h = stage.height * layout.scale
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
      ctx.fillStyle = CHART.inkFaint
      ctx.fillText('舞台', x + w / 2, y + h / 2 + 3, w - 4)
      return
    }
    const cx = layout.baseX + (layout.bounds.x + layout.bounds.width / 2) * layout.scale
    const top = layout.baseY + layout.bounds.y * layout.scale
    ctx.strokeRect(cx - 30, top + 2, 60, 16)
    ctx.setLineDash([])
    ctx.fillStyle = CHART.inkFaint
    ctx.fillText('舞台', cx, top + 13)
  }

  // 場地標記（門口、送客區等）：與桌位同一組縮放，位置 1:1 對應後台畫布
  function drawMarkers(ctx: CanvasRenderingContext2D, layout: ChartLayout) {
    const markers = venueMarkers.value
    if (markers.length === 0)
      return
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = CHART.line
    ctx.font = `9px ${FONT}`
    for (const m of markers) {
      const p = deps.markerPos(m)
      const x = layout.baseX + p.x * layout.scale
      const y = layout.baseY + p.y * layout.scale
      const w = m.width * layout.scale
      const h = m.height * layout.scale
      ctx.strokeRect(x, y, w, h)
      ctx.fillStyle = CHART.inkFaint
      ctx.fillText(m.label, x + w / 2, y + h / 2 + 3, w - 4)
    }
    ctx.setLineDash([])
  }

  // 桌次圖繪製骨架：白底 A4 → 抬頭（各版本自訂）→ 舞台 → 逐桌畫圓（各版本自訂）→ 場地標記
  function renderChart(
    drawHeader: (ctx: CanvasRenderingContext2D) => void,
    drawTableCircle: (ctx: CanvasRenderingContext2D, it: ChartItem, layout: ChartLayout) => void,
  ): HTMLCanvasElement {
    const dpr = 4 // 高解析，列印清晰
    const canvas = document.createElement('canvas')
    canvas.width = A4_W * dpr
    canvas.height = A4_H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = CHART.paper
    ctx.fillRect(0, 0, A4_W, A4_H)

    drawHeader(ctx) // 抬頭以預設 textAlign='start' 靠左繪製
    const layout = computeChartLayout()
    if (!layout)
      return canvas
    drawStage(ctx, layout) // 之後 textAlign 切為 'center'，供圓桌與標記置中繪製
    for (const it of layout.items)
      drawTableCircle(ctx, it, layout)
    drawMarkers(ctx, layout)
    ctx.textAlign = 'start'
    return canvas
  }

  // 備餐地圖：圈內標桌名 + 餐點分類，圓圈依分類上色（行為同 issue #73）
  function buildChartCanvas(): HTMLCanvasElement {
    return renderChart(
      (ctx) => {
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
      },
      (ctx, it, layout) => {
        const cx = layout.baseX + it.cx * layout.scale
        const cy = layout.baseY + it.cy * layout.scale
        const r = it.r * layout.scale
        const cat = mealCategory(it.t.tableId)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = cat.fill
        ctx.fill()
        ctx.lineWidth = Math.max(0.8, (it.isMain ? 3 : 2) * layout.scale)
        ctx.strokeStyle = cat.stroke
        ctx.stroke()
        const child = tableMeal(it.t.tableId).child
        const nameFont = Math.max(8, (it.isMain ? 17 : 14) * layout.scale)
        const subFont = Math.max(7, 11 * layout.scale)
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
      },
    )
  }

  // 圈內列賓客姓名：桌名置頂、姓名依人數 1～2 欄排列，字級隨圓半徑縮放
  function drawNamesInCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, names: string[]) {
    if (names.length === 0) {
      ctx.fillStyle = CHART.inkFaint
      ctx.font = `${Math.max(7, r * 0.28)}px ${FONT}`
      ctx.textBaseline = 'middle'
      ctx.fillText('尚無入座', cx, cy + r * 0.15, r * 1.4)
      ctx.textBaseline = 'alphabetic'
      return
    }
    const cols = names.length > 5 ? 2 : 1
    const rows = Math.ceil(names.length / cols)
    const top = cy - r * 0.28 // 桌名下方起排
    const bottom = cy + r * 0.8
    const lineH = (bottom - top) / rows
    const nameFont = Math.max(6, Math.min(lineH * 0.72, r * (cols === 1 ? 0.32 : 0.24)))
    ctx.font = `${nameFont}px ${FONT}`
    ctx.fillStyle = CHART.ink
    ctx.textBaseline = 'middle'
    const colGap = r * 0.66 // 兩欄中心間距
    for (let i = 0; i < names.length; i++) {
      const col = cols === 1 ? 0 : Math.floor(i / rows) // 欄優先填滿（左欄由上到下、再右欄）
      const row = cols === 1 ? i : i % rows
      const nx = cols === 1 ? cx : (col === 0 ? cx - colGap / 2 : cx + colGap / 2)
      const ny = top + lineH * (row + 0.5)
      const maxW = cols === 1 ? r * 1.5 : r * 0.72
      ctx.fillText(names[i]!, nx, ny, maxW)
    }
    ctx.textBaseline = 'alphabetic'
  }

  // 賓客名單版：圈內列出該桌所有賓客姓名（可列印／分享的桌位示意圖）
  function buildNameChartCanvas(): HTMLCanvasElement {
    return renderChart(
      (ctx) => {
        ctx.fillStyle = CHART.ink
        ctx.font = `600 16px ${FONT}`
        ctx.fillText('桌次圖 · 賓客名單', M, 24)
        ctx.font = `9px ${FONT}`
        ctx.fillStyle = CHART.inkSoft
        ctx.fillText(`已入座 ${totalSeated.value} 人 · 共 ${tables.value.length} 桌`, M, 40)
      },
      (ctx, it, layout) => {
        const cx = layout.baseX + it.cx * layout.scale
        const cy = layout.baseY + it.cy * layout.scale
        const r = it.r * layout.scale
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = CHART.paper
        ctx.fill()
        ctx.lineWidth = Math.max(0.8, (it.isMain ? 3 : 2) * layout.scale)
        ctx.strokeStyle = it.isMain ? CHART.mixed.stroke : CHART.line
        ctx.stroke()
        // 桌名置於圈內頂端
        const nameFont = Math.max(8, (it.isMain ? 15 : 12) * layout.scale)
        ctx.fillStyle = it.isMain ? CHART.mixed.text : CHART.ink
        ctx.font = `600 ${nameFont}px ${FONT}`
        ctx.fillText(it.t.tableName, cx, cy - r * 0.6, r * 1.6)
        // 賓客姓名（依座號排序）
        const names = tableSeats(it.t.tableId)
          .slice()
          .sort((a, b) => a.seatNumber - b.seatNumber)
          .map(occupantName)
        drawNamesInCircle(ctx, cx, cy, r, names)
      },
    )
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadCanvasJpeg(canvas: HTMLCanvasElement, filename: string) {
    canvas.toBlob(
      (blob) => {
        if (blob)
          triggerDownload(blob, filename)
        else
          toast.add({ title: '產生圖片失敗，請稍後再試', color: 'error' })
      },
      'image/jpeg',
      0.92,
    )
  }

  // 自製單張影像 PDF：內嵌 canvas 匯出的 JPEG（DCTDecode），免裝套件
  function canvasToPdfBlob(canvas: HTMLCanvasElement): Blob {
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

    return new Blob(parts as BlobPart[], { type: 'application/pdf' })
  }

  const wid = () => toValue(deps.weddingId)
  function downloadChartJpeg() {
    downloadCanvasJpeg(buildChartCanvas(), `桌次圖-${wid()}.jpg`)
  }
  function downloadChartPdf() {
    triggerDownload(canvasToPdfBlob(buildChartCanvas()), `桌次圖-${wid()}.pdf`)
  }
  function downloadNameChartJpeg() {
    downloadCanvasJpeg(buildNameChartCanvas(), `桌位示意圖-${wid()}.jpg`)
  }
  function downloadNameChartPdf() {
    triggerDownload(canvasToPdfBlob(buildNameChartCanvas()), `桌位示意圖-${wid()}.pdf`)
  }

  // 下載桌次圖下拉選單：備餐地圖（餐點分類）/ 賓客名單（桌位示意圖），各含 JPEG / PDF
  const downloadItems = [
    [
      { label: '備餐地圖 · JPEG', icon: 'i-heroicons-photo', onSelect: () => downloadChartJpeg() },
      { label: '備餐地圖 · PDF', icon: 'i-heroicons-document-text', onSelect: () => downloadChartPdf() },
    ],
    [
      { label: '賓客名單 · JPEG', icon: 'i-heroicons-photo', onSelect: () => downloadNameChartJpeg() },
      { label: '賓客名單 · PDF', icon: 'i-heroicons-document-text', onSelect: () => downloadNameChartPdf() },
    ],
  ]

  return {
    downloadItems,
    downloadChartJpeg,
    downloadChartPdf,
    downloadNameChartJpeg,
    downloadNameChartPdf,
  }
}
