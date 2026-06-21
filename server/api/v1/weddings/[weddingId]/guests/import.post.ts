import type { H3Event } from 'h3'
import type { GuestsImportedEvent, ImportGuestsBody } from '../../../../../../app/types/api/guests'

// 僅允許 .xlsx / .xls 副檔名
const excelExtension = /\.xlsx?$/i

export default defineEventHandler(async (event: H3Event): Promise<GuestsImportedEvent> => {
  const body = await readBody<ImportGuestsBody>(event)
  const fileName = body?.fileName ?? ''

  if (!excelExtension.test(fileName)) {
    throw createError({ statusCode: 400, statusMessage: '檔案格式不正確，僅支援 .xlsx 或 .xls 格式' })
  }

  // mock：合法 Excel 一律回固定匯入筆數
  return { importedCount: 25 }
})
