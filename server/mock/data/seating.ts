// 座位與場地佈局 mock 資料：桌次 / 座位 / 場地佈局 / 禮俗設定與警告
// seed：table-001（主桌 / 12 座 / 100,200，由後台設定）、warning-001（gender-separation）

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

// 預設佈局：主桌置於頂端中央（正對舞台），其餘各桌「兩桌一列」往下排到結束。
// 欄距 360 / 列距 300 的寬鬆間距，使各桌「圓桌＋環繞座位＋下方按鈕」不致重疊。
// 註：位置存於記憶體 mock，現場拖曳調整後重整仍在，但開發伺服器重啟會回到此預設。
export const mockTables: MockTable[] = [
  { tableId: 'table-001', weddingId: 'wedding-001', tableName: '主桌', capacity: 12, positionX: 308, positionY: 40 },
  { tableId: 'table-002', weddingId: 'wedding-001', tableName: '男方家屬桌', capacity: 10, positionX: 120, positionY: 340 },
  { tableId: 'table-003', weddingId: 'wedding-001', tableName: '女方家屬桌', capacity: 10, positionX: 480, positionY: 340 },
  { tableId: 'table-004', weddingId: 'wedding-001', tableName: '第4桌', capacity: 10, positionX: 120, positionY: 640 },
  { tableId: 'table-005', weddingId: 'wedding-001', tableName: '第5桌', capacity: 10, positionX: 480, positionY: 640 },
  { tableId: 'table-006', weddingId: 'wedding-001', tableName: '第6桌', capacity: 10, positionX: 120, positionY: 940 },
  { tableId: 'table-007', weddingId: 'wedding-001', tableName: '第7桌', capacity: 10, positionX: 480, positionY: 940 },
  { tableId: 'table-008', weddingId: 'wedding-001', tableName: '第8桌', capacity: 10, positionX: 120, positionY: 1240 },
  { tableId: 'table-009', weddingId: 'wedding-001', tableName: '第9桌', capacity: 10, positionX: 480, positionY: 1240 },
  { tableId: 'table-010', weddingId: 'wedding-001', tableName: '第10桌', capacity: 10, positionX: 120, positionY: 1540 },
  { tableId: 'table-011', weddingId: 'wedding-001', tableName: '第11桌', capacity: 10, positionX: 480, positionY: 1540 },
  { tableId: 'table-012', weddingId: 'wedding-001', tableName: '第12桌', capacity: 10, positionX: 120, positionY: 1840 },
  { tableId: 'table-013', weddingId: 'wedding-001', tableName: '第13桌', capacity: 10, positionX: 480, positionY: 1840 },
  { tableId: 'table-014', weddingId: 'wedding-001', tableName: '第14桌', capacity: 10, positionX: 120, positionY: 2140 },
  { tableId: 'table-015', weddingId: 'wedding-001', tableName: '第15桌', capacity: 10, positionX: 480, positionY: 2140 },
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
    sameCategoryTogether: false,
  },
]

export const mockEtiquetteWarnings: MockEtiquetteWarning[] = [
  { warningId: 'warning-001', weddingId: 'wedding-001', warningType: 'gender-separation', message: '男女分桌建議：偵測到男女混坐', dismissed: false },
  { warningId: 'warning-002', weddingId: 'wedding-001', warningType: 'elder-near-main', message: '長輩靠近主桌建議', dismissed: false },
]
