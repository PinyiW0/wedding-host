// 賓客：CRUD / 軟刪 / 恢復 / 批次匯入 / LINE 綁定

import type { AttendingStatus } from './rsvp'

export type GuestSide = 'groom' | 'bride'
export type GuestDiet = 'meat' | 'vegetarian'

export interface GuestListItem {
  guestId: string
  weddingId: string
  name: string
  side: GuestSide
  diet: GuestDiet
  category: string
  contact: string
  needChildSeat: boolean
  notes: string | null
  lineUserId: string | null
  // RSVP 出席狀態：未提交為 null（重整後仍可讀回）
  rsvpAttending: AttendingStatus | null
  // 這組總人數（本人＋攜伴），供接待端顯示；未提供時視為 1
  partySize?: number
  // 桌次名稱（display 用，真實後端應由座位安排推導）；未排桌為 null
  tableName?: string | null
  deletedAt: string | null
}

export interface CreateGuestBody {
  name: string
  side: GuestSide
  diet: GuestDiet
  category: string
  contact: string
  needChildSeat: boolean
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
  needChildSeat: boolean
  notes: string | null
}

export interface UpdateGuestBody {
  name?: string
  side?: GuestSide
  diet?: GuestDiet
  category?: string
  contact?: string
  needChildSeat?: boolean
  notes?: string
}

export interface GuestUpdatedEvent {
  guestId: string
  weddingId: string
  name: string
  side: GuestSide
  diet: GuestDiet
  category: string
  contact: string
  needChildSeat: boolean
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
