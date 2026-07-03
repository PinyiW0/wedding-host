// 婚禮小物規劃：六類禮物品項 CRUD
// 金額為讀模型（前端計算不落庫）：小計＝unitPrice×quantity；品項總計＝小計＋shippingFee1＋shippingFee2＋otherFee

export type GiftCategory
  = | 'table' // 桌上禮
    | 'second_entrance' // 二進禮
    | 'game' // 遊戲禮
    | 'send_off' // 送客禮
    | 'room_visit' // 探房禮
    | 'tea_ceremony' // 喝茶禮

export interface GiftItemListItem {
  giftItemId: string
  weddingId: string
  category: GiftCategory
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
  category: GiftCategory
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
  category?: GiftCategory
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
