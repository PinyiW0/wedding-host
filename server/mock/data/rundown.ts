// 婚禮當天流程表 mock 資料
// seed 項目標題刻意避開範本 8 段字樣（避免 e2e findEntity 名稱碰撞）

export interface MockRundownRole {
  roleId: string
  weddingId: string
  name: string
}

export interface MockRundownItem {
  rundownItemId: string
  weddingId: string
  // 開始時間 HH:MM；null＝未定時段（排序置頂）
  time: string | null
  durationMinutes: number
  title: string
  location: string | null
  supplies: string | null
  note: string | null
  // 矩陣格：各角色在此時段的個別事項（task 可空字串＝參與但無個別事項）
  roleTasks: { roleId: string, task: string }[]
}

// 預設角色 seed：接待、總場控、新秘、平面攝影師（新人可自行增刪改）
export const mockRundownRoles: MockRundownRole[] = [
  { roleId: 'role-001', weddingId: 'wedding-001', name: '接待' },
  { roleId: 'role-002', weddingId: 'wedding-001', name: '總場控' },
  { roleId: 'role-003', weddingId: 'wedding-001', name: '新秘' },
  { roleId: 'role-004', weddingId: 'wedding-001', name: '平面攝影師' },
]

export const mockRundownItems: MockRundownItem[] = [
  {
    rundownItemId: 'rundownitem-001',
    weddingId: 'wedding-001',
    time: '16:30',
    durationMinutes: 20,
    title: '新娘物品點交',
    location: '新娘房',
    supplies: '婚紗配件、備用鞋',
    note: null,
    roleTasks: [{ roleId: 'role-003', task: '婚紗配件、備用鞋檢查' }],
  },
]
