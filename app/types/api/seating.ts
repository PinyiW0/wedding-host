// 座位與場地佈局：桌次 CRUD / 座位安排 / 場地佈局

export interface TableListItem {
  tableId: string
  weddingId: string
  tableName: string
  capacity: number
  positionX: number
  positionY: number
}

export interface CreateTableBody {
  tableName: string
  capacity: number
  positionX: number
  positionY: number
}

export interface TableCreatedEvent {
  tableId: string
  weddingId: string
  tableName: string
  capacity: number
  positionX: number
  positionY: number
}

export interface UpdateTableBody {
  tableName?: string
  capacity?: number
  positionX?: number
  positionY?: number
}

export interface TableUpdatedEvent {
  tableId: string
  tableName: string
  capacity: number
  positionX: number
  positionY: number
}

export interface SeatListItem {
  guestId: string
  tableId: string
  seatNumber: number
  // 席位類型：normal = 正常席（佔 capacity 人頭）；childChair = 兒童椅（額外加位、不佔 capacity）
  seatType: 'normal' | 'childChair'
  // 該賓客組內第幾位（同類型內 1-indexed），供座位標籤如「名字2」「名字-兒童1」
  partyIndex: number
}

export interface SeatGuestBody {
  guestId: string
  seatNumber: number
}

export interface GuestSeatedEvent {
  tableId: string
  guestId: string
  seatNumber: number
}

// 單席移動：以「席位」為粒度（一組賓客的大人、兒童椅席可各自移動）
export interface MoveSeatBody {
  fromTableId: string
  fromSeatNumber: number
  toTableId: string
  // 目標座號；不帶＝接續目標桌下一個空號（拖到整桌）
  toSeatNumber?: number
}

export interface SeatMovedEvent {
  fromTableId: string
  fromSeatNumber: number
  toTableId: string
  toSeatNumber: number
  // 目標座位原有人＝互換兩席
  swapped: boolean
}

export interface VenueLayoutBody {
  stageWidth: number
  stageHeight: number
  stagePositionX: number
  stagePositionY: number
  // 場地參考圖 URL（R2 公開 URL 或 dataURL）；不帶＝維持既有、null＝移除
  referenceImageUrl?: string | null
  // 參考圖對位（畫布位置 px 與縮放倍率）；不帶＝維持既有
  refImageX?: number
  refImageY?: number
  refImageScale?: number
}

export interface VenueLayoutConfiguredEvent {
  weddingId: string
  stageWidth: number
  stageHeight: number
  stagePositionX: number
  stagePositionY: number
  referenceImageUrl: string | null
  refImageX: number
  refImageY: number
  refImageScale: number
}

// GET 讀回的場地佈局（重整後還原 modal 既有值）
export type VenueLayoutDetail = VenueLayoutConfiguredEvent

// === 場地標記（門口、送客區、進場入口等長方形文字標示；與桌次同畫布 px 座標系）===
export interface VenueMarkerListItem {
  markerId: string
  weddingId: string
  label: string
  positionX: number
  positionY: number
  width: number
  height: number
}

export interface CreateVenueMarkerBody {
  label: string
  positionX?: number
  positionY?: number
  width?: number
  height?: number
}

export type VenueMarkerCreatedEvent = VenueMarkerListItem

export interface UpdateVenueMarkerBody {
  label?: string
  positionX?: number
  positionY?: number
  width?: number
  height?: number
}

export type VenueMarkerUpdatedEvent = VenueMarkerListItem
