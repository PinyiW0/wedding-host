// 使用者（管理員 / 接待員）mock 資料 + 當前登入者
// 來源：ui-config.yaml > testAccounts、RegisterAdmin.feature

export interface MockUser {
  userId: string
  username: string
  email: string
  password: string
  displayName: string
  role: string // 管理者 | 接待員
  weddingId: string | null // 接待員綁定其負責的婚禮；管理者跨場為 null
  deletedAt: string | null
}

export const mockUsers: MockUser[] = [
  {
    userId: 'user-001',
    username: 'Andrea',
    email: 'andrea@example.com',
    password: 'Andrea1122',
    displayName: 'Andrea',
    role: '管理者',
    weddingId: null,
    deletedAt: null,
  },
  {
    userId: 'user-002',
    username: 'receptionist',
    email: 'receptionist@example.com',
    password: 'star1122',
    displayName: '接待員',
    role: '接待員',
    weddingId: 'wedding-001',
    deletedAt: null,
  },
]

// 模板無真正 auth 層，預設以第一位管理員作為當前登入者
export function getMockCurrentUser(): MockUser {
  return mockUsers[0]!
}
