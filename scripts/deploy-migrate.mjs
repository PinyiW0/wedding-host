// 部署時自動套用 DB migrations（issue #116）
// vercel.json 的 buildCommand 在 build 前執行本腳本——先更新結構、再上新程式碼；
// migrate 失敗＝部署失敗，不會出現「程式碼新、結構舊」的中間態。
// NUXT_DATABASE_URL_MIGRATE（Neon direct DSN）未設定時跳過：preview／本機 build 不碰正式庫。
import { execSync } from 'node:child_process'
import process from 'node:process'

if (!process.env.NUXT_DATABASE_URL_MIGRATE) {
  console.log('[deploy-migrate] NUXT_DATABASE_URL_MIGRATE 未設定，跳過 migrate（preview／本機 build 屬正常）')
  process.exit(0)
}

console.log('[deploy-migrate] 套用 migrations 至部署目標資料庫…')
execSync('npx drizzle-kit migrate', { stdio: 'inherit' })
console.log('[deploy-migrate] ✓ migrations 套用完成')
