// 接待帳號 mock 資料
// seed：account-001（reception-desk-1 / wedding-001）

export interface MockReceptionAccount {
  accountId: string
  weddingId: string
  username: string
  passwordHash: string // 空字串＝未設密碼、不可登入（僅作名單管理）
}

export const mockReceptionAccounts: MockReceptionAccount[] = [
  { accountId: 'account-001', weddingId: 'wedding-001', username: 'reception-desk-1', passwordHash: '' },
  { accountId: 'account-002', weddingId: 'wedding-001', username: 'reception-desk-2', passwordHash: '' },
  { accountId: 'account-003', weddingId: 'wedding-001', username: 'reception-desk-3', passwordHash: '' },
]
