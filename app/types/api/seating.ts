// 座位與場地佈局：桌次 CRUD / 座位安排 / 場地佈局 / 禮俗設定與警告

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
}

export interface VenueLayoutConfiguredEvent {
  weddingId: string
  stageWidth: number
  stageHeight: number
  stagePositionX: number
  stagePositionY: number
}

// GET 讀回的場地佈局（重整後還原 modal 既有值）
export type VenueLayoutDetail = VenueLayoutConfiguredEvent

export interface EtiquetteSettings {
  elderNearMain: boolean
  conflictWarning: boolean
  genderSeparation: boolean
  mainTableNearStage: boolean
  sameCategoryTogether: boolean
}

export type EtiquetteSettingsBody = EtiquetteSettings

export interface EtiquetteSettingsUpdatedEvent {
  weddingId: string
  elderNearMain: boolean
  conflictWarning: boolean
  genderSeparation: boolean
  mainTableNearStage: boolean
  sameCategoryTogether: boolean
}

// GET 讀回的禮俗設定（重整後還原 modal 既有值）
export type EtiquetteSettingsDetail = EtiquetteSettingsUpdatedEvent

export interface EtiquetteWarningListItem {
  warningId: string
  warningType: string
  message: string
  dismissed: boolean
}

export interface DismissEtiquetteWarningBody {
  warningType: string
}

export interface EtiquetteWarningDismissedEvent {
  warningId: string
  warningType: string
}
