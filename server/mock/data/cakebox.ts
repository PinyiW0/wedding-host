// 喜餅款式 mock 資料
// seed：cakeboxtype-001（經典禮盒 / isDefault true）

export interface MockCakeBoxType {
  cakeBoxTypeId: string
  weddingId: string
  name: string
  description: string | null
  isDefault: boolean
}

export interface MockCakeBoxAssignment {
  cakeBoxTypeId: string
  guestId: string
  assignmentRule: string
}

export const mockCakeBoxTypes: MockCakeBoxType[] = [
  { cakeBoxTypeId: 'cakeboxtype-001', weddingId: 'wedding-001', name: '經典禮盒', description: '傳統經典喜餅禮盒', isDefault: true },
  { cakeBoxTypeId: 'cakeboxtype-002', weddingId: 'wedding-001', name: '豪華禮盒', description: '升級版豪華喜餅禮盒', isDefault: false },
  { cakeBoxTypeId: 'cakeboxtype-003', weddingId: 'wedding-001', name: '輕巧禮盒', description: '小巧精緻喜餅禮盒', isDefault: false },
]

// 後台逐位指定款式：接待端據此顯示「指定款式」並可打勾發放
// （部分賓客刻意未指定，呈現「未指定款式」需手動選款的情境）
// 註：guest-001（陳大明）刻意不預設指派——vibe 持久化測試會自行為其新增指派並斷言唯一，
//     同時接待端正好示範「未指定款式」需手動選款的情境
export const mockCakeBoxAssignments: MockCakeBoxAssignment[] = [
  { cakeBoxTypeId: 'cakeboxtype-002', guestId: 'guest-002', assignmentRule: '朋友→豪華禮盒' },
  { cakeBoxTypeId: 'cakeboxtype-002', guestId: 'guest-003', assignmentRule: '家人→豪華禮盒' },
  { cakeBoxTypeId: 'cakeboxtype-001', guestId: 'guest-004', assignmentRule: '同學→經典禮盒' },
  { cakeBoxTypeId: 'cakeboxtype-003', guestId: 'guest-006', assignmentRule: '朋友→輕巧禮盒' },
  { cakeBoxTypeId: 'cakeboxtype-002', guestId: 'guest-007', assignmentRule: '家人→豪華禮盒' },
  { cakeBoxTypeId: 'cakeboxtype-002', guestId: 'guest-011', assignmentRule: '家人→豪華禮盒' },
  { cakeBoxTypeId: 'cakeboxtype-003', guestId: 'guest-012', assignmentRule: '朋友→輕巧禮盒' },
]
