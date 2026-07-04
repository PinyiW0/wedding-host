// 婚禮場次：建立 / 更新 / 軟刪 / 恢復

export interface WeddingListItem {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string // YYYY-MM-DD
  // 擁有此婚禮的帳號（新人角色用於資料隔離）；未設定為 null
  ownerId: string | null
  deletedAt: string | null
}

// 婚禮詳情（比列表項多了地圖/停車/交通，供詳情頁完整呈現與持久化）
export interface WeddingDetail {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string // YYYY-MM-DD
  // 新人姓名（供訪客頁顯示與「與新人的關係」選項；由後台維護）
  groomName: string | null
  brideName: string | null
  mapLink: string | null
  parkingInfo: string | null
  transportInfo: string | null
  // 交通參考圖片（dataURL 陣列，可多張；未設定為空陣列）
  transportImageUrls: string[]
  // 擁有此婚禮的帳號（新人角色用於資料隔離）；未設定為 null
  ownerId: string | null
  deletedAt: string | null
}

export interface CreateWeddingBody {
  title: string
  venue: string
  address: string
  date: string
}

export interface WeddingCreatedEvent {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string
}

export interface UpdateWeddingBody {
  title?: string
  venue?: string
  address?: string
  date?: string
  groomName?: string
  brideName?: string
  mapLink?: string
  parkingInfo?: string
  transportInfo?: string
  transportImageUrls?: string[]
}

export interface WeddingUpdatedEvent {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string
  groomName: string | null
  brideName: string | null
  mapLink: string | null
  parkingInfo: string | null
  transportInfo: string | null
  transportImageUrls: string[]
}

export interface WeddingRestoredEvent {
  weddingId: string
}
