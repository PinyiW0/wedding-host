// 賓客：CRUD / 軟刪 / 恢復 / 批次匯入 / LINE 綁定

import type { AttendingStatus, InvitationPreference } from './rsvp'

export type GuestSide = 'groom' | 'bride'
export type GuestDiet = 'meat' | 'vegetarian'
// 名單狀態：confirmed = 正式名單；pending_review = 公開自助 RSVP 待人工確認
export type GuestStatus = 'confirmed' | 'pending_review'
// 來源：manual = 後台手動新增；import = 批次匯入；rsvp = 公開自助回覆
export type GuestSource = 'manual' | 'import' | 'rsvp'

export interface GuestListItem {
  guestId: string
  weddingId: string
  name: string
  side: GuestSide
  diet: GuestDiet
  category: string
  contact: string
  // 需兒童椅的小嬰兒數（不吃大人菜、不佔正常席，該桌額外加位）
  childChairCount: number
  notes: string | null
  lineUserId: string | null
  // RSVP 出席狀態：未提交為 null（重整後仍可讀回）
  rsvpAttending: AttendingStatus | null
  // 這組總人數（本人＋同行＋兒童椅嬰兒）；正常席人頭 = partySize − childChairCount
  partySize: number
  // 桌次名稱（display 用，真實後端應由座位安排推導）；未排桌為 null
  tableName?: string | null
  // 訪客 RSVP 表單補充回覆（供後台檢視；未填為 null）
  invitationPreference?: InvitationPreference | null
  mailingAddress?: string | null
  blessing?: string | null
  flowerDrawing?: string | null
  needsShuttle?: boolean | null
  shuttleCount?: number | null
  // 自訂題答案（供後台 RSVP 頁檢視；未填為 null）
  customAnswers?: Record<string, string | string[]> | null
  // 喜帖已寄送記號（管理端逐位勾選；省略視為 false）
  invitationSent?: boolean
  // 名單狀態與來源（混合制：公開自助回覆進待確認區）；省略視為 confirmed / manual
  status?: GuestStatus
  source?: GuestSource
  deletedAt: string | null
}

export interface CreateGuestBody {
  name: string
  side: GuestSide
  diet: GuestDiet
  category: string
  contact: string
  // 總人數（本人＋同行＋兒童椅嬰兒）；省略時後端視為 1
  partySize?: number
  // 兒童椅嬰兒數；省略時後端視為 0
  childChairCount?: number
  notes?: string
}

export interface GuestCreatedEvent {
  guestId: string
  weddingId: string
  name: string
  side: GuestSide
  diet: GuestDiet
  category: string
  contact: string
  partySize: number
  childChairCount: number
  notes: string | null
}

export interface UpdateGuestBody {
  name?: string
  side?: GuestSide
  diet?: GuestDiet
  category?: string
  contact?: string
  partySize?: number
  childChairCount?: number
  notes?: string
  // 管理員修正回覆內容（對齊賓客 RSVP 表單欄位）
  needsShuttle?: boolean
  shuttleCount?: number
  invitationPreference?: InvitationPreference | null
  mailingAddress?: string
}

export interface GuestUpdatedEvent {
  guestId: string
  weddingId: string
  name: string
  side: GuestSide
  diet: GuestDiet
  category: string
  contact: string
  partySize: number
  childChairCount: number
  notes: string | null
}

export interface GuestRestoredEvent {
  guestId: string
}

export interface ImportGuestsBody {
  fileName: string
}

export interface GuestsImportedEvent {
  importedCount: number
}

export interface BindGuestLineBody {
  lineUserId: string
}

export interface GuestLineBoundEvent {
  guestId: string
  lineUserId: string
}

export interface MarkInvitationSentBody {
  sent: boolean
}

export interface InvitationSentMarkedEvent {
  guestId: string
  invitationSent: boolean
}
