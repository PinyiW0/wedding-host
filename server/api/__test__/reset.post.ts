import type { H3Event } from 'h3'

import { resetMockData } from '../../mock/data'

// 測試專用：重設所有 mock 資料到初始值，供 E2E spec 在 beforeEach 呼叫
export default defineEventHandler((_event: H3Event) => {
  resetMockData()
  return { ok: true }
})
