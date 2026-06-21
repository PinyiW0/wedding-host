// 婚禮場次：建立 / 更新 / 軟刪 / 恢復

export interface WeddingListItem {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string // YYYY-MM-DD
  deletedAt: string | null
}

// 婚禮詳情（比列表項多了地圖/停車/交通，供詳情頁完整呈現與持久化）
export interface WeddingDetail {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string // YYYY-MM-DD
  mapLink: string | null
  parkingInfo: string | null
  transportInfo: string | null
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
  mapLink?: string
  parkingInfo?: string
  transportInfo?: string
}

export interface WeddingUpdatedEvent {
  weddingId: string
  title: string
  venue: string
  address: string
  date: string
  mapLink: string | null
  parkingInfo: string | null
  transportInfo: string | null
}

export interface WeddingRestoredEvent {
  weddingId: string
}
