// 啟動守衛（issue #70 / H1）：enforced 模式下若密鑰仍為 dev 預設值或空字串，
// 直接 throw 阻止啟動——避免帶著公開已知的弱密鑰上線（可被偽造 JWT／簽名連結）。
// open 模式（dev／e2e）不受影響。
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  if (config.authMode !== 'enforced')
    return

  const weak = (v: string | undefined): boolean =>
    !v || v.includes('dev-only') || v.includes('change-me')

  const missing: string[] = []
  if (weak(config.jwtSecret))
    missing.push('NUXT_JWT_SECRET')
  if (weak(config.guestLinkSecret))
    missing.push('NUXT_GUEST_LINK_SECRET')

  if (missing.length) {
    throw new Error(
      `[security] enforced 模式偵測到未設定或使用預設值的密鑰：${missing.join('、')}。`
      + '請以環境變數設定高熵隨機值後再部署（詳見 docs/security.md 部署檢查清單）。',
    )
  }
})
