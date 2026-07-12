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

export interface VenueLayoutBody {
  stageWidth: number
  stageHeight: number
  stagePositionX: number
  stagePositionY: number
  // 場地參考圖 URL（R2 公開 URL 或 dataURL）；不帶＝維持既有、null＝移除
  referenceImageUrl?: string | null
}

export interface VenueLayoutConfiguredEvent {
  weddingId: string
  stageWidth: number
  stageHeight: number
  stagePositionX: number
  stagePositionY: number
  referenceImageUrl: string | null
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
