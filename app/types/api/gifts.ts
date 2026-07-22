// 婚禮小物規劃：類別可自訂（預設六類）＋禮物品項 CRUD
// 金額為讀模型（前端計算不落庫）：小計＝unitPrice×quantity；品項總計＝小計＋shippingFee1＋shippingFee2＋otherFee

// 婚禮層級類別字典（issue #124）：category 欄存 categoryId（預設類沿用 slug：table…tea_ceremony）
export interface GiftCategoryItem {
  categoryId: string
  weddingId: string
  name: string
  sortOrder: number
}

export interface CreateGiftCategoryBody {
  name: string
}

export interface GiftCategoryCreatedEvent extends GiftCategoryItem {}

export interface UpdateGiftCategoryBody {
  name: string
}

export interface GiftCategoryUpdatedEvent extends GiftCategoryItem {}

export interface GiftItemListItem {
  giftItemId: string
  weddingId: string
  category: string
  // 款式說明（識別欄位，必填）
  description: string
  // 縮圖（上傳後存成 base64 data URL）
  imageUrl: string | null
  unitPrice: number
  quantity: number
  purchaseUrl: string | null
  // 預計發放時間（自由文字，如「二進後」「18:30」）
  distributionTime: string | null
  shippingFee1: number
  shippingFee2: number
  otherFee: number
  note: string | null
}

export interface CreateGiftItemBody {
  category: string
  description: string
  unitPrice: number
  quantity: number
  imageUrl?: string
  purchaseUrl?: string
  distributionTime?: string
  shippingFee1?: number
  shippingFee2?: number
  otherFee?: number
  note?: string
}

export interface GiftItemCreatedEvent extends GiftItemListItem {}

export interface UpdateGiftItemBody {
  category?: string
  description?: string
  unitPrice?: number
  quantity?: number
  imageUrl?: string
  purchaseUrl?: string
  distributionTime?: string
  shippingFee1?: number
  shippingFee2?: number
  otherFee?: number
  note?: string
}

export interface GiftItemUpdatedEvent extends GiftItemListItem {}
