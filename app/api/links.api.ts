import type { SignedLinkResponse } from '~/types/api/links'

import { useHttp } from '~/composables/useHttp'

// 取得公開連結的 HMAC 簽名：帶 guestId＝賓客專屬連結；不帶＝婚禮分享連結
export function getSignedLink(weddingId: string, guestId?: string) {
  return useHttp().getOnce<SignedLinkResponse>('/api/v1/weddings/{weddingId}/signed-links', {
    pathParams: { weddingId },
    query: guestId ? { guestId } : undefined,
  })
}
