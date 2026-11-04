// app/composables/useSeatingChartExport.ts
// 下載桌次圖（issue #73 自 seating.vue 拆出；issue #101 增賓客名單版；issue #194 增 Excel 名單；issue #201 改版面）：
// 以 canvas 依桌位 positionX/Y 畫圓桌地圖，匯出 JPEG / PDF。版面計算在 utils/seatingChartLayout.ts：
//   - 備餐地圖（1 頁）：圈內標桌名，圈旁寫葷素分類、大人人數、兒童椅，供餐廳人員備餐
//   - 賓客名單（多頁）：場地圖（圈旁只寫人數）→ 每桌一張名單卡 → 姓名索引（賓客找座位）
//   - 賓客名單 Excel：工作表 1 是「第幾桌坐了誰」的表格，工作表 2 貼場地圖（交給餐廳／接待不必手抄）
import type { MaybeRefOrGetter } from 'vue'
import type { SeatingMath } from '~/composables/useSeatingMath'
import type { TableListItem, VenueLayoutDetail, VenueMarkerListItem } from '~/types/api/seating'
import type { MapLayout, PlacedTable } from '~/utils/seatingChartLayout'
import { createZip, dataUrlToBytes } from '~/utils/zip'

// 桌次圖 canvas 配色：對齊 main.css 設計 token，使下載圖與畫面語意色（cls）一致
const CHART = {
  paper: '#ffffff', // 列印白底
  ink: '#111111', // 主標 / 桌名（ink）
  inkSoft: '#6B655C', // 副標（ink-500）
  inkFaint: '#A8A096', // 舞台 / 次要（ink-300）
  line: '#DCD4C7', // 舞台框（line）
  zone: '#FBF9F5', // 舞台／場地標記底色
  guestStroke: '#8A8378', // 賓客版一般桌框線
  mainCard: '#FBF6EA', // 主桌名單卡底色
  empty: { fill: '#FAF7F1', stroke: '#DCD4C7', text: '#A8A096' }, // paper / line / ink-300
  veg: { fill: '#E0E8E1', stroke: '#3D4E41', text: '#323F35' }, // success 100 / 600 / 700
  child: { fill: '#F3E6E6', text: '#552222' },
  meat: { fill: '#DCE3EC', stroke: '#344358', text: '#2B3748' }, // info 100 / 600 / 700
  mixed: { fill: '#F4EAD3', stroke: '#B8965A', text: '#9A7B43' }, // primary 100 / 500(gold) / 600(gold-deep)
} as const

const M = 24 // 場地圖頁邊距（pt）
const LIST_M = 28 // 名單頁邊距
const LIST_TOP = 62 // 名單頁內容起點（頁首標題＋分隔線之下）
const DPR = 4 // 高解析，列印清晰（A4 約 290dpi）
const FONT = 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif'

// 一頁輸出：canvas 已依 DPR 放大，width／height 是 pt（PDF 頁面尺寸）
interface ChartPage { canvas: HTMLCanvasElement, width: number, height: number }

interface ChartExportDeps {
  weddingId: MaybeRefOrGetter<string>
  tables: MaybeRefOrGetter<TableListItem[] | null | undefined>
  venueMarkers: MaybeRefOrGetter<VenueMarkerListItem[] | null | undefined>
  // 舞台位置與尺寸：下載圖與畫布同一份佈局，擺位才對得起來
  venueLayout: MaybeRefOrGetter<VenueLayoutDetail | null | undefined>
  math: Pick<SeatingMath, 'tableSeats' | 'guestById' | 'mainTable' | 'isMainTable' | 'unseatedGuests' | 'pendingMembers'>
  // 位置以畫布當下呈現為準（拖曳中的本地覆寫也一併採用）
  tablePos: (table: TableListItem) => { x: number, y: number }
  markerPos: (marker: VenueMarkerListItem) => { x: number, y: number }
}

// === canvas 文字工具：字放不下就縮字級，最後才截斷加「…」，絕不橫向壓扁 ===
function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 400, minRatio = 0.7) {
  setFont(ctx, size, weight)
  const w = ctx.measureText(text).width
  if (w <= maxW)
    return { text, size }
  const fitted = Math.max(size * minRatio, size * maxW / w)
  setFont(ctx, fitted, weight)
  if (ctx.measureText(text).width <= maxW)
    return { text, size: fitted }
  const chars = [...text]
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > maxW)
    chars.pop()
  return { text: `${chars.join('')}…`, size: fitted }
}

interface TextStyle { size: number, weight?: number, color: string, align?: CanvasTextAlign, maxW?: number }
// 回傳實際畫出的寬度，供後面接著畫的元素定位
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, s: TextStyle): number {
  const weight = s.weight ?? 400
  const fit = s.maxW ? fitText(ctx, text, s.maxW, s.size, weight) : { text, size: s.size }
  setFont(ctx, fit.size, weight)
  ctx.fillStyle = s.color
  ctx.textAlign = s.align ?? 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(fit.text, x, y)
  return ctx.measureText(fit.text).width
}

// 小標籤（素、兒童椅）：圓角色塊＋字，回傳佔用寬度
function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, color: string): number {
  setFont(ctx, size, 600)
  const w = ctx.measureText(text).width + size * 0.8
  const h = size + 3
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y - h / 2, w, h, 2)
  ctx.fill()
  drawText(ctx, text, x + w / 2, y, { size, weight: 600, color, align: 'center' })
  return w
}

function newPage(width: number, height: number): { page: ChartPage, ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * DPR)
  canvas.height = Math.round(height * DPR)
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)
  ctx.fillStyle = CHART.paper
  ctx.fillRect(0, 0, width, height)
  return { page: { canvas, width, height }, ctx }
}

export function useSeatingChartExport(deps: ChartExportDeps) {
  const toast = useToast()
  const { tableSeats, guestById, mainTable, isMainTable, unseatedGuests, pendingMembers } = deps.math
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
  const seatedTableCount = computed(() => tables.value.filter(t => tableSeats(t.tableId).length > 0).length)

  // 桌序：主桌 1，其餘依桌名自然排序（「第2桌」在「第10桌」前）——名單卡、索引、Excel 共用
  function numberedTables() {
    const main = mainTable.value
    const rest = tables.value
      .filter(t => t.tableId !== main?.tableId)
      .sort((a, b) => a.tableName.localeCompare(b.tableName, 'zh-Hant', { numeric: true }))
    return main ? [main, ...rest] : rest
  }

  // === 場地圖：沿用後台拖曳出來的擺位（issue #151），版面交給 layoutChartMap 放大塞滿 A4 ===
  function computeMapLayout(): MapLayout | null {
    if (tables.value.length === 0)
      return null
    return layoutChartMap({
      tables: tables.value.map((t) => {
        const p = deps.tablePos(t)
        const isMain = isMainTable(t)
        const box = tableBoxWidth(isMain)
        return { id: t.tableId, cx: p.x + box / 2, cy: p.y + box / 2, isMain }
      }),
      stage: computeStageBox(toValue(deps.venueLayout)),
      markers: venueMarkers.value.map((m) => {
        const p = deps.markerPos(m)
        return { label: m.label, x: p.x, y: p.y, width: m.width, height: m.height }
      }),
    })
  }

  // 舞台與場地標記（門口、送客區等）：虛線框＋置中標籤；尚未設定佈局時舞台退回頁首下方置中
  function drawZones(ctx: CanvasRenderingContext2D, layout: MapLayout) {
    const zones = [
      ...(layout.stage ? [{ box: layout.stage, label: '舞台', size: 11, weight: 600 }] : []),
      ...layout.markers.map(m => ({ box: m, label: m.label, size: 9.5, weight: 500 })),
    ]
    if (!layout.stage)
      zones.push({ box: { x: layout.pageW / 2 - 40, y: DEFAULT_MAP_OPTIONS.headerH - 22, width: 80, height: 18 }, label: '舞台', size: 9.5, weight: 600 })
    ctx.lineWidth = 1
    ctx.strokeStyle = CHART.line
    for (const z of zones) {
      ctx.fillStyle = CHART.zone
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.roundRect(z.box.x, z.box.y, z.box.width, z.box.height, 3)
      ctx.fill()
      ctx.stroke()
      ctx.setLineDash([])
      drawText(ctx, z.label, z.box.x + z.box.width / 2, z.box.y + z.box.height / 2, {
        size: z.size,
        weight: z.weight,
        color: CHART.inkSoft,
        align: 'center',
        maxW: z.box.width - 4,
      })
    }
  }

  interface LabelLine { text: string, size: number, weight: number, color: string }
  interface TableLook { fill: string, stroke: string, nameColor: string, lines: LabelLine[] }

  // 桌：圓＋圈內桌名（字級隨圓縮）＋圈外標籤（左半場寫左側、右半場與中軸寫右側、擠時寫下方）
  function drawTable(ctx: CanvasRenderingContext2D, t: PlacedTable, name: string, look: TableLook) {
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2)
    ctx.fillStyle = look.fill
    ctx.fill()
    ctx.lineWidth = t.isMain ? 2.5 : 1.7
    ctx.strokeStyle = look.stroke
    ctx.stroke()
    drawText(ctx, name, t.x, t.y, {
      size: Math.min(t.isMain ? 17 : 15, t.r * 0.62),
      weight: 700,
      color: look.nameColor,
      align: 'center',
      maxW: t.r * 1.56,
    })

    const lh = 11.6
    const n = look.lines.length
    let x = t.x
    let y0 = t.y - ((n - 1) * lh) / 2
    let align: CanvasTextAlign = 'center'
    if (t.labelSide === 'left') {
      x = t.x - t.r - 6
      align = 'right'
    }
    else if (t.labelSide === 'right') {
      x = t.x + t.r + 6
      align = 'left'
    }
    else {
      y0 = t.y + t.r + 4 + lh / 2
    }
    look.lines.forEach((ln, i) => {
      drawText(ctx, ln.text, x, y0 + i * lh, { size: ln.size, weight: ln.weight, color: ln.color, align, maxW: t.labelMaxW })
    })
  }

  // 頁首圖例：右上角由上往下一列一項（圓點＋文字，右對齊）
  function drawLegend(ctx: CanvasRenderingContext2D, pageW: number, items: { fill: string, stroke: string, text: string }[], note?: string) {
    const right = pageW - M
    items.forEach((it, i) => {
      const y = 26 + i * 15
      const w = drawText(ctx, it.text, right, y, { size: 9.5, color: CHART.ink, align: 'right' })
      ctx.beginPath()
      ctx.arc(right - w - 10, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = it.fill
      ctx.fill()
      ctx.lineWidth = 1.7
      ctx.strokeStyle = it.stroke
      ctx.stroke()
    })
    if (note)
      drawText(ctx, note, right, 26 + items.length * 15 + 2, { size: 8.5, color: CHART.inkFaint, align: 'right' })
  }

  function tableName(tableId: string) {
    return tables.value.find(t => t.tableId === tableId)?.tableName ?? ''
  }

  // 備餐地圖：圓依葷素分類上色，圈旁寫分類、大人人數、兒童椅
  function buildMealPages(): ChartPage[] {
    const layout = computeMapLayout()
    const { page, ctx } = newPage(layout?.pageW ?? A4_SHORT, layout?.pageH ?? A4_LONG)
    drawText(ctx, '桌次圖 · 備餐地圖', M, 30, { size: 17, weight: 700, color: CHART.ink })
    let sx = M
    for (const st of [
      { n: totalMeal.value.veg, label: '素食份數', color: CHART.veg.stroke },
      { n: totalMeal.value.meat, label: '葷食份數', color: CHART.meat.stroke },
      { n: totalMeal.value.child, label: '兒童椅數', color: CHART.child.text },
    ]) {
      const w = drawText(ctx, String(st.n), sx, 55, { size: 18, weight: 700, color: st.color })
      const lw = drawText(ctx, st.label, sx, 70, { size: 8, color: CHART.inkSoft })
      sx += Math.max(w, lw) + 14
    }
    drawLegend(ctx, page.width, [
      { ...CHART.veg, text: '全素食桌' },
      { ...CHART.mixed, text: '葷食含素' },
      { ...CHART.meat, text: '全葷食桌' },
    ], `${seatedTableCount.value} 桌入座 · 大人 ${totalMeal.value.veg + totalMeal.value.meat} 位`)
    if (!layout)
      return [page]

    drawZones(ctx, layout)
    for (const t of layout.tables) {
      const meal = tableMeal(t.id)
      const cat = mealCategory(t.id)
      const lines: LabelLine[] = [{ text: cat.label, size: 10, weight: 600, color: cat.text }]
      if (meal.adults > 0)
        lines.push({ text: `大人 ${meal.adults} 位`, size: 8.5, weight: 400, color: CHART.inkSoft })
      if (meal.child > 0)
        lines.push({ text: `兒童椅 ${meal.child}`, size: 8.5, weight: 600, color: CHART.child.text })
      drawTable(ctx, t, tableName(t.id), {
        fill: cat.fill,
        stroke: cat.stroke,
        nameColor: cat.key === 'empty' ? CHART.inkFaint : CHART.ink,
        lines,
      })
    }
    return [page]
  }

  // 賓客版場地圖：圈旁只寫人數，姓名放後面的名單卡與索引
  function buildGuestMapPage(): ChartPage {
    const layout = computeMapLayout()
    const { page, ctx } = newPage(layout?.pageW ?? A4_SHORT, layout?.pageH ?? A4_LONG)
    drawText(ctx, '桌次圖 · 賓客座位', M, 30, { size: 17, weight: 700, color: CHART.ink })
    drawText(ctx, `已入座 ${totalSeated.value} 位 · ${seatedTableCount.value} 桌`, M, 53, { size: 10, color: CHART.inkSoft })
    drawText(ctx, '後附：各桌名單、姓名索引', M, 68, { size: 8.5, color: CHART.inkFaint })
    drawLegend(ctx, page.width, [
      { fill: CHART.mixed.fill, stroke: CHART.mixed.stroke, text: '主桌' },
      { fill: CHART.paper, stroke: CHART.guestStroke, text: '賓客桌' },
    ])
    if (!layout)
      return page

    drawZones(ctx, layout)
    for (const t of layout.tables) {
      const meal = tableMeal(t.id)
      const n = meal.adults + meal.child
      const lines: LabelLine[] = [{ text: n > 0 ? `${n} 位` : '尚無入座', size: 10, weight: 600, color: n > 0 ? CHART.ink : CHART.inkFaint }]
      if (meal.child > 0)
        lines.push({ text: `含兒童椅 ${meal.child}`, size: 8.5, weight: 400, color: CHART.child.text })
      drawTable(ctx, t, tableName(t.id), {
        fill: t.isMain ? CHART.mixed.fill : n === 0 ? CHART.empty.fill : CHART.paper,
        stroke: t.isMain ? CHART.mixed.stroke : n === 0 ? CHART.line : CHART.guestStroke,
        nameColor: n === 0 ? CHART.inkFaint : CHART.ink,
        lines,
      })
    }
    return page
  }

  // === 名單頁共用：頁首標題＋右側圖例＋分隔線；續頁標「（續）」===
  type LegendPart = { text: string } | { tag: string, fill: string, color: string }
  function drawListHeader(ctx: CanvasRenderingContext2D, title: string, legend: LegendPart[]) {
    drawText(ctx, title, LIST_M, 38, { size: 16, weight: 700, color: CHART.ink })
    let x = A4_SHORT - LIST_M
    for (const part of legend.slice().reverse()) {
      if ('tag' in part) {
        setFont(ctx, 7, 600)
        const w = ctx.measureText(part.tag).width + 7 * 0.8
        drawTag(ctx, part.tag, x - w, 40, 7, part.fill, part.color)
        x -= w + 8
      }
      else {
        x -= drawText(ctx, part.text, x, 40, { size: 8.5, color: CHART.inkSoft, align: 'right' }) + 4
      }
    }
    ctx.fillStyle = CHART.ink
    ctx.fillRect(LIST_M, 52, A4_SHORT - LIST_M * 2, 1)
  }

  // === 各桌名單卡：一桌一張，同組一列（×N），素食／兒童椅用小標籤，拆桌註明另幾位在哪桌 ===
  interface CardRow { main: string, note: string, count: number, veg: boolean, child: number, split: string }
  interface TableCard { name: string, isMain: boolean, meta: string, rows: CardRow[] }

  function tableCards(): TableCard[] {
    const cards: TableCard[] = []
    for (const t of numberedTables()) {
      const seats = tableSeats(t.tableId).slice().sort((a, b) => a.seatNumber - b.seatNumber)
      if (seats.length === 0)
        continue
      const order: string[] = []
      for (const s of seats) {
        if (!order.includes(s.guestId))
          order.push(s.guestId)
      }
      const rows = order.map((guestId): CardRow => {
        const g = guestById(guestId)
        const here = seats.filter(s => s.guestId === guestId)
        // 同組拆到其他桌：列出另外幾位坐哪桌
        const elsewhere = new Map<string, number>()
        for (const other of numberedTables()) {
          if (other.tableId === t.tableId)
            continue
          const n = tableSeats(other.tableId).filter(s => s.guestId === guestId).length
          if (n > 0)
            elsewhere.set(other.tableName, n)
        }
        const nm = splitGuestName(g?.name ?? guestId)
        return {
          ...nm,
          count: here.length,
          veg: g?.diet === 'vegetarian',
          child: here.filter(s => s.seatType === 'childChair').length,
          split: Array.from(elsewhere, ([name, n]) => `另 ${n} 位在${name}`).join('、'),
        }
      })
      const meal = tableMeal(t.tableId)
      cards.push({
        name: t.tableName,
        isMain: isMainTable(t),
        meta: `${meal.adults + meal.child} 位${meal.child ? ` · 兒童椅 ${meal.child}` : ''}`,
        rows,
      })
    }
    return cards
  }

  const CARD_COLS = 3
  const CARD_GAP = 11
  const CARD_PAD = 7
  const LIST_COL_H = A4_LONG - LIST_TOP - 26

  function cardMetrics(fs: number) {
    return { head: fs * 1.2 * 1.3 + 5, row: fs * 1.36, split: fs * 0.8 * 1.3 }
  }
  function cardHeight(card: TableCard, fs: number) {
    const m = cardMetrics(fs)
    return CARD_PAD * 2 + m.head + card.rows.reduce((h, r) => h + m.row + (r.split ? m.split : 0), 0)
  }

  function drawCard(ctx: CanvasRenderingContext2D, card: TableCard, x: number, y: number, w: number, fs: number) {
    const m = cardMetrics(fs)
    const h = cardHeight(card, fs)
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 4.5)
    ctx.fillStyle = card.isMain ? CHART.mainCard : CHART.paper
    ctx.fill()
    ctx.lineWidth = 0.85
    ctx.strokeStyle = card.isMain ? CHART.mixed.stroke : CHART.line
    ctx.stroke()

    const left = x + CARD_PAD
    const right = x + w - CARD_PAD
    const headY = y + CARD_PAD + (m.head - 5) / 2
    const metaW = drawText(ctx, card.meta, right, headY, { size: fs * 0.8, color: CHART.inkSoft, align: 'right' })
    drawText(ctx, card.name, left, headY, {
      size: fs * 1.2,
      weight: 700,
      color: card.isMain ? CHART.mixed.text : CHART.ink,
      maxW: right - left - metaW - 6,
    })
    ctx.fillStyle = card.isMain ? CHART.mixed.stroke : CHART.line
    ctx.fillRect(left, y + CARD_PAD + m.head - 3, right - left, 0.7)

    let ry = y + CARD_PAD + m.head
    for (const row of card.rows) {
      const cy = ry + m.row / 2
      const countW = row.count > 1
        ? drawText(ctx, `×${row.count}`, right, cy, { size: fs * 0.85, color: CHART.inkSoft, align: 'right' }) + 6
        : 0
      // 姓名＋備註＋標籤整列量寬，放不下就整列縮字（最多縮到 75%），再不行才裁切
      const avail = right - left - countW
      const measure = (k: number) => {
        setFont(ctx, fs * k)
        let total = ctx.measureText(row.main).width
        if (row.note) {
          setFont(ctx, fs * 0.8 * k)
          total += ctx.measureText(`（${row.note}）`).width
        }
        setFont(ctx, fs * 0.7 * k, 600)
        if (row.veg)
          total += ctx.measureText('素').width + fs * 0.7 * k * 0.8 + 3
        if (row.child)
          total += ctx.measureText(row.child > 1 ? `兒童椅 ${row.child}` : '兒童椅').width + fs * 0.7 * k * 0.8 + 3
        return total
      }
      const k = Math.max(0.75, Math.min(1, avail / measure(1)))
      ctx.save()
      ctx.beginPath()
      ctx.rect(left, ry, avail, m.row)
      ctx.clip()
      let nx = left + drawText(ctx, row.main, left, cy, { size: fs * k, color: CHART.ink })
      if (row.note)
        nx += drawText(ctx, `（${row.note}）`, nx, cy, { size: fs * 0.8 * k, color: CHART.inkSoft })
      if (row.veg)
        nx += 3 + drawTag(ctx, '素', nx + 3, cy, fs * 0.7 * k, CHART.veg.fill, CHART.veg.text)
      if (row.child)
        drawTag(ctx, row.child > 1 ? `兒童椅 ${row.child}` : '兒童椅', nx + 3, cy, fs * 0.7 * k, CHART.child.fill, CHART.child.text)
      ctx.restore()
      ry += m.row
      if (row.split) {
        drawText(ctx, row.split, left, ry + m.split / 2, { size: fs * 0.8, color: CHART.inkFaint, maxW: right - left })
        ry += m.split
      }
    }
  }

  // 字級由大往小試，一頁放得下就用；最小字級仍放不下就分頁
  function pickFontAndFlow(sizes: number[], heightsAt: (fs: number) => number[], cols: number, gap: number) {
    for (const fs of sizes) {
      const flow = flowIntoColumns(heightsAt(fs), cols, LIST_COL_H, gap)
      if (flow.pages <= 1 || fs === sizes.at(-1))
        return { fs, ...flow }
    }
    throw new Error('unreachable')
  }

  function fontSteps(from: number, to: number, step: number) {
    const out: number[] = []
    for (let s = from; s >= to - 1e-6; s -= step)
      out.push(Math.round(s * 100) / 100)
    return out
  }

  function buildCardPages(): ChartPage[] {
    const cards = tableCards()
    if (cards.length === 0)
      return []
    const colW = (A4_SHORT - LIST_M * 2 - CARD_GAP * (CARD_COLS - 1)) / CARD_COLS
    const { fs, slots, pages } = pickFontAndFlow(fontSteps(11, 9, 0.25), f => cards.map(c => cardHeight(c, f)), CARD_COLS, 6)
    const out: ChartPage[] = []
    for (let p = 0; p < pages; p++) {
      const { page, ctx } = newPage(A4_SHORT, A4_LONG)
      drawListHeader(ctx, p === 0 ? '賓客座位名單' : '賓客座位名單（續）', [
        { text: '依桌次排列' },
        { text: '×N＝同組人數' },
        { tag: '素', fill: CHART.veg.fill, color: CHART.veg.text },
        { text: '素食' },
        { tag: '兒童椅', fill: CHART.child.fill, color: CHART.child.text },
        { text: '需兒童椅' },
      ])
      cards.forEach((card, i) => {
        const s = slots[i]!
        if (s.page === p)
          drawCard(ctx, card, LIST_M + s.col * (colW + CARD_GAP), LIST_TOP + s.y, colW, fs)
      })
      out.push(page)
    }
    return out
  }

  // === 姓名索引：依姓氏筆畫排序，一行「姓名 → 桌名」，換姓氏時多空一點 ===
  const INDEX_COLS = 3
  const INDEX_GAP = 22
  function buildIndexPages(): ChartPage[] {
    const byGuest = new Map<string, string[]>()
    for (const t of numberedTables()) {
      for (const s of tableSeats(t.tableId)) {
        const list = byGuest.get(s.guestId) ?? []
        if (!list.includes(t.tableName))
          list.push(t.tableName)
        byGuest.set(s.guestId, list)
      }
    }
    if (byGuest.size === 0)
      return []
    const collator = new Intl.Collator('zh-Hant-TW-u-co-stroke', { numeric: true })
    const entries = Array.from(byGuest, ([guestId, tableNames]) => ({ ...splitGuestName(guestById(guestId)?.name ?? guestId), tables: tableNames.join('、') }))
      .sort((a, b) => collator.compare(a.main, b.main))
    const groupStart = entries.map((e, i) => i > 0 && [...e.main][0] !== [...entries[i - 1]!.main][0])
    const colW = (A4_SHORT - LIST_M * 2 - INDEX_GAP * (INDEX_COLS - 1)) / INDEX_COLS
    const rowH = (fs: number) => fs * 1.5
    const { fs, slots, pages } = pickFontAndFlow(
      fontSteps(13, 10, 0.5),
      f => entries.map((_, i) => rowH(f) + (groupStart[i] ? 4.5 : 0)),
      INDEX_COLS,
      0,
    )
    const out: ChartPage[] = []
    for (let p = 0; p < pages; p++) {
      const { page, ctx } = newPage(A4_SHORT, A4_LONG)
      drawListHeader(ctx, p === 0 ? '找座位 · 姓名索引' : '找座位 · 姓名索引（續）', [
        { text: '依姓氏筆畫排序' },
        { text: '　同行親友請找邀請人姓名' },
      ])
      ctx.fillStyle = CHART.line
      for (let c = 1; c < INDEX_COLS; c++)
        ctx.fillRect(LIST_M + c * (colW + INDEX_GAP) - INDEX_GAP / 2, LIST_TOP, 0.7, LIST_COL_H)
      entries.forEach((e, i) => {
        const s = slots[i]!
        if (s.page !== p)
          return
        const x = LIST_M + s.col * (colW + INDEX_GAP)
        const top = LIST_TOP + s.y + (groupStart[i] && s.y > 0 ? 4.5 : 0)
        const cy = top + rowH(fs) / 2
        // 桌名優先完整顯示（找座位的人要看的是它），姓名用剩下的寬度；至少留一半欄寬給姓名
        setFont(ctx, fs)
        const nameNeed = ctx.measureText(e.main).width + 8
        const tw = drawText(ctx, e.tables, x + colW, cy, { size: fs, weight: 700, color: CHART.ink, align: 'right', maxW: Math.max(colW * 0.5, colW - nameNeed) })
        const nameW = drawText(ctx, e.main, x, cy, { size: fs, color: CHART.ink, maxW: colW - tw - 8 })
        if (e.note)
          drawText(ctx, `（${e.note}）`, x + nameW, cy, { size: fs * 0.75, color: CHART.inkSoft, maxW: colW - tw - nameW - 8 })
        ctx.strokeStyle = CHART.line
        ctx.lineWidth = 0.6
        ctx.setLineDash([1, 1.5])
        ctx.beginPath()
        ctx.moveTo(x, top + rowH(fs))
        ctx.lineTo(x + colW, top + rowH(fs))
        ctx.stroke()
        ctx.setLineDash([])
      })
      out.push(page)
    }
    return out
  }

  function buildGuestPages(): ChartPage[] {
    return [buildGuestMapPage(), ...buildCardPages(), ...buildIndexPages()]
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function jpegBytes(canvas: HTMLCanvasElement): Uint8Array {
    return dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92))
  }

  // 一頁直接下載 JPEG；多頁打包成 zip（瀏覽器常擋連續多個下載）
  function downloadPagesJpeg(pages: ChartPage[], baseName: string) {
    try {
      if (pages.length === 1) {
        triggerDownload(new Blob([jpegBytes(pages[0]!.canvas) as BlobPart], { type: 'image/jpeg' }), `${baseName}.jpg`)
        return
      }
      const entries = pages.map((p, i) => ({ name: `${baseName}-${i + 1}.jpg`, data: jpegBytes(p.canvas) }))
      triggerDownload(createZip(entries), `${baseName}.zip`)
    }
    catch {
      toast.add({ title: '產生圖片失敗，請稍後再試', color: 'error' })
    }
  }

  // 自製多頁影像 PDF：每頁內嵌一張 canvas 匯出的 JPEG（DCTDecode），頁面尺寸跟著直式／橫式，免裝套件
  function pagesToPdfBlob(pages: ChartPage[]): Blob {
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
    // 物件編號：1 目錄、2 頁面樹，之後每頁三個（頁面、內容、影像）
    const pageNum = (i: number) => 3 + i * 3
    const total = 2 + pages.length * 3

    push(enc('%PDF-1.3\n'))
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
    obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`)
    pages.forEach((p, i) => {
      const n = pageNum(i)
      const jpeg = jpegBytes(p.canvas)
      const content = `q\n${p.width} 0 0 ${p.height} 0 0 cm\n/Im0 Do\nQ\n`
      obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`)
      obj(n + 1, `<< /Length ${content.length} >>`, enc(content))
      obj(n + 2, `<< /Type /XObject /Subtype /Image /Width ${p.canvas.width} /Height ${p.canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg)
    })
    const xrefStart = offset
    let xs = `xref\n0 ${total + 1}\n0000000000 65535 f \n`
    for (let i = 1; i <= total; i++)
      xs += `${String(xref[i]).padStart(10, '0')} 00000 n \n`
    push(enc(xs))
    push(enc(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`))

    return new Blob(parts as BlobPart[], { type: 'application/pdf' })
  }

  const wid = () => toValue(deps.weddingId)
  function downloadChartJpeg() {
    downloadPagesJpeg(buildMealPages(), `桌次圖-${wid()}`)
  }
  function downloadChartPdf() {
    triggerDownload(pagesToPdfBlob(buildMealPages()), `桌次圖-${wid()}.pdf`)
  }
  function downloadNameChartJpeg() {
    downloadPagesJpeg(buildGuestPages(), `桌位示意圖-${wid()}`)
  }
  function downloadNameChartPdf() {
    triggerDownload(pagesToPdfBlob(buildGuestPages()), `桌位示意圖-${wid()}.pdf`)
  }

  // === 賓客名單 Excel（issue #194）===
  // 桌號沿用 numberedTables 的順序（資料沒有桌號欄位）

  // 一組賓客一列；同一組拆到兩桌就每桌各一列（人數是坐在這桌的人數），未排桌的放最後
  function guestRows(): (string | number)[][] {
    const rows: (string | number)[][] = []
    numberedTables().forEach((t, i) => {
      const seats = tableSeats(t.tableId).slice().sort((a, b) => a.seatNumber - b.seatNumber)
      const order: string[] = []
      for (const s of seats) {
        if (!order.includes(s.guestId))
          order.push(s.guestId)
      }
      for (const guestId of order) {
        const g = guestById(guestId)
        const here = seats.filter(s => s.guestId === guestId)
        const child = here.filter(s => s.seatType === 'childChair').length
        const split = g ? here.length < g.partySize : false
        rows.push([
          i + 1,
          t.tableName,
          g?.name ?? guestId,
          here.length,
          g ? dietLabel(g.diet) : '',
          child,
          split ? `拆桌：本桌 ${here.length} 位／共 ${g!.partySize} 位` : '',
        ])
      }
    })
    for (const g of unseatedGuests.value) {
      const pending = pendingMembers(g.guestId)
      const child = pending.filter(s => s.seatType === 'childChair').length
      const split = pending.length < g.partySize
      rows.push([
        '',
        '未排桌',
        g.name,
        pending.length,
        dietLabel(g.diet),
        child,
        split ? `部分已入座：尚有 ${pending.length} 位未排` : '',
      ])
    }
    return rows
  }

  // exceljs 約 1MB，只在按下載時才載入，平常開桌次頁不受影響
  async function downloadGuestListXlsx() {
    try {
      const { default: ExcelJS } = await import('exceljs')
      const book = new ExcelJS.Workbook()
      const list = book.addWorksheet('賓客名單', { views: [{ state: 'frozen', ySplit: 1 }] })
      list.columns = [
        { header: '桌號', width: 8 },
        { header: '桌名', width: 14 },
        { header: '姓名', width: 16 },
        { header: '同行人數', width: 10 },
        { header: '葷素', width: 8 },
        { header: '兒童椅', width: 8 },
        { header: '備註', width: 28 },
      ]
      list.getRow(1).font = { bold: true }
      list.addRows(guestRows())

      const chart = book.addWorksheet('桌位示意圖')
      const map = buildGuestMapPage()
      const image = book.addImage({ base64: map.canvas.toDataURL('image/png'), extension: 'png' })
      chart.addImage(image, { tl: { col: 0, row: 0 }, ext: { width: map.width, height: map.height } })

      const buffer = await book.xlsx.writeBuffer()
      triggerDownload(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `賓客名單-${wid()}.xlsx`,
      )
    }
    catch {
      toast.add({ title: '產生 Excel 失敗，請稍後再試', color: 'error' })
    }
  }

  // 下載桌次圖下拉選單：備餐地圖（餐點分類）/ 賓客名單（桌位示意圖 JPEG / PDF、表格 Excel）
  const downloadItems = [
    [
      { label: '備餐地圖 · JPEG', icon: 'i-heroicons-photo', onSelect: () => downloadChartJpeg() },
      { label: '備餐地圖 · PDF', icon: 'i-heroicons-document-text', onSelect: () => downloadChartPdf() },
    ],
    [
      { label: '賓客名單 · JPEG', icon: 'i-heroicons-photo', onSelect: () => downloadNameChartJpeg() },
      { label: '賓客名單 · PDF', icon: 'i-heroicons-document-text', onSelect: () => downloadNameChartPdf() },
      { label: '賓客名單 · Excel', icon: 'i-heroicons-table-cells', onSelect: () => void downloadGuestListXlsx() },
    ],
  ]

  return {
    downloadItems,
    downloadChartJpeg,
    downloadChartPdf,
    downloadNameChartJpeg,
    downloadNameChartPdf,
    downloadGuestListXlsx,
  }
}
