import type { H3Event } from 'h3'
import type { GuestLineLoginInfo } from '../../../../../../../app/types/api/guests'

// OAuth 起手：LINE Login 已設定時回 authorize URL（含防 CSRF state），
// 未設定時回 configured: false，bind 頁退回 mock 綁定（凍結 e2e 依賴）
export default defineEventHandler(async (event: H3Event): Promise<GuestLineLoginInfo> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const guestId = getRouterParam(event, 'guestId')!

  if (!isLineLoginConfigured())
    return { configured: false, authorizeUrl: null }

  return { configured: true, authorizeUrl: buildLineAuthorizeUrl(event, weddingId, guestId) }
})
