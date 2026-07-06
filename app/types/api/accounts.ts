// 接待帳號：建立 / 編輯 / 移除

export interface ReceptionAccountListItem {
  accountId: string
  weddingId: string
  username: string
}

export interface CreateReceptionAccountBody {
  username: string
  // 選填：設定後此帳號可登入接待端（僅名單管理可不填）
  password?: string
}

export interface UpdateReceptionAccountBody {
  username?: string
  // 重設密碼（scrypt 雜湊入庫，不回顯既有密碼）
  password?: string
}

export interface ReceptionAccountCreatedEvent {
  accountId: string
  weddingId: string
  username: string
}
