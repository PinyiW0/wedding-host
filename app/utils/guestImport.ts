// 賓客名單 Excel 匯入（issue #205）：範例檔欄位、表格解析、逐列驗證
// 解析在瀏覽器做（exceljs 已是前端依賴），送到後端的是逐列賓客；後端仍逐列再驗一次
import type { CreateGuestBody, GuestDiet, GuestSide } from '~/types/api/guests'

export const GUEST_IMPORT_MAX_ROWS = 1000
export const EXCEL_EXTENSION = /\.xlsx?$/i

const HEADER_NOTE = /[（(].*?[）)]/g
const WHITESPACE = /\s+/g

export const GUEST_IMPORT_COLUMNS = [
  { key: 'name', header: '姓名', hint: '必填', width: 14 },
  { key: 'side', header: '男女方', hint: '必填：男方／女方', width: 12 },
  { key: 'diet', header: '飲食', hint: '葷食／素食，空白視為葷食', width: 12 },
  { key: 'category', header: '分類', hint: '例如：同事、大學同學', width: 14 },
  { key: 'contact', header: '聯絡方式', hint: '電話或 LINE', width: 16 },
  { key: 'partySize', header: '總人數', hint: '本人＋同行＋兒童椅嬰兒，空白視為 1', width: 10 },
  { key: 'childChairCount', header: '兒童椅數', hint: '需要兒童椅的嬰兒數，空白視為 0', width: 10 },
  { key: 'notes', header: '備註', hint: '', width: 24 },
] as const

type ColumnKey = typeof GUEST_IMPORT_COLUMNS[number]['key']

const SIDE_VALUES: Record<string, GuestSide> = { 男方: 'groom', 男: 'groom', groom: 'groom', 女方: 'bride', 女: 'bride', bride: 'bride' }
const DIET_VALUES: Record<string, GuestDiet> = { 葷食: 'meat', 葷: 'meat', meat: 'meat', 素食: 'vegetarian', 素: 'vegetarian', vegetarian: 'vegetarian' }

export interface GuestImportParseResult {
  guests: CreateGuestBody[]
  errors: string[]
}

// 表頭去掉括號說明與空白後比對，容許使用者寫「姓名（必填）」
function normalizeHeader(text: string) {
  return text.replace(HEADER_NOTE, '').replace(WHITESPACE, '').trim()
}

function parseCount(raw: string, fallback: number): number | null {
  if (!raw)
    return fallback
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : null
}

// rows[0] 是表頭，其餘每列一位賓客；儲存格一律先轉成顯示文字
export function parseGuestRows(rows: string[][]): GuestImportParseResult {
  const errors: string[] = []
  const header = (rows[0] ?? []).map(cell => normalizeHeader(cell))
  const indexOf = {} as Record<ColumnKey, number>
  for (const column of GUEST_IMPORT_COLUMNS)
    indexOf[column.key] = header.indexOf(column.header)

  const missing = GUEST_IMPORT_COLUMNS.filter(c => (c.key === 'name' || c.key === 'side') && indexOf[c.key] < 0)
  if (missing.length)
    return { guests: [], errors: [`找不到「${missing.map(c => c.header).join('」「')}」欄，請使用範例檔填寫`] }

  const guests: CreateGuestBody[] = []
  rows.slice(1).forEach((row, i) => {
    const cell = (key: ColumnKey) => (indexOf[key] >= 0 ? (row[indexOf[key]] ?? '').trim() : '')
    if (GUEST_IMPORT_COLUMNS.every(c => !cell(c.key)))
      return
    // Excel 列號：表頭是第 1 列
    const label = `第 ${i + 2} 列`
    const rowErrors: string[] = []

    const name = cell('name')
    if (!name)
      rowErrors.push('缺少姓名')
    const side = SIDE_VALUES[cell('side')]
    if (!side)
      rowErrors.push('男女方請填「男方」或「女方」')
    const diet = cell('diet') ? DIET_VALUES[cell('diet')] : 'meat'
    if (!diet)
      rowErrors.push('飲食請填「葷食」或「素食」')
    const partySize = parseCount(cell('partySize'), 1)
    if (partySize === null || partySize < 1)
      rowErrors.push('總人數請填 1 以上的整數')
    const childChairCount = parseCount(cell('childChairCount'), 0)
    if (childChairCount === null)
      rowErrors.push('兒童椅數請填 0 以上的整數')

    if (rowErrors.length) {
      errors.push(`${label}：${rowErrors.join('、')}`)
      return
    }
    const notes = cell('notes')
    guests.push({
      name,
      side: side!,
      diet: diet!,
      category: cell('category'),
      contact: cell('contact'),
      partySize: partySize!,
      childChairCount: childChairCount!,
      ...(notes ? { notes } : {}),
    })
  })

  if (!errors.length && !guests.length)
    errors.push('檔案裡沒有賓客資料，請從第 2 列開始填寫')
  if (guests.length > GUEST_IMPORT_MAX_ROWS)
    errors.push(`一次最多匯入 ${GUEST_IMPORT_MAX_ROWS} 位賓客`)
  return { guests: errors.length ? [] : guests, errors }
}

// 讀第一張工作表；內容不是有效 xlsx（例如純文字改副檔名、舊版 .xls）時 exceljs 會擲錯
export async function readGuestWorkbook(file: Blob): Promise<GuestImportParseResult> {
  const { default: ExcelJS } = await import('exceljs')
  const book = new ExcelJS.Workbook()
  try {
    await book.xlsx.load(await file.arrayBuffer())
  }
  catch {
    return { guests: [], errors: ['檔案內容無法讀取，請用範例檔填寫後另存成 .xlsx 再匯入'] }
  }
  const sheet = book.worksheets[0]
  if (!sheet)
    return { guests: [], errors: ['檔案裡沒有工作表，請使用範例檔填寫'] }
  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = []
    for (let c = 1; c <= GUEST_IMPORT_COLUMNS.length + 5; c++)
      cells.push(row.getCell(c).text ?? '')
    rows.push(cells)
  })
  return parseGuestRows(rows)
}

// 範例檔：表頭＋男女方／飲食下拉；第二張工作表放填寫說明（匯入只讀第一張）
export async function buildGuestTemplate(): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('賓客名單', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = GUEST_IMPORT_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }))
  sheet.getRow(1).font = { bold: true }
  const sideCol = sheet.getColumn('side').letter
  const dietCol = sheet.getColumn('diet').letter
  for (let r = 2; r <= GUEST_IMPORT_MAX_ROWS + 1; r++) {
    sheet.getCell(`${sideCol}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"男方,女方"'] }
    sheet.getCell(`${dietCol}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"葷食,素食"'] }
  }

  const guide = book.addWorksheet('填寫說明')
  guide.columns = [{ header: '欄位', key: 'header', width: 12 }, { header: '怎麼填', key: 'hint', width: 48 }]
  guide.getRow(1).font = { bold: true }
  GUEST_IMPORT_COLUMNS.forEach(c => guide.addRow({ header: c.header, hint: c.hint || '可空白' }))
  guide.addRow({})
  guide.addRow({ header: '提醒', hint: '從「賓客名單」第 2 列開始一列填一位；不要改第 1 列的欄位名稱' })

  const buffer = await book.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
