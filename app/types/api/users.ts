// 新人帳號管理（管理者限定，issue #23）：建立／重設密碼／停用（軟刪除）

export interface CoupleAccountListItem {
  userId: string
  username: string
  displayName: string
  weddingId: string | null // 綁定的婚禮（weddings.ownerId 同步維護）
  deletedAt: string | null // 非 null＝已停用，login 拒絕
}

export interface CreateCoupleAccountBody {
  username: string
  password: string
  displayName: string
  weddingId?: string // 選填：建立時直接綁定婚禮
}

export interface UpdateCoupleAccountBody {
  password?: string // 重設密碼（不回顯、不外洩 hash）
  displayName?: string
  weddingId?: string | null // null＝解除綁定
}

export interface CoupleAccountEvent {
  userId: string
  username: string
  displayName: string
  weddingId: string | null
}
