// 喜餅款式：CRUD + 指派規則

export interface CakeBoxTypeListItem {
  cakeBoxTypeId: string
  weddingId: string
  name: string
  description: string | null
  isDefault: boolean
  // 縮圖（上傳後存成 base64 data URL）與單價（元），皆可為空
  imageUrl: string | null
  price: number | null
  // 組合款（issue #106）：內含單款 id 清單；null／空＝一般單款
  componentTypeIds: string[] | null
}

export interface CreateCakeBoxTypeBody {
  name: string
  description?: string
  isDefault: boolean
  imageUrl?: string
  price?: number
  // 有值即為組合款；僅可內含非組合款（單層）
  componentTypeIds?: string[]
}

export interface CakeBoxTypeCreatedEvent {
  cakeBoxTypeId: string
  weddingId: string
  name: string
  description: string | null
  isDefault: boolean
  imageUrl: string | null
  price: number | null
  componentTypeIds: string[] | null
}

export interface UpdateCakeBoxTypeBody {
  name?: string
  description?: string
  // 可事後切換預設款（設為 true 時其他款式自動取消預設）、更新縮圖與單價
  isDefault?: boolean
  imageUrl?: string
  price?: number
  // 傳空陣列＝解除組合
  componentTypeIds?: string[]
}

export interface CakeBoxTypeUpdatedEvent {
  cakeBoxTypeId: string
  name: string
  description: string | null
  isDefault: boolean
  imageUrl: string | null
  price: number | null
  componentTypeIds: string[] | null
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

// === 不發放：新人本人等不需喜餅者（排除在訂購數量與領取清單外） ===
export interface CakeBoxExclusionListItem {
  guestId: string
}

export interface ExcludeGuestCakeBoxBody {
  guestId: string
}

export interface CakeBoxGuestExcludedEvent {
  guestId: string
}

// === 額外配發：公關／公司公餅（非賓客；只計入訂購總數） ===
// 可填具名收餅對象（姓名／聯絡，皆選填），讓非賓客也能逐人留資料而不污染賓客名單
export interface CakeBoxExtraOrderListItem {
  extraOrderId: string
  cakeBoxTypeId: string
  cakeBoxTypeName: string
  quantity: number
  recipientName: string | null
  recipientContact: string | null
  note: string | null
}

export interface CreateCakeBoxExtraOrderBody {
  cakeBoxTypeId: string
  quantity: number
  recipientName?: string
  recipientContact?: string
  note?: string
}

export interface CakeBoxExtraOrderCreatedEvent {
  extraOrderId: string
  cakeBoxTypeId: string
  quantity: number
  recipientName: string | null
  recipientContact: string | null
  note: string | null
}
