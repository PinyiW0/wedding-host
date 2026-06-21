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
  accessToken: string
}
