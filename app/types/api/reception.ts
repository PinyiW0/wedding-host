// 接待端：報到 / 自助報到 / 禮金登記與更正 / 喜餅發放

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
