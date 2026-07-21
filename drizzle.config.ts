import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

// 連線字串優先序：
// 1. NUXT_DATABASE_URL_MIGRATE — migrate 專用 direct DSN（部署時由 scripts/deploy-migrate.mjs 觸發；migration 不可走 pooled）
// 2. NUXT_DATABASE_URL — 與 nuxt.config runtimeConfig.databaseUrl 同一覆蓋變數
// 3. 預設值＝docker-compose 的本機 Postgres
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL_MIGRATE
      ?? process.env.NUXT_DATABASE_URL
      ?? 'postgresql://wedding:wedding@localhost:5433/wedding',
  },
})
