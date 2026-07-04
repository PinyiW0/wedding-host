import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

// 連線字串與 nuxt.config runtimeConfig.databaseUrl 用同一個覆蓋變數（NUXT_DATABASE_URL）
// 預設值＝docker-compose 的本機 Postgres
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL ?? 'postgresql://wedding:wedding@localhost:5433/wedding',
  },
})
