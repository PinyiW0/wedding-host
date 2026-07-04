// 使用者（管理員 / 接待員）mock 資料 + 當前登入者
// 來源：ui-config.yaml > testAccounts、RegisterAdmin.feature

import { hashPassword } from '../../utils/password'

export interface MockUser {
  userId: string
  username: string
  email: string
  passwordHash: string // scrypt 雜湊（空字串＝尚未設密碼、不可登入）
  displayName: string
  role: string // 管理者 | 新人 | 接待員
  weddingId: string | null // 新人／接待員綁定其婚禮；管理者跨場為 null
  deletedAt: string | null
}

export const mockUsers: MockUser[] = [
  {
    userId: 'user-001',
    username: 'Andrea',
    email: 'andrea@example.com',
    passwordHash: hashPassword('Andrea1122'),
    displayName: 'Andrea',
    role: '管理者',
    weddingId: null,
    deletedAt: null,
  },
  {
    userId: 'user-002',
    username: 'receptionist',
    email: 'receptionist@example.com',
    passwordHash: hashPassword('star1122'),
    displayName: '接待員',
    role: '接待員',
    weddingId: 'wedding-001',
    deletedAt: null,
  },
  {
    // 新人帳號：可管理自己的婚禮（含新增接待帳號），但看不到別人的婚禮
    userId: 'user-003',
    username: 'couple',
    email: 'couple@example.com',
    passwordHash: hashPassword('couple1122'),
    displayName: '新人',
    role: '新人',
    weddingId: 'wedding-001',
    deletedAt: null,
  },
]

// 模板無真正 auth 層，預設以第一位管理員作為當前登入者
export function getMockCurrentUser(): MockUser {
  return mockUsers[0]!
}
