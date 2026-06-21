// 接待帳號 mock 資料
// seed：account-001（reception-desk-1 / wedding-001）

export interface MockReceptionAccount {
  accountId: string
  weddingId: string
  username: string
}

export const mockReceptionAccounts: MockReceptionAccount[] = [
  { accountId: 'account-001', weddingId: 'wedding-001', username: 'reception-desk-1' },
  { accountId: 'account-002', weddingId: 'wedding-001', username: 'reception-desk-2' },
  { accountId: 'account-003', weddingId: 'wedding-001', username: 'reception-desk-3' },
]
