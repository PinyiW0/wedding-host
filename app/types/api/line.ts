// LINE 官方帳號連結

export interface ConnectLineOaBody {
  oaName: string
  channelId: string
}

export interface LineOaConnectedEvent {
  weddingId: string
  oaName: string
  channelId: string
}

// 讀取目前婚禮的 LINE OA 連結狀態；尚未連結回 null
export interface LineOaDetail {
  weddingId: string
  oaName: string
  channelId: string
}
