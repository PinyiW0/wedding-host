import type { H3Event } from 'h3'

import { sql } from 'drizzle-orm'

import { useDb } from '../../db'

// 公開健康檢查（issue #26）：供 UptimeRobot 等外部監測；探測 DB 連線
// route-auth 分類為 public，不需登入
export default defineEventHandler(async (event: H3Event) => {
  try {
    await useDb().execute(sql`select 1`)
    return { status: 'ok', db: true }
  }
  catch {
    setResponseStatus(event, 503)
    return { status: 'degraded', db: false }
  }
})
