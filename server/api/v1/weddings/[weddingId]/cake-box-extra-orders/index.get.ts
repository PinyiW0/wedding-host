import type { H3Event } from 'h3'
import type { CakeBoxExtraOrderListItem } from '../../../../../../app/types/api/cakebox'

import { mockCakeBoxExtraOrders, mockCakeBoxTypes } from '../../../../../mock/data/cakebox'

// 讀回該婚禮「額外配發（公關用）」清單，補上款式名稱供顯示
export default defineEventHandler((event: H3Event): CakeBoxExtraOrderListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')
  const typeMap = new Map(
    mockCakeBoxTypes.filter(t => t.weddingId === weddingId).map(t => [t.cakeBoxTypeId, t.name]),
  )
  return mockCakeBoxExtraOrders
    .filter(o => o.weddingId === weddingId)
    .map(o => ({
      extraOrderId: o.extraOrderId,
      cakeBoxTypeId: o.cakeBoxTypeId,
      cakeBoxTypeName: typeMap.get(o.cakeBoxTypeId) ?? '（已刪除款式）',
      quantity: o.quantity,
      note: o.note,
    }))
})
