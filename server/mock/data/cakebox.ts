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

export const mockCakeBoxAssignments: MockCakeBoxAssignment[] = []
