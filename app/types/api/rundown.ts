// 婚禮當天流程表：自訂角色 CRUD + 矩陣表整表儲存（列＝時間段、欄＝固定欄位＋每角色一欄）

export interface RundownRoleListItem {
  roleId: string
  weddingId: string
  name: string
}

export interface CreateRundownRoleBody {
  name: string
}

export interface RundownRoleCreatedEvent {
  roleId: string
  weddingId: string
  name: string
}

export interface UpdateRundownRoleBody {
  name: string
}

export interface RundownRoleUpdatedEvent {
  roleId: string
  name: string
}

// 矩陣格：某角色在某時段的個別事項；task 可空字串＝參與但無個別事項
export interface RundownRoleTask {
  roleId: string
  task: string
  // 該角色在此時段自己要帶的物品（issue #188）；省略＝沒有。整列共用的物品在 RundownItemListItem.supplies
  supplies?: string
}

export interface RundownItemListItem {
  rundownItemId: string
  weddingId: string
  // 開始時間 HH:MM；null＝未定時段（如「婚前一天」準備列，排序置頂）
  time: string | null
  // 時長（分鐘）；訖時間 = time + durationMinutes，由前端推算顯示
  durationMinutes: number
  // 主要事項（識別欄位）
  title: string
  // 場地
  location: string | null
  // 共用物品（整列所有角色共用；各角色自己的物品在 roleTasks[].supplies）
  supplies: string | null
  note: string | null
  // 矩陣格：各角色在此時段的個別事項
  roleTasks: RundownRoleTask[]
  // 使用者標記列（highlight 底色強調；隨整表 PUT 持久化）
  highlight: boolean
  // 對賓客公開此時段（賓客版流程頁 /schedule 只呈現 true 的列）
  guestVisible: boolean
}

export interface SaveRundownTableBody {
  // 整表取代：既有列帶 rundownItemId、新列省略（後端配發）、未帶回的既有列＝刪除
  items: Array<{
    rundownItemId?: string
    time?: string | null
    durationMinutes?: number
    title: string
    location?: string
    supplies?: string
    note?: string
    roleTasks?: RundownRoleTask[]
    // 省略視為 false（相容不帶此欄的呼叫端）
    highlight?: boolean
    guestVisible?: boolean
  }>
}

export interface RundownTableSavedEvent {
  weddingId: string
  itemCount: number
  items: RundownItemListItem[]
}

// 流程表角色版（issue #188）：工作人員用角色連結只拿得到自己那份——
// 只有該角色參與的時段，每段只帶該角色自己的事項，不含其他角色事項與賓客可見設定
export interface RundownRoleViewItem {
  rundownItemId: string
  time: string | null
  durationMinutes: number
  // 該時段的主要內容
  title: string
  location: string | null
  // 該角色自己要帶的物品；空字串＝沒有
  roleSupplies: string
  // 整列共用物品
  sharedSupplies: string | null
  note: string | null
  // 該角色在此時段要做的事（可多行）；空字串＝參與但無個別事項
  task: string
  highlight: boolean
}

export interface RundownRoleView {
  roleId: string
  roleName: string
  groomName: string | null
  brideName: string | null
  items: RundownRoleViewItem[]
}

// 賓客版流程（issue #190）：/schedule 唯一讀取的端點，只有賓客可見時段的公開欄位——
// 不含共用物品、備註、角色事項，也不含未公開的時段
export interface GuestScheduleListItem {
  rundownItemId: string
  time: string | null
  durationMinutes: number
  title: string
  location: string | null
  highlight: boolean
}
