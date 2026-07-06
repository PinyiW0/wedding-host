// 認證：管理員註冊 + 登入

export interface RegisterAdminBody {
  email: string
  displayName: string
  // 選填：未設定則帳號建立後不可登入（可由管理端重設）
  password?: string
}

export interface AdminRegisteredEvent {
  userId: string
  email: string
  displayName: string
}

export interface LoginBody {
  username: string
  password: string
}

export interface UserLoggedInEvent {
  userId: string
  username: string
  role: string
  weddingId: string | null // 接待員綁定的婚禮；管理者為 null
  accessToken: string
}
