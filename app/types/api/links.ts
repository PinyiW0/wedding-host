// 賓客連結簽名（管理端取得，附加於公開連結的 ?sig=）

export interface SignedLinkResponse {
  sig: string
}

// 公開連結短網址：婚禮層級三種（issue #170）＋賓客層級四種（issue #176）
export type WeddingShortLinkKind = 'rsvp-public' | 'story' | 'invite'
export type GuestShortLinkKind = 'rsvp-guest' | 'blessing' | 'checkin' | 'thankyou'
export type ShortLinkKind = WeddingShortLinkKind | GuestShortLinkKind

export interface CreateShortLinkBody {
  kind: ShortLinkKind
  // 賓客層級四種必填；婚禮層級忽略
  guestId?: string
}

// 只回短碼，完整網址由前端以當下 origin 拼出（server 不必處理反向代理的 host header）
export interface ShortLinkResponse {
  code: string
}
