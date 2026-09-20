import type { ShortLinkKind, ShortLinkResponse, SignedLinkResponse } from '~/types/api/links'

import { useHttp } from '~/composables/useHttp'

// 取得公開連結的 HMAC 簽名：帶 guestId＝賓客專屬連結；不帶＝婚禮分享連結
export function getSignedLink(weddingId: string, guestId?: string) {
  return useHttp().getOnce<SignedLinkResponse>('/api/v1/weddings/{weddingId}/signed-links', {
    pathParams: { weddingId },
    query: guestId ? { guestId } : undefined,
  })
}

// 取得公開連結的短碼（取得或建立；同一種連結永遠回同一個短碼）
// 賓客層級四種（rsvp-guest／blessing／checkin／thankyou）要帶 guestId
export function getShortLink(weddingId: string, kind: ShortLinkKind, guestId?: string) {
  return useHttp().post<ShortLinkResponse>('/api/v1/weddings/{weddingId}/short-links', {
    pathParams: { weddingId },
    body: guestId ? { kind, guestId } : { kind },
  })
}
