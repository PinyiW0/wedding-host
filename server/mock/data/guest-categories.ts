// 婚禮層級賓客分類清單（新增賓客可直選；管理入口可增改刪）
// 分類本身仍以字串附著在賓客上（guests.category），本清單只是「可選項字典」

export interface MockGuestCategory {
  weddingId: string
  name: string
}

// seed 對齊 guests seed 的在用分類
export const mockGuestCategories: MockGuestCategory[] = [
  { weddingId: 'wedding-001', name: '家人' },
  { weddingId: 'wedding-001', name: '朋友' },
  { weddingId: 'wedding-001', name: '同事' },
  { weddingId: 'wedding-001', name: '同學' },
]
