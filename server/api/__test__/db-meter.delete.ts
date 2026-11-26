import type { H3Event } from 'h3'

import { resetDbMeter } from '../../utils/db-meter'

// 測試專用：把資料庫讀出量計數器歸零（issue #224）
export default defineEventHandler((_event: H3Event) => {
  resetDbMeter()
  return { ok: true }
})
