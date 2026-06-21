// 喜餅款式：CRUD + 指派規則

export interface CakeBoxTypeListItem {
  cakeBoxTypeId: string
  weddingId: string
  name: string
  description: string | null
  isDefault: boolean
}

export interface CreateCakeBoxTypeBody {
  name: string
  description?: string
  isDefault: boolean
}

export interface CakeBoxTypeCreatedEvent {
  cakeBoxTypeId: string
  weddingId: string
  name: string
  description: string | null
  isDefault: boolean
}

export interface UpdateCakeBoxTypeBody {
  name?: string
  description?: string
}

export interface CakeBoxTypeUpdatedEvent {
  cakeBoxTypeId: string
  name: string
  description: string | null
}

export interface ConfigureCakeBoxAssignmentBody {
  guestId: string
  assignmentRule: string
}

export interface CakeBoxAssignmentConfiguredEvent {
  cakeBoxTypeId: string
  guestId: string
  assignmentRule: string
}

// 讀回該婚禮已設定的指派規則清單（含款式名稱供顯示）
export interface CakeBoxAssignmentListItem {
  cakeBoxTypeId: string
  cakeBoxTypeName: string
  guestId: string
  assignmentRule: string
}
