import type { GuestShortLinkKind, RundownShortLinkKind, ShortLinkKind, WeddingShortLinkKind } from '../../app/types/api/links'

import { randomBytes } from 'node:crypto'

// 公開連結短網址（issue #170、賓客層級為 #176、流程表為 #207）：短碼只是查表用的代號，本身不帶授權；
// 真正的授權仍是 /s/<code> 轉址時現算的 ?sig=（見 guest-link.ts）

// 字元集去掉形近字（0/O、1/l/I）：新人唸給賓客聽、或手抄進喜帖都不會抄錯。
// 長度 32 且整除 256，取 byte % 32 不會有取模偏差
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export const WEDDING_SHORT_LINK_KINDS = ['rsvp-public', 'story', 'invite'] as const
export const GUEST_SHORT_LINK_KINDS = ['rsvp-guest', 'blessing', 'checkin', 'thankyou'] as const
export const RUNDOWN_SHORT_LINK_KINDS = ['rundown-staff', 'rundown-role'] as const
export const SHORT_LINK_KINDS = [...WEDDING_SHORT_LINK_KINDS, ...GUEST_SHORT_LINK_KINDS, ...RUNDOWN_SHORT_LINK_KINDS] as const

// 賓客層級短碼配 8 碼（婚禮層級維持 6 碼）：賓客專屬頁看得到她的姓名與回覆、還能代為報到，
// 短碼即是進得去的鑰匙，多兩碼把可猜中的組合從十億拉到一兆。
// 流程表兩種也配 8 碼：看得到當天全部分工與工作人員要帶的物品，不該比公開喜帖好猜
const WEDDING_CODE_LENGTH = 6
const PRIVATE_CODE_LENGTH = 8

const WEDDING_TARGET_PATH: Record<WeddingShortLinkKind, (weddingId: string) => string> = {
  'rsvp-public': id => `/rsvp/public/${id}`,
  'story': id => `/story/${id}`,
  'invite': id => `/invite/${id}`,
}

// 四類賓客專屬頁的參數形態各不相同，與各頁面既有寫法一致
const GUEST_TARGET_PATH: Record<GuestShortLinkKind, (weddingId: string, guestId: string) => string> = {
  'rsvp-guest': (wid, gid) => `/rsvp/${gid}?weddingId=${wid}`,
  'blessing': (wid, gid) => `/blessing/${wid}?guestId=${gid}`,
  'checkin': (wid, gid) => `/checkin?weddingId=${wid}&guestId=${gid}`,
  'thankyou': (wid, gid) => `/thankyou/${wid}/${gid}`,
}

// 流程表：總覽與角色版是同一頁，角色版多帶 ?role=（與後台「複製連結」的長網址一致）
const RUNDOWN_TARGET_PATH: Record<RundownShortLinkKind, (weddingId: string, roleId: string) => string> = {
  'rundown-staff': id => `/rundown/${id}`,
  'rundown-role': (wid, rid) => `/rundown/${wid}?role=${rid}`,
}

export function isGuestShortLinkKind(kind: ShortLinkKind): kind is GuestShortLinkKind {
  return (GUEST_SHORT_LINK_KINDS as readonly string[]).includes(kind)
}

function isRundownShortLinkKind(kind: ShortLinkKind): kind is RundownShortLinkKind {
  return (RUNDOWN_SHORT_LINK_KINDS as readonly string[]).includes(kind)
}

export function generateShortCode(kind: ShortLinkKind): string {
  const length = (WEDDING_SHORT_LINK_KINDS as readonly string[]).includes(kind) ? WEDDING_CODE_LENGTH : PRIVATE_CODE_LENGTH
  let code = ''
  for (const byte of randomBytes(length))
    code += ALPHABET[byte % ALPHABET.length]
  return code
}

// 短碼要轉去的公開頁路徑（不含簽章）。targetId：賓客層級＝guestId、rundown-role＝roleId、其餘空字串
export function shortLinkTarget(kind: ShortLinkKind, weddingId: string, targetId: string): string {
  const wid = encodeURIComponent(weddingId)
  if (isGuestShortLinkKind(kind))
    return GUEST_TARGET_PATH[kind](wid, encodeURIComponent(targetId))
  if (isRundownShortLinkKind(kind))
    return RUNDOWN_TARGET_PATH[kind](wid, encodeURIComponent(targetId))
  return WEDDING_TARGET_PATH[kind](wid)
}

// 轉址時現算的簽章：各種公開頁認的簽章不同，婚禮分享簽章讀不到流程表、角色簽章只通行該角色
export function shortLinkSig(kind: ShortLinkKind, weddingId: string, targetId: string): string {
  if (isGuestShortLinkKind(kind))
    return signGuestLink(weddingId, targetId)
  if (kind === 'rundown-role')
    return signRoleLink(weddingId, targetId)
  if (kind === 'rundown-staff')
    return signStaffLink(weddingId)
  return signWeddingLink(weddingId)
}
