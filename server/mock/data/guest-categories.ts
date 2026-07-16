// 婚禮層級賓客分類字典（新增賓客可直選；管理入口可增改刪）
// 改造後賓客以 categoryId 引用本字典（原為名稱字串，issue #94）；tier / isMainTable 為座位排序語意欄位

export interface MockGuestCategory {
  categoryId: string
  weddingId: string
  name: string
  tier: number
  isMainTable: boolean
}

// 順序即 GET /guest-categories 的輸出順序（依 seq）。
// 這六筆＝改造前「stored(家人/朋友/同事/同學) ∪ in-use(新人/雙親)」的 union 結果，逐字對齊
// → 拆掉 union 後端點輸出不變。tier / isMainTable 的值＝inferCategoryDefaults(name) 的結果
// （見 server/utils/guest-category.ts）。
export const mockGuestCategories: MockGuestCategory[] = [
  { categoryId: 'gcat-001', weddingId: 'wedding-001', name: '家人', tier: 1, isMainTable: false },
  { categoryId: 'gcat-002', weddingId: 'wedding-001', name: '朋友', tier: 2, isMainTable: false },
  { categoryId: 'gcat-003', weddingId: 'wedding-001', name: '同事', tier: 3, isMainTable: false },
  { categoryId: 'gcat-004', weddingId: 'wedding-001', name: '同學', tier: 3, isMainTable: false },
  { categoryId: 'gcat-005', weddingId: 'wedding-001', name: '新人', tier: 0, isMainTable: true },
  { categoryId: 'gcat-006', weddingId: 'wedding-001', name: '雙親', tier: 1, isMainTable: true },
]

// 名稱 → id：seed 的賓客用名稱宣告（可讀），由此對照成 id。
// 找不到即 throw ⇒「mock 賓客用了字典沒有的分類」從靜默孤兒變成 seed 期硬錯誤，不可能再退化。
export function categoryIdByName(weddingId: string, name: string): string {
  const row = mockGuestCategories.find(c => c.weddingId === weddingId && c.name === name)
  if (!row)
    throw new Error(`mock guest category not found: ${weddingId} / ${name}`)
  return row.categoryId
}
