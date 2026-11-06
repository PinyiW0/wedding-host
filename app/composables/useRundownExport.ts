// app/composables/useRundownExport.ts
// 當天流程表匯出（issue #207 自 rundown.vue 拆出並擴充）：
// - 完整大表長圖（PNG）、Excel：全部時段 × 全部角色欄（照角色順序），長文字換行、字級固定不縮
// - 單一角色長圖（PNG）：篩選單一角色時多一項，版面同完整大表、只留該角色參與的列與該角色一欄
//   （取代舊 A4 JPEG：50 列塞一頁時字會疊在一起）
// - 抬頭與檔名帶婚禮名稱與匯出時間，分得出哪一場、哪一版；長圖每隔幾列／幾欄重複表頭與時間欄
// - Excel 另附「物品總表」工作表，並設好列印（橫式、每頁重複表頭與時間欄）
import type { MaybeRefOrGetter } from 'vue'
import type { RundownRoleListItem } from '~/types/api/rundown'

import { addMinutes } from '~/utils/rundownTemplate'

// 匯出只需要的草稿欄位（頁面的 DraftRow 結構相容）
export interface RundownExportRow {
  time: string
  durationMinutes: number
  title: string
  location: string
  supplies: string
  note: string
  roleTaskById: Record<string, string>
  roleSuppliesById: Record<string, string>
  highlight: boolean
  guestVisible: boolean
}

// 抬頭用的婚禮資訊（WeddingDetail 結構相容）
export interface RundownExportWedding {
  title: string
  date: string
  venue: string
}

interface RundownExportDeps {
  wedding: MaybeRefOrGetter<RundownExportWedding | null | undefined>
  // 草稿有未儲存的改動：匯出的是畫面上的草稿，提醒使用者與已儲存的版本不同
  isDirty: MaybeRefOrGetter<boolean>
  // 完整大表與 Excel：全部時段、全部角色（不受篩選與欄位隱藏影響）
  allRows: MaybeRefOrGetter<RundownExportRow[]>
  allRoles: MaybeRefOrGetter<RundownRoleListItem[]>
  // 單一角色長圖：當前篩選結果；filterName 空字串＝全部角色（不提供這一項）
  filteredRows: MaybeRefOrGetter<RundownExportRow[]>
  filteredRoles: MaybeRefOrGetter<RundownRoleListItem[]>
  filterName: MaybeRefOrGetter<string>
}

// 配色對齊 main.css 設計 token（canvas 讀不到 CSS 變數）
const CHART = {
  paper: '#ffffff', // 列印白底
  ink: '#111111', // 主標 / 標題（ink）
  inkSoft: '#6B655C', // 角色事項（ink-500）
  inkFaint: '#A8A096', // 次要（ink-300）
  line: '#DCD4C7', // 分隔線（line）
  cream: '#F4EFE6', // 表頭底（cream）
  highlight: '#F3EBDD', // 標記列底（gold-light 淡化）
  gold: '#B8965A', // 裝飾線（gold）
  goldDeep: '#9A7B43', // 時間（gold-deep）
} as const
const FONT = 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif'

function endTimeOf(row: RundownExportRow): string {
  return row.time ? addMinutes(row.time, row.durationMinutes) : ''
}

function timeRange(row: RundownExportRow): string {
  return row.time ? `${row.time}–${endTimeOf(row)}` : '事前準備'
}

// 匯出時間：抬頭用完整格式、檔名用 MMDD-HHmm（同一天多次匯出也分得出先後）
function exportStamp(now: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const md = `${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const hm = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return {
    file: `${md}-${hm}`,
    label: `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

interface ExportMeta {
  heading: string
  subline: string
}

// 抬頭：哪一場婚禮（＋哪個角色）；副行：婚禮日期、場地、匯出時間
function exportMeta(wedding: RundownExportWedding | null | undefined, roleName: string, stampLabel: string): ExportMeta {
  return {
    heading: [wedding?.title ? `${wedding.title}｜當天流程表` : '婚禮當天流程表', roleName].filter(Boolean).join('｜'),
    subline: [wedding?.date.replaceAll('-', '/'), wedding?.venue, `匯出 ${stampLabel}`].filter(Boolean).join('　'),
  }
}

// 檔名不能用的字元（角色名會進檔名）
const FILENAME_UNSAFE_RE = /[\\/:*?"<>|]/g
// 物品字串拆成一項一項：頓號、逗號、分號、換行
const SUPPLY_SPLIT_RE = /[、，,；;\n]+/

function splitSupplies(text: string): string[] {
  return text.split(SUPPLY_SPLIT_RE).map(part => part.trim()).filter(Boolean)
}

// 檔名：當天流程表-婚禮名稱[-角色]-MMDD-HHmm.副檔名。不同婚禮、不同角色同一分鐘匯出也分得出來
function exportFilename(wedding: RundownExportWedding | null | undefined, roleName: string, stampFile: string, ext: string) {
  const parts = ['當天流程表', wedding?.title, roleName, stampFile]
  return `${parts.filter(Boolean).map(part => part!.replace(FILENAME_UNSAFE_RE, '_')).join('-')}.${ext}`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 依欄寬斷行：先照使用者自己的換行切段，再逐字量寬（中文沒有空白可斷）
function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const ch of paragraph) {
      if (line && ctx.measureText(line + ch).width > width) {
        lines.push(line)
        line = ch
      }
      else {
        line += ch
      }
    }
    lines.push(line)
  }
  return lines
}

// === 完整大表長圖 ===
const BIG = {
  margin: 32,
  titleH: 76,
  headH: 36,
  // 長表放大看中段時看不到欄名與時間：每 10 列重複一次表頭、每 5 個角色欄重複一次時間欄
  headEvery: 10,
  timeEvery: 5,
  pad: 10,
  lineH: 20,
  fontSize: 13,
  minRowH: 40,
  // 瀏覽器 canvas 單邊上限約 16384px，超過會整張空白：長表自動降解析度
  maxCanvasSide: 16000,
} as const

interface BigCellLine {
  text: string
  color: string
  weight: 400 | 600
}

interface BigColumn {
  label: string
  width: number
  // 角色欄的表頭用金色，其餘用次要色
  isRole?: boolean
  cell: (row: RundownExportRow) => { text: string, color: string, weight: 400 | 600 }[]
}

function bigColumns(roles: RundownRoleListItem[]): BigColumn[] {
  const plain = (pick: (row: RundownExportRow) => string, color: string = CHART.inkSoft) =>
    (row: RundownExportRow) => (pick(row) ? [{ text: pick(row), color, weight: 400 as const }] : [])
  const timeColumn: BigColumn = { label: '時間', width: 110, cell: row => [{ text: timeRange(row), color: CHART.goldDeep, weight: 600 }] }
  const repeatTime = roles.length > BIG.timeEvery
  return [
    timeColumn,
    { label: '主要事項', width: 200, cell: row => [{ text: row.title, color: CHART.ink, weight: 600 }] },
    { label: '場地', width: 120, cell: plain(row => row.location) },
    { label: '共用物品', width: 160, cell: plain(row => row.supplies) },
    { label: '備註', width: 220, cell: plain(row => row.note, CHART.inkFaint) },
    ...roles.flatMap((role, i): BigColumn[] => [
      {
        label: role.name,
        width: 200,
        isRole: true,
        cell: (row: RundownExportRow) => {
          const task = row.roleTaskById[role.roleId] ?? ''
          const supplies = row.roleSuppliesById[role.roleId] ?? ''
          return [
            ...(task ? [{ text: task, color: CHART.ink, weight: 400 as const }] : []),
            ...(supplies ? [{ text: `物品：${supplies}`, color: CHART.inkFaint, weight: 400 as const }] : []),
          ]
        },
      },
      ...(repeatTime && (i + 1) % BIG.timeEvery === 0 ? [timeColumn] : []),
    ]),
  ]
}

type BigBand
  = | { kind: 'head', height: number }
    | { kind: 'row', height: number, row: RundownExportRow, cells: BigCellLine[][] }

function buildBigTableCanvas(rows: RundownExportRow[], roles: RundownRoleListItem[], meta: ExportMeta): HTMLCanvasElement {
  const columns = bigColumns(roles)
  const innerW = columns.reduce((sum, col) => sum + col.width, 0)

  // 先量：每格斷行後的行數決定該列高度；表頭列每 headEvery 列插一次
  const measure = document.createElement('canvas').getContext('2d')!
  const bands: BigBand[] = []
  rows.forEach((row, i) => {
    if (i % BIG.headEvery === 0)
      bands.push({ kind: 'head', height: BIG.headH })
    const cells = columns.map(col => col.cell(row).flatMap((seg): BigCellLine[] => {
      measure.font = `${seg.weight} ${BIG.fontSize}px ${FONT}`
      return wrapText(measure, seg.text, col.width - BIG.pad * 2).map(text => ({ text, color: seg.color, weight: seg.weight }))
    }))
    const maxLines = Math.max(1, ...cells.map(lines => lines.length))
    bands.push({ kind: 'row', row, cells, height: Math.max(BIG.minRowH, maxLines * BIG.lineH + BIG.pad * 2) })
  })
  if (bands.length === 0)
    bands.push({ kind: 'head', height: BIG.headH })

  const width = innerW + BIG.margin * 2
  const height = BIG.margin + BIG.titleH + bands.reduce((sum, band) => sum + band.height, 0) + BIG.margin
  const dpr = Math.min(2, BIG.maxCanvasSide / Math.max(width, height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.fillStyle = CHART.paper
  ctx.fillRect(0, 0, width, height)
  ctx.textBaseline = 'top'

  // 抬頭：哪一場、哪一版
  ctx.fillStyle = CHART.ink
  ctx.font = `600 20px ${FONT}`
  ctx.fillText(meta.heading, BIG.margin, BIG.margin)
  ctx.fillStyle = CHART.inkSoft
  ctx.font = `400 12px ${FONT}`
  ctx.fillText(meta.subline, BIG.margin, BIG.margin + 32)
  ctx.fillStyle = CHART.gold
  ctx.fillRect(BIG.margin, BIG.margin + 56, 32, 1.5)

  const tableX = BIG.margin
  const tableTop = BIG.margin + BIG.titleH
  let y = tableTop
  for (const band of bands) {
    let x = tableX
    if (band.kind === 'head') {
      ctx.fillStyle = CHART.cream
      ctx.fillRect(tableX, y, innerW, band.height)
      ctx.font = `600 ${BIG.fontSize}px ${FONT}`
      for (const col of columns) {
        ctx.fillStyle = col.isRole ? CHART.goldDeep : CHART.inkSoft
        ctx.fillText(col.label, x + BIG.pad, y + (band.height - BIG.fontSize) / 2, col.width - BIG.pad * 2)
        x += col.width
      }
    }
    else {
      if (band.row.highlight) {
        ctx.fillStyle = CHART.highlight
        ctx.fillRect(tableX, y, innerW, band.height)
      }
      columns.forEach((col, i) => {
        band.cells[i]!.forEach((line, n) => {
          ctx.fillStyle = line.color
          ctx.font = `${line.weight} ${BIG.fontSize}px ${FONT}`
          ctx.fillText(line.text, x + BIG.pad, y + BIG.pad + n * BIG.lineH + (BIG.lineH - BIG.fontSize) / 2)
        })
        x += col.width
      })
    }
    y += band.height
  }

  // 格線：外框、每一帶底線、每欄分隔
  ctx.strokeStyle = CHART.line
  ctx.lineWidth = 1
  ctx.strokeRect(tableX, tableTop, innerW, y - tableTop)
  ctx.beginPath()
  let lineY = tableTop
  for (const band of bands.slice(0, -1)) {
    lineY += band.height
    ctx.moveTo(tableX, lineY)
    ctx.lineTo(tableX + innerW, lineY)
  }
  let lineX = tableX
  for (const col of columns.slice(0, -1)) {
    lineX += col.width
    ctx.moveTo(lineX, tableTop)
    ctx.lineTo(lineX, y)
  }
  ctx.stroke()
  return canvas
}

export function useRundownExport(deps: RundownExportDeps) {
  const toast = useToast()

  // 匯出的是畫面上的草稿：有未儲存的改動時提醒，避免發出去的檔案和大家連結上看到的不一樣
  function warnIfDirty() {
    if (toValue(deps.isDirty))
      toast.add({ title: '匯出內容包含尚未儲存的變更', color: 'warning' })
  }

  function downloadPng(canvas: HTMLCanvasElement, filename: string) {
    canvas.toBlob((blob) => {
      if (blob)
        triggerDownload(blob, filename)
      else
        toast.add({ title: '產生圖片失敗，請稍後再試', color: 'error' })
    }, 'image/png')
  }

  function downloadBigTablePng() {
    warnIfDirty()
    const stamp = exportStamp()
    downloadPng(
      buildBigTableCanvas(toValue(deps.allRows), toValue(deps.allRoles), exportMeta(toValue(deps.wedding), '', stamp.label)),
      exportFilename(toValue(deps.wedding), '', stamp.file, 'png'),
    )
  }

  // 單一角色長圖：只留該角色參與的列與該角色一欄
  function downloadRolePng() {
    warnIfDirty()
    const stamp = exportStamp()
    const roleName = toValue(deps.filterName)
    downloadPng(
      buildBigTableCanvas(toValue(deps.filteredRows), toValue(deps.filteredRoles), exportMeta(toValue(deps.wedding), roleName, stamp.label)),
      exportFilename(toValue(deps.wedding), roleName, stamp.file, 'png'),
    )
  }

  // exceljs 約 1MB，只在按下載時才載入，平常開流程頁不受影響
  async function downloadXlsx() {
    warnIfDirty()
    try {
      const { default: ExcelJS } = await import('exceljs')
      const roles = toValue(deps.allRoles)
      const rows = toValue(deps.allRows)
      const stamp = exportStamp()
      const meta = exportMeta(toValue(deps.wedding), '', stamp.label)
      // 頁首頁尾的 & 是控制碼，文字裡的 & 要寫成 &&
      const escapeHf = (text: string) => text.replaceAll('&', '&&')
      const pageHeader = `&L${escapeHf(meta.heading)}`
      const pageFooter = `&L${escapeHf(meta.subline)}&R&P / &N`

      const book = new ExcelJS.Workbook()
      // 凍結表頭與時間、主要事項兩欄：橫捲到右邊的角色欄時還看得到是哪個時段
      const sheet = book.addWorksheet('流程表', { views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] })
      sheet.columns = [
        { header: '開始', width: 8 },
        { header: '結束', width: 8 },
        { header: '主要事項', width: 24 },
        { header: '場地', width: 14 },
        { header: '共用物品', width: 20 },
        { header: '備註', width: 30 },
        { header: '對賓客公開', width: 10 },
        ...roles.map(role => ({ header: role.name, width: 26 })),
      ]
      // 角色事項與自己要帶的物品放同一格，物品另起一行
      const rolesOf = (row: RundownExportRow) => roles.map((role) => {
        const task = row.roleTaskById[role.roleId] ?? ''
        const supplies = row.roleSuppliesById[role.roleId] ?? ''
        return [task, supplies ? `物品：${supplies}` : ''].filter(Boolean).join('\n')
      })
      for (const row of rows) {
        const added = sheet.addRow([
          row.time || '事前準備',
          endTimeOf(row),
          row.title,
          row.location,
          row.supplies,
          row.note,
          row.guestVisible ? '是' : '',
          ...rolesOf(row),
        ])
        if (row.highlight)
          added.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EBDD' } }
      }
      // 列印：橫式 A4、印格線；表很寬會跨頁，每一頁都重複表頭列與開始／結束／主要事項三欄
      sheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9,
        printTitlesRow: '1:1',
        printTitlesColumn: 'A:C',
        showGridLines: true,
        pageOrder: 'overThenDown',
      }
      sheet.headerFooter.oddHeader = pageHeader
      sheet.headerFooter.oddFooter = pageFooter

      // 物品總表：一列一項物品，標明誰負責帶；先列共用、再照角色順序，同一負責人照時段順序
      const supplySheet = book.addWorksheet('物品總表', { views: [{ state: 'frozen', ySplit: 1 }] })
      supplySheet.columns = [
        { header: '負責人', width: 14 },
        { header: '物品', width: 28 },
        { header: '開始', width: 10 },
        { header: '主要事項', width: 26 },
        { header: '場地', width: 14 },
      ]
      const owners = [
        { name: '共用', pick: (row: RundownExportRow) => row.supplies },
        ...roles.map(role => ({ name: role.name, pick: (row: RundownExportRow) => row.roleSuppliesById[role.roleId] ?? '' })),
      ]
      for (const owner of owners) {
        for (const row of rows) {
          for (const item of splitSupplies(owner.pick(row)))
            supplySheet.addRow([owner.name, item, row.time || '事前準備', row.title, row.location])
        }
      }
      supplySheet.autoFilter = 'A1:E1'
      supplySheet.pageSetup = { orientation: 'portrait', paperSize: 9, printTitlesRow: '1:1', showGridLines: true }
      supplySheet.headerFooter.oddHeader = `${pageHeader}｜物品總表`
      supplySheet.headerFooter.oddFooter = pageFooter

      for (const each of [sheet, supplySheet]) {
        each.eachRow((row) => {
          row.alignment = { vertical: 'top', wrapText: true }
        })
        const header = each.getRow(1)
        header.font = { bold: true }
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4EFE6' } }
      }

      const buffer = await book.xlsx.writeBuffer()
      triggerDownload(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        exportFilename(toValue(deps.wedding), '', stamp.file, 'xlsx'),
      )
    }
    catch {
      toast.add({ title: '產生 Excel 失敗，請稍後再試', color: 'error' })
    }
  }

  // 篩選單一角色時多一組「只含該角色」的長圖
  const exportItems = computed(() => {
    const roleName = toValue(deps.filterName)
    return [
      [
        { label: '完整大表 · 長圖 PNG', icon: 'i-heroicons-photo', onSelect: () => downloadBigTablePng() },
        { label: '完整大表 · Excel', icon: 'i-heroicons-table-cells', onSelect: () => void downloadXlsx() },
      ],
      ...(roleName
        ? [[{ label: `只含「${roleName}」· 長圖 PNG`, icon: 'i-heroicons-user', onSelect: () => downloadRolePng() }]]
        : []),
    ]
  })

  return { exportItems, downloadBigTablePng, downloadRolePng, downloadXlsx }
}
