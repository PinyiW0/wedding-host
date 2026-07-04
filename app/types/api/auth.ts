// 認證：管理員註冊 + 登入

export interface RegisterAdminBody {
  email: string
  displayName: string
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
