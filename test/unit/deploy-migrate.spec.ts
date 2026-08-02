import { describe, expect, it } from 'vitest'

import { resolveMigrateAction } from '../../scripts/deploy-migrate.mjs'

// issue #134：部署自動 migrate 原本在缺 DSN 時一律靜默 exit 0，
// 導致 Vercel Production 沒設變數也照樣綠燈部署，migration 漏套用到正式站頁面壞掉才被發現。
// 本測試守護「按環境分流」：production 缺變數必須中止，preview／本機維持跳過。
describe('部署自動 migrate 的行為分流（issue #134）', () => {
  it('production 缺 NUXT_DATABASE_URL_MIGRATE 時中止部署', () => {
    const result = resolveMigrateAction({ VERCEL_ENV: 'production' })

    expect(result.action).toBe('abort')
    // 訊息要能據以排查：講出缺哪個變數、去哪設
    expect(result.message).toContain('NUXT_DATABASE_URL_MIGRATE')
    expect(result.message).toContain('Production')
  })

  it('preview 缺 NUXT_DATABASE_URL_MIGRATE 時跳過，不阻擋部署', () => {
    const result = resolveMigrateAction({ VERCEL_ENV: 'preview' })

    expect(result.action).toBe('skip')
  })

  it('本機 build（無 VERCEL_ENV）缺 NUXT_DATABASE_URL_MIGRATE 時跳過', () => {
    const result = resolveMigrateAction({})

    expect(result.action).toBe('skip')
  })

  it('變數有值時一律套用 migrations，不受環境影響', () => {
    for (const env of [
      { NUXT_DATABASE_URL_MIGRATE: 'postgresql://u:p@host/db', VERCEL_ENV: 'production' },
      { NUXT_DATABASE_URL_MIGRATE: 'postgresql://u:p@host/db', VERCEL_ENV: 'preview' },
      { NUXT_DATABASE_URL_MIGRATE: 'postgresql://u:p@host/db' },
    ])
      expect(resolveMigrateAction(env).action).toBe('migrate')
  })

  it('production 變數被設成空字串時同樣中止（等同未設定）', () => {
    const result = resolveMigrateAction({ VERCEL_ENV: 'production', NUXT_DATABASE_URL_MIGRATE: '' })

    expect(result.action).toBe('abort')
  })
})
