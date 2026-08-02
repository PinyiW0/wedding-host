// 部署時自動套用 DB migrations（issue #116）
// vercel.json 的 buildCommand 在 build 前執行本腳本——先更新結構、再上新程式碼；
// migrate 失敗＝部署失敗，不會出現「程式碼新、結構舊」的中間態。
// NUXT_DATABASE_URL_MIGRATE（Neon direct DSN）未設定時：preview／本機 build 跳過（不碰正式庫），
// production 則中止部署（issue #134）——靜默跳過等於機制沒生效、卻沒有任何人察覺。
import { execSync } from 'node:child_process'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/**
 * 依環境變數決定本次 build 的 migrate 行為。
 * @param {Record<string, string | undefined>} env 環境變數（正式執行傳 process.env）
 * @returns {{ action: 'migrate' | 'skip' | 'abort', message: string }} 要採取的行為與對應的 log 訊息
 */
export function resolveMigrateAction(env) {
  if (env.NUXT_DATABASE_URL_MIGRATE)
    return { action: 'migrate', message: '套用 migrations 至部署目標資料庫…' }

  // production 缺 DSN＝結構不會跟著程式碼上線。issue #134 前這裡一律靜默 exit 0，
  // 導致機制從上線起沒跑過半次、0010 漏套用直到正式站頁面壞掉才被發現。
  if (env.VERCEL_ENV === 'production') {
    return {
      action: 'abort',
      message: 'Production 部署缺少環境變數 NUXT_DATABASE_URL_MIGRATE，已中止部署。\n'
        + '  請至 Vercel → Settings → Environment Variables 新增（限 Production 環境），\n'
        + '  值為 Neon 的 direct DSN（pooled 主機名去掉 -pooler）。\n'
        + '  詳見 docs/ops.md「部署自動 migrate」。',
    }
  }

  return {
    action: 'skip',
    message: `NUXT_DATABASE_URL_MIGRATE 未設定，跳過 migrate（VERCEL_ENV=${env.VERCEL_ENV ?? '未設定，視為本機 build'}）`,
  }
}

function main() {
  const { action, message } = resolveMigrateAction(process.env)

  if (action === 'abort') {
    console.error(`[deploy-migrate] ✗ ${message}`)
    process.exit(1)
  }

  if (action === 'skip') {
    console.log(`[deploy-migrate] ${message}`)
    process.exit(0)
  }

  console.log(`[deploy-migrate] ${message}`)
  execSync('npx drizzle-kit migrate', { stdio: 'inherit' })
  console.log('[deploy-migrate] ✓ migrations 套用完成')
}

// 被 import（單元測試）時不執行，直接執行才跑
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
