// Sentry 前端錯誤監控（issue #26）：DSN 走 NUXT_PUBLIC_SENTRY_DSN，留空＝完全停用（本機 dev / e2e 零影響）
import * as Sentry from '@sentry/nuxt'

const dsn = useRuntimeConfig().public.sentry.dsn

if (dsn) {
  Sentry.init({
    dsn,
    // 婚禮規模流量小，全取樣仍在 free tier 內；之後量大再降
    tracesSampleRate: 1.0,
  })
}
