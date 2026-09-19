// 賓客連結簽名（管理端取得，附加於公開連結的 ?sig=）

export interface SignedLinkResponse {
  sig: string
}

// 公開連結短網址（issue #170）：後台複製的三種婚禮層級公開連結
export type ShortLinkKind = 'rsvp-public' | 'story' | 'invite'

export interface CreateShortLinkBody {
  kind: ShortLinkKind
}

// 只回短碼，完整網址由前端以當下 origin 拼出（server 不必處理反向代理的 host header）
export interface ShortLinkResponse {
  code: string
}
