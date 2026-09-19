import type { ShortLinkKind } from '../../app/types/api/links'

import { randomBytes } from 'node:crypto'

// 公開連結短網址（issue #170）：短碼只是查表用的代號，本身不帶授權；
// 真正的授權仍是 /s/<code> 轉址時現算的 ?sig=（見 guest-link.ts）

// 字元集去掉形近字（0/O、1/l/I）：新人唸給賓客聽、或手抄進喜帖都不會抄錯。
// 長度 32 且整除 256，取 byte % 32 不會有取模偏差
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export const SHORT_LINK_KINDS = ['rsvp-public', 'story', 'invite'] as const

const TARGET_PATH: Record<ShortLinkKind, (weddingId: string) => string> = {
  'rsvp-public': id => `/rsvp/public/${id}`,
  'story': id => `/story/${id}`,
  'invite': id => `/invite/${id}`,
}

export function generateShortCode(length = 6): string {
  let code = ''
  for (const byte of randomBytes(length))
    code += ALPHABET[byte % ALPHABET.length]
  return code
}

// 短碼要轉去的公開頁路徑（不含簽章）
export function shortLinkTarget(kind: ShortLinkKind, weddingId: string): string {
  return TARGET_PATH[kind](encodeURIComponent(weddingId))
}
