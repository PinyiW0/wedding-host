import type { H3Event } from 'h3'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

// LINE Login OAuth（M4 賓客綁定）
// 未設定 NUXT_LINE_LOGIN_CHANNEL_ID / NUXT_LINE_LOGIN_CHANNEL_SECRET 時視為未啟用，
// bind 頁維持 mock 綁定（凍結 e2e 依賴此行為）；填入後「綁定 LINE」改走真 OAuth。
// state 以 HMAC 綁定 weddingId + guestId + 時效（防 CSRF），callback 驗過才寫入綁定。

const STATE_TTL_MS = 10 * 60 * 1000 // authorize → callback 的有效視窗
const ISSUED_AT_RE = /^\d+$/

export function isLineLoginConfigured(): boolean {
  const config = useRuntimeConfig()
  return !!(config.lineLoginChannelId && config.lineLoginChannelSecret)
}

// callback 網址：LINE console 需登錄完全一致的 URL；未設定 env 時以請求 origin 推導（本機開發）
export function lineLoginRedirectUri(event: H3Event): string {
  return useRuntimeConfig().lineLoginRedirectUri
    || `${getRequestURL(event).origin}/api/line-login/callback`
}

function stateHmac(payload: string): string {
  return createHmac('sha256', useRuntimeConfig().guestLinkSecret).update(payload).digest('base64url')
}

// state 格式：b.<weddingId>.<guestId>.<issuedAt>.<digest>（id 不含「.」，與 guest-link 簽名同前提）
export function signBindState(weddingId: string, guestId: string): string {
  const issuedAt = Date.now()
  return `b.${weddingId}.${guestId}.${issuedAt}.${stateHmac(`b:${weddingId}:${guestId}:${issuedAt}`)}`
}

export function verifyBindState(state: string): { weddingId: string, guestId: string } | null {
  const parts = state.split('.')
  if (parts[0] !== 'b' || parts.length !== 5)
    return null
  const [, weddingId, guestId, issuedAt, digest] = parts as [string, string, string, string, string]
  const expected = stateHmac(`b:${weddingId}:${guestId}:${issuedAt}`)
  const bufA = Buffer.from(digest)
  const bufB = Buffer.from(expected)
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB))
    return null
  if (!ISSUED_AT_RE.test(issuedAt) || Date.now() - Number(issuedAt) > STATE_TTL_MS)
    return null
  return { weddingId, guestId }
}

export function buildLineAuthorizeUrl(event: H3Event, weddingId: string, guestId: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: useRuntimeConfig().lineLoginChannelId,
    redirect_uri: lineLoginRedirectUri(event),
    state: signBindState(weddingId, guestId),
    scope: 'profile openid',
    bot_prompt: 'aggressive', // 授權後引導加入 OA 好友（Login channel 需已 Linked 到 OA）
  })
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
}

// code 換 access token → 取 LINE userId；任一步失敗回 null（callback 統一導回綁定頁報錯）
export async function exchangeLineUserId(event: H3Event, code: string): Promise<string | null> {
  const config = useRuntimeConfig()
  try {
    const token = await $fetch<{ access_token: string }>('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: lineLoginRedirectUri(event),
        client_id: config.lineLoginChannelId,
        client_secret: config.lineLoginChannelSecret,
      }),
    })
    const profile = await $fetch<{ userId: string }>('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    return profile.userId || null
  }
  catch {
    return null
  }
}
