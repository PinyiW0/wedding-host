// Sentry 後端錯誤監控（issue #26）：Sentry init 時機早於 Nuxt context，只能讀 process.env
// SENTRY_DSN 留空＝完全停用（本機 dev / e2e 零影響）
import process from 'node:process'

import * as Sentry from '@sentry/nuxt'

const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
  })
}
