// 座位與場地佈局 mock 資料：桌次 / 座位 / 場地佈局 / 禮俗設定與警告
// seed：table-001（主桌 / 12 座 / 100,200，由後台設定）。
// 禮俗警告改由前端依「設定 + 當前座位」即時計算（違反才跳），故不再 seed 靜態警告。

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
  // 席位類型：normal = 正常席（佔 capacity 人頭）；childChair = 兒童椅（額外加位）
  seatType: 'normal' | 'childChair'
  // 該賓客組內同類型第幾位（1-indexed），供座位標籤
  partyIndex: number
}

export interface MockVenueLayout {
  weddingId: string
  stageWidth: number
  stageHeight: number
  stagePositionX: number
  stagePositionY: number
}

export interface MockVenueMarker {
  markerId: string
  weddingId: string
  label: string
  positionX: number
  positionY: number
  width: number
  height: number
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

// 場地標記（seed 空陣列：凍結測試期間畫布零差異）
export const mockVenueMarkers: MockVenueMarker[] = []

export const mockEtiquetteSettings: MockEtiquetteSettings[] = [
  {
    weddingId: 'wedding-001',
    elderNearMain: true,
    mainTableFull: true,
    sameCategoryTogether: false,
  },
]

// 警告改由前端即時計算，這裡只保留空陣列供 dismiss 端點查找與 reset 還原（不再有靜態警告）
export const mockEtiquetteWarnings: MockEtiquetteWarning[] = []
