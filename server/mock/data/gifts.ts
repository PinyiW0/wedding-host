// 婚禮小物 mock 資料
// seed 金額刻意可驗算（spec 斷言用）：
//   giftitem-001 桌上禮 50×120＋運費100 → 小計 6,000、總計 6,100
//   giftitem-002 送客禮 80×150＋運費200＋50 → 小計 12,000、總計 12,250
//   全部總額 18,350

import type { GiftCategory } from '../../../app/types/api/gifts'

export interface MockGiftItem {
  giftItemId: string
  weddingId: string
  category: GiftCategory
  description: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
  purchaseUrl: string | null
  distributionTime: string | null
  shippingFee1: number
  shippingFee2: number
  otherFee: number
  note: string | null
}

export const mockGiftItems: MockGiftItem[] = [
  {
    giftItemId: 'giftitem-001',
    weddingId: 'wedding-001',
    category: 'table',
    description: '拉花小熊桌上禮',
    imageUrl: null,
    unitPrice: 50,
    quantity: 120,
    purchaseUrl: 'https://shop.example.com/table-bear',
    distributionTime: '賓客入席前擺桌',
    shippingFee1: 100,
    shippingFee2: 0,
    otherFee: 0,
    note: null,
  },
  {
    giftItemId: 'giftitem-002',
    weddingId: 'wedding-001',
    category: 'send_off',
    description: '乾燥花束送客禮',
    imageUrl: null,
    unitPrice: 80,
    quantity: 150,
    purchaseUrl: null,
    distributionTime: '送客時',
    shippingFee1: 200,
    shippingFee2: 50,
    otherFee: 0,
    note: '含備量 10%',
  },
]
