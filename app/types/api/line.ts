// LINE 官方帳號連結

export interface ConnectLineOaBody {
  oaName: string
  channelId: string
  // 加好友連結（選填）：供賓客頁顯示「加入 LINE」入口；未填則賓客頁不顯示入口
  addFriendUrl?: string
}

export interface LineOaConnectedEvent {
  weddingId: string
  oaName: string
  channelId: string
  addFriendUrl?: string
}

// 讀取目前婚禮的 LINE OA 連結狀態；尚未連結回 null
export interface LineOaDetail {
  weddingId: string
  oaName: string
  channelId: string
  addFriendUrl?: string
}
