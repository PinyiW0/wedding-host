// 接待端：報到 / 自助報到 / 禮金登記與更正 / 喜餅發放

// 接待端讀取賓客的報到 / 禮金 / 喜餅狀態（GuestListItem 不含這些欄位，
// 故另開此端點供 /reception 頁面初始化狀態。對應 flow invariant #5）
export interface ReceptionStatusItem {
  guestId: string
  checkedIn: boolean
  giftAmount: number | null
  cakeBoxTypeId: string | null
}

export interface GuestCheckedInEvent {
  guestId: string
  checkedInAt: string
}

export interface SelfCheckInBody {
  name: string
}

export interface GuestSelfCheckedInEvent {
  guestId: string
  name: string
  checkedInAt: string
}

export interface RecordGiftMoneyBody {
  amount: number
}

export interface GiftMoneyRecordedEvent {
  guestId: string
  amount: number
}

export interface UpdateGiftMoneyBody {
  amount: number
}

export interface GiftMoneyUpdatedEvent {
  guestId: string
  amount: number
}

export interface DistributeCakeBoxBody {
  cakeBoxTypeId: string
}

export interface CakeBoxDistributedEvent {
  guestId: string
  cakeBoxTypeId: string
}
