// 座位與場地佈局 mock 資料：桌次 / 座位 / 場地佈局 / 禮俗設定與警告
// seed：table-001（主桌 / 10 座 / 100,200）、warning-001（gender-separation）

import type { EtiquetteSettings } from '../../../app/types/api/seating'

export interface MockTable {
  tableId: string
  weddingId: string
  tableName: string
  capacity: number
  positionX: number
  positionY: number
}

export interface MockSeat {
  tableId: string
  guestId: string
  seatNumber: number
}

export interface MockVenueLayout {
  weddingId: string
  stageWidth: number
  stageHeight: number
  stagePositionX: number
  stagePositionY: number
}

export interface MockEtiquetteSettings extends EtiquetteSettings {
  weddingId: string
}

export interface MockEtiquetteWarning {
  warningId: string
  weddingId: string
  warningType: string
  message: string
  dismissed: boolean
}

export const mockTables: MockTable[] = [
  { tableId: 'table-001', weddingId: 'wedding-001', tableName: '主桌', capacity: 10, positionX: 100, positionY: 200 },
  { tableId: 'table-002', weddingId: 'wedding-001', tableName: '男方家屬桌', capacity: 10, positionX: 300, positionY: 200 },
  { tableId: 'table-003', weddingId: 'wedding-001', tableName: '女方家屬桌', capacity: 10, positionX: 500, positionY: 200 },
]

// 座位安排（預設無人入座；測試移除「桌次上還有賓客」情境時可動態 push）
export const mockSeats: MockSeat[] = []

export const mockVenueLayouts: MockVenueLayout[] = [
  { weddingId: 'wedding-001', stageWidth: 300, stageHeight: 150, stagePositionX: 500, stagePositionY: 100 },
]

export const mockEtiquetteSettings: MockEtiquetteSettings[] = [
  {
    weddingId: 'wedding-001',
    elderNearMain: true,
    conflictWarning: true,
    genderSeparation: false,
    mainTableNearStage: true,
    sameCategoryTogether: true,
  },
]

export const mockEtiquetteWarnings: MockEtiquetteWarning[] = [
  { warningId: 'warning-001', weddingId: 'wedding-001', warningType: 'gender-separation', message: '男女分桌建議：偵測到男女混坐', dismissed: false },
  { warningId: 'warning-002', weddingId: 'wedding-001', warningType: 'elder-near-main', message: '長輩靠近主桌建議', dismissed: false },
]
