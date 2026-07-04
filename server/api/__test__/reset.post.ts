import type { H3Event } from 'h3'

import { useDb } from '../../db'
import { resetDb } from '../../db/seed'

// 測試專用：truncate 全表後回填初始 seed，供 E2E spec 在 beforeEach 呼叫
// （enforced 模式下由 auth middleware 直接 404，不會進到這裡）
export default defineEventHandler(async (_event: H3Event) => {
  await resetDb(useDb())
  return { ok: true }
})
