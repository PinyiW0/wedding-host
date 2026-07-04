// 待確認賓客：公開自助 RSVP → 待確認區 → 人工併入既有 / 建為新賓客 / 略過
// 待確認賓客本身即帶 status='pending_review' 的賓客，清單沿用 GuestListItem，本檔僅定義動作型別。

import type { SubmitRsvpBody } from './rsvp'

// 公開自助回覆：沿用賓客 RSVP 表單欄位（無 guestId，後端建立待確認賓客）
export interface SubmitPublicRsvpBody extends SubmitRsvpBody {}

export interface PublicRsvpSubmittedEvent {
  guestId: string
  weddingId: string
  status: 'pending_review'
}

// 併入既有賓客：把待確認回覆併進指定的正式賓客，待確認筆移除
export interface MergePendingGuestBody {
  targetGuestId: string
}

export interface PendingGuestMergedEvent {
  guestId: string // 被移除的待確認賓客 id
  targetGuestId: string // 併入的正式賓客 id
}

// 建為新賓客：將待確認賓客轉為正式名單
export interface PendingGuestConfirmedEvent {
  guestId: string
}

// 略過：拒絕此待確認回覆（軟刪除待確認筆）
export interface PendingGuestRejectedEvent {
  guestId: string
}
