import type { H3Event } from 'h3'
import type { GuestLineBoundEvent } from '../../../app/types/api/guests'

// LINE Login OAuth callback（LINE console 登錄的 Redirect URI 指到這裡）
// 位於 /api/v1 之外＝不走登入中介層，安全性由 state 簽名承擔：
// 驗過 state 才知道綁誰，寫入沿用既有 line-binding 端點（保留 404／409 語意），
// 導回目標一律由驗證後的 state 組出，不採信 query 的任何網址（防 open redirect）
export default defineEventHandler(async (event: H3Event) => {
  const query = getQuery(event)
  const state = typeof query.state === 'string' ? query.state : ''

  const bound = verifyBindState(state)
  if (!bound)
    throw createError({ statusCode: 403, statusMessage: '綁定連結無效或已逾時，請回到綁定頁重試' })

  const { weddingId, guestId } = bound
  const backTo = (flag: string): string =>
    `/guest/${encodeURIComponent(guestId)}/bind?weddingId=${encodeURIComponent(weddingId)}&sig=${signGuestLink(weddingId, guestId)}&${flag}`

  // 使用者在 LINE 授權頁取消或授權失敗
  if (typeof query.error === 'string' && query.error)
    return sendRedirect(event, backTo('bindResult=cancelled'))

  const code = typeof query.code === 'string' ? query.code : ''
  const lineUserId = code ? await exchangeLineUserId(event, code) : null
  if (!lineUserId)
    return sendRedirect(event, backTo('bindResult=failed'))

  try {
    await event.$fetch<GuestLineBoundEvent>(
      `/api/v1/weddings/${encodeURIComponent(weddingId)}/guests/${encodeURIComponent(guestId)}/line-binding`,
      {
        method: 'POST',
        headers: { 'X-Guest-Sig': signGuestLink(weddingId, guestId) },
        body: { lineUserId },
      },
    )
  }
  catch (error: any) {
    const status = error?.statusCode ?? error?.response?.status
    return sendRedirect(event, backTo(status === 409 ? 'bindResult=already' : 'bindResult=failed'))
  }

  return sendRedirect(event, backTo('bindResult=success'))
})
