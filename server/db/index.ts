import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import * as schema from './schema'
import { seedDbIfEmpty } from './seed'

// 單例 DB 客戶端：本機／常駐容器走 node-postgres；
// 日後上 Vercel 換 drizzle-orm/neon-http driver 即可（schema 與查詢不動，見 issue #4）
let _db: ReturnType<typeof createDb> | undefined

function createDb() {
  return drizzle(useRuntimeConfig().databaseUrl, { schema, casing: 'snake_case' })
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
