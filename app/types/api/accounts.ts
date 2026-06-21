// 接待帳號：建立 / 移除

export interface ReceptionAccountListItem {
  accountId: string
  weddingId: string
  username: string
}

export interface CreateReceptionAccountBody {
  username: string
}

export interface ReceptionAccountCreatedEvent {
  accountId: string
  weddingId: string
  username: string
}
