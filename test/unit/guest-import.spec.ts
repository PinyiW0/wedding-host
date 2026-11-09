import { Buffer } from 'node:buffer'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildGuestTemplate, parseGuestRows, readGuestWorkbook } from '../../app/utils/guestImport'

const HEADER = ['姓名', '男女方', '飲食', '分類', '聯絡方式', '總人數', '兒童椅數', '備註']

describe('賓客匯入解析 #205', () => {
  it('照範例欄位填寫：空白欄套預設值、空白列略過', () => {
    // Arrange
    const rows = [
      HEADER,
      ['王小明', '男方', '', '同事', '0912000111', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['林美麗', '女方', '素食', '', '', '3', '1', '靠近出口'],
    ]

    // Act
    const result = parseGuestRows(rows)

    // Assert
    expect(result.errors).toEqual([])
    expect(result.guests).toEqual([
      { name: '王小明', side: 'groom', diet: 'meat', category: '同事', contact: '0912000111', partySize: 1, childChairCount: 0 },
      { name: '林美麗', side: 'bride', diet: 'vegetarian', category: '', contact: '', partySize: 3, childChairCount: 1, notes: '靠近出口' },
    ])
  })

  it('表頭帶括號說明也認得', () => {
    const result = parseGuestRows([['姓名（必填）', '男女方 (必填)'], ['王小明', '男']])
    expect(result.guests).toHaveLength(1)
  })

  it('任何一列有錯就整份不匯入，並指出 Excel 列號', () => {
    const result = parseGuestRows([
      HEADER,
      ['王小明', '男方'],
      ['', '女方'],
      ['林美麗', '親友', '', '', '', '0'],
    ])
    expect(result.guests).toEqual([])
    expect(result.errors).toEqual([
      '第 3 列：缺少姓名',
      '第 4 列：男女方請填「男方」或「女方」、總人數請填 1 以上的整數',
    ])
  })

  it('缺必填欄或沒有資料列時回錯', () => {
    expect(parseGuestRows([['名字', '分類'], ['王小明', '同事']]).errors[0]).toContain('找不到「姓名」「男女方」欄')
    expect(parseGuestRows([HEADER]).errors).toEqual(['檔案裡沒有賓客資料，請從第 2 列開始填寫'])
  })
})

describe('賓客匯入讀檔 #205', () => {
  it('範例檔填 3 位賓客，讀出 3 位', async () => {
    // Arrange：從範例檔開始填
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(await (await buildGuestTemplate()).arrayBuffer())
    const sheet = book.worksheets[0]!
    sheet.addRow(['王小明', '男方', '葷食', '同事', '0912000111', 2, 0])
    sheet.addRow(['林美麗', '女方', '素食'])
    sheet.addRow(['陳志明', '男方'])
    const file = new Blob([await book.xlsx.writeBuffer()])

    // Act
    const result = await readGuestWorkbook(file)

    // Assert
    expect(result.errors).toEqual([])
    expect(result.guests.map(g => g.name)).toEqual(['王小明', '林美麗', '陳志明'])
    expect(result.guests[0]!.partySize).toBe(2)
  })

  it('純文字改副檔名的檔案讀取失敗', async () => {
    const result = await readGuestWorkbook(new Blob([Buffer.from('mock xlsx content')]))
    expect(result.guests).toEqual([])
    expect(result.errors[0]).toContain('檔案內容無法讀取')
  })
})
