import type { H3Event } from 'h3'

import { readDbMeter } from '../../utils/db-meter'

// 測試專用：讀出自上次歸零以來，資料庫查詢結果的累計位元組數（issue #224）
export default defineEventHandler((_event: H3Event) => readDbMeter())
