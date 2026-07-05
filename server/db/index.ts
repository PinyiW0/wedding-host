import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeonHttp } from 'drizzle-orm/neon-http'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import * as schema from './schema'
import { seedDbIfEmpty } from './seed'

// 單例 DB 客戶端，依連線目標自動選 driver（見 issue #4 / #9）：
//   *.neon.tech → neon-http（serverless 走 HTTP，無 TCP 連線池問題）
//   其他（本機 docker / 常駐容器）→ node-postgres
// 注意：neon-http 不支援 db.transaction()，handler 層不得使用（現況全數為單一查詢）
let _db: NodePgDatabase<typeof schema> | undefined

function createDb(): NodePgDatabase<typeof schema> {
  const url = useRuntimeConfig().databaseUrl
  if (new URL(url).hostname.endsWith('.neon.tech')) {
    // 兩個 driver 的查詢 API 相同，型別以 node-postgres 版為準收斂
    return drizzleNeonHttp(neon(url), { schema, casing: 'snake_case' }) as unknown as NodePgDatabase<typeof schema>
  }
  return drizzle(url, { schema, casing: 'snake_case' })
}

export function useDb() {
  _db ??= createDb()
  return _db
}

export type Db = ReturnType<typeof useDb>

// dev / e2e 啟動時自動跑 migration + 空庫 seed（memoize，僅執行一次）；
// production 的 migration 於部署階段跑 `npm run db:migrate`，這裡直接略過
let _ready: Promise<void> | undefined

export function ensureDbReady(): Promise<void> {
  _ready ??= (async () => {
    if (!import.meta.dev)
      return
    const db = useDb()
    await migrate(db, { migrationsFolder: 'server/db/migrations' })
    await seedDbIfEmpty(db)
  })()
  return _ready
}
