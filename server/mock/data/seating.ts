// 座位與場地佈局 mock 資料：桌次 / 座位 / 場地佈局
// seed：table-001（主桌 / 12 座 / 100,200，由後台設定）。

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

// 預設佈局：主桌置於頂端中央（正對舞台），其餘各桌「兩桌一列」往下排到結束。
// 欄距 360 / 列距 300 的寬鬆間距，使各桌「圓桌＋環繞座位＋下方按鈕」不致重疊。
// 註：位置存於記憶體 mock，現場拖曳調整後重整仍在，但開發伺服器重啟會回到此預設。
// 預設佈局（自賓客席往舞台看）：舞台在最前方置中，主桌緊接其後、與舞台同一中軸，
// 其餘各桌「兩桌一列」往後排。主桌格寬 200、其餘 168，兩欄中軸落在 x=384，
// 舞台與主桌都對齊該中軸；列距 300 使「圓桌＋環繞座位」不致重疊
// （舊版主桌 y=40 高 200、家屬桌 y=340，兩者實際重疊 40px）。
// 註：位置存於記憶體 mock，現場拖曳調整後重整仍在，但開發伺服器重啟會回到此預設。
export const mockTables: MockTable[] = [
  { tableId: 'table-001', weddingId: 'wedding-001', tableName: '主桌', capacity: 12, positionX: 284, positionY: 220 },
  { tableId: 'table-002', weddingId: 'wedding-001', tableName: '男方家屬桌', capacity: 10, positionX: 120, positionY: 520 },
  { tableId: 'table-003', weddingId: 'wedding-001', tableName: '女方家屬桌', capacity: 10, positionX: 480, positionY: 520 },
  { tableId: 'table-004', weddingId: 'wedding-001', tableName: '第4桌', capacity: 10, positionX: 120, positionY: 820 },
  { tableId: 'table-005', weddingId: 'wedding-001', tableName: '第5桌', capacity: 10, positionX: 480, positionY: 820 },
  { tableId: 'table-006', weddingId: 'wedding-001', tableName: '第6桌', capacity: 10, positionX: 120, positionY: 1120 },
  { tableId: 'table-007', weddingId: 'wedding-001', tableName: '第7桌', capacity: 10, positionX: 480, positionY: 1120 },
  { tableId: 'table-008', weddingId: 'wedding-001', tableName: '第8桌', capacity: 10, positionX: 120, positionY: 1420 },
  { tableId: 'table-009', weddingId: 'wedding-001', tableName: '第9桌', capacity: 10, positionX: 480, positionY: 1420 },
  { tableId: 'table-010', weddingId: 'wedding-001', tableName: '第10桌', capacity: 10, positionX: 120, positionY: 1720 },
  { tableId: 'table-011', weddingId: 'wedding-001', tableName: '第11桌', capacity: 10, positionX: 480, positionY: 1720 },
  { tableId: 'table-012', weddingId: 'wedding-001', tableName: '第12桌', capacity: 10, positionX: 120, positionY: 2020 },
  { tableId: 'table-013', weddingId: 'wedding-001', tableName: '第13桌', capacity: 10, positionX: 480, positionY: 2020 },
  { tableId: 'table-014', weddingId: 'wedding-001', tableName: '第14桌', capacity: 10, positionX: 120, positionY: 2320 },
  { tableId: 'table-015', weddingId: 'wedding-001', tableName: '第15桌', capacity: 10, positionX: 480, positionY: 2320 },
]

// 座位安排（預設無人入座；測試移除「桌次上還有賓客」情境時可動態 push）
export const mockSeats: MockSeat[] = []

// 舞台置於最前方、與主桌同中軸（x = 384 - 300/2 = 234）；舊值 500/100 偏右且與主桌打架
export const mockVenueLayouts: MockVenueLayout[] = [
  { weddingId: 'wedding-001', stageWidth: 300, stageHeight: 150, stagePositionX: 234, stagePositionY: 20 },
]

// 場地標記（seed 空陣列：凍結測試期間畫布零差異）
export const mockVenueMarkers: MockVenueMarker[] = []
